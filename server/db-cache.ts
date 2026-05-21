import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

export const CACHE_DIR = path.join(process.cwd(), ".cache");

export interface CacheEntry {
  fetched_at: string;
  items: Record<string, unknown>[];
  raw_count: number;
}

export interface IDatabaseCache {
  read(dbName: string, ttlHours: number, raw?: boolean): CacheEntry | null;
  write(dbName: string, entry: CacheEntry, raw?: boolean): void;
  clear(dbName: string): void;
  has(dbName: string, ttlHours: number): boolean;
}

export class JsonFileCache implements IDatabaseCache {
  private cacheDir: string;

  constructor(cacheDir = CACHE_DIR) {
    this.cacheDir = cacheDir;
  }

  private cachePath(dbName: string, raw: boolean): string {
    const suffix = raw ? "-raw" : "";
    return path.join(this.cacheDir, `db-${dbName}${suffix}.json`);
  }

  read(dbName: string, ttlHours: number, raw = false): CacheEntry | null {
    const filePath = this.cachePath(dbName, raw);
    if (!fs.existsSync(filePath)) return null;
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const entry = JSON.parse(content) as CacheEntry;
      const age = (Date.now() - new Date(entry.fetched_at).getTime()) / (1000 * 60 * 60);
      if (age > ttlHours) return null;
      return entry;
    } catch {
      return null;
    }
  }

  write(dbName: string, entry: CacheEntry, raw = false): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
    fs.writeFileSync(
      this.cachePath(dbName, raw),
      JSON.stringify(entry, null, 2)
    );
  }

  clear(dbName: string): void {
    const mapped = this.cachePath(dbName, false);
    const raw = this.cachePath(dbName, true);
    if (fs.existsSync(mapped)) fs.unlinkSync(mapped);
    if (fs.existsSync(raw)) fs.unlinkSync(raw);
  }

  has(dbName: string, ttlHours: number): boolean {
    return this.read(dbName, ttlHours) !== null;
  }
}

export class SqliteCache implements IDatabaseCache {
  private db: Database.Database;

  constructor(dbPath = path.join(CACHE_DIR, "db-cache.sqlite")) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cache_entries (
        db_name TEXT NOT NULL,
        variant  TEXT NOT NULL DEFAULT '',
        fetched_at TEXT NOT NULL,
        raw_count  INTEGER NOT NULL,
        payload    TEXT NOT NULL,
        PRIMARY KEY (db_name, variant)
      )
    `);
  }

  read(dbName: string, ttlHours: number, raw = false): CacheEntry | null {
    const variant = raw ? "raw" : "";
    const row = this.db
      .prepare(
        "SELECT fetched_at, raw_count, payload FROM cache_entries WHERE db_name = ? AND variant = ?"
      )
      .get(dbName, variant) as
      | { fetched_at: string; raw_count: number; payload: string }
      | undefined;

    if (!row) return null;
    const age = (Date.now() - new Date(row.fetched_at).getTime()) / (1000 * 60 * 60);
    if (age > ttlHours) return null;

    try {
      const items = JSON.parse(row.payload) as Record<string, unknown>[];
      return { fetched_at: row.fetched_at, raw_count: row.raw_count, items };
    } catch {
      return null;
    }
  }

  write(dbName: string, entry: CacheEntry, raw = false): void {
    const variant = raw ? "raw" : "";
    this.db
      .prepare(
        `INSERT INTO cache_entries (db_name, variant, fetched_at, raw_count, payload)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(db_name, variant) DO UPDATE SET
           fetched_at = excluded.fetched_at,
           raw_count  = excluded.raw_count,
           payload    = excluded.payload`
      )
      .run(dbName, variant, entry.fetched_at, entry.raw_count, JSON.stringify(entry.items));
  }

  clear(dbName: string): void {
    this.db.prepare("DELETE FROM cache_entries WHERE db_name = ?").run(dbName);
  }

  has(dbName: string, ttlHours: number): boolean {
    return this.read(dbName, ttlHours) !== null;
  }

  /**
   * One-time migration: for each dbName, if the SQLite store has no row for
   * that name, look for a legacy `.cache/db-<name>.json` (and `-raw` variant)
   * and import it.  Successfully migrated files are deleted to avoid confusion.
   * Returns the list of database names that were migrated.
   */
  migrateFromJson(dbNames: string[], cacheDir = CACHE_DIR): string[] {
    const migrated: string[] = [];

    for (const dbName of dbNames) {
      const variants: Array<{ suffix: string; variant: string }> = [
        { suffix: "",     variant: ""    },
        { suffix: "-raw", variant: "raw" },
      ];

      let anyMigrated = false;

      for (const { suffix, variant } of variants) {
        const existing = this.db
          .prepare("SELECT 1 FROM cache_entries WHERE db_name = ? AND variant = ?")
          .get(dbName, variant);

        if (existing) continue;

        const jsonPath = path.join(cacheDir, `db-${dbName}${suffix}.json`);
        if (!fs.existsSync(jsonPath)) continue;

        try {
          const content = fs.readFileSync(jsonPath, "utf-8");
          const entry = JSON.parse(content) as CacheEntry;

          if (
            typeof entry.fetched_at !== "string" ||
            !Array.isArray(entry.items) ||
            typeof entry.raw_count !== "number"
          ) {
            console.warn(`[SqliteCache] Skipping malformed JSON cache: ${jsonPath}`);
            continue;
          }

          this.db
            .prepare(
              `INSERT INTO cache_entries (db_name, variant, fetched_at, raw_count, payload)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(db_name, variant) DO NOTHING`
            )
            .run(dbName, variant, entry.fetched_at, entry.raw_count, JSON.stringify(entry.items));

          fs.unlinkSync(jsonPath);
          anyMigrated = true;
          console.log(
            `[SqliteCache] Migrated ${jsonPath} → SQLite (db=${dbName}, variant=${variant || "mapped"})`
          );
        } catch (err) {
          console.warn(`[SqliteCache] Failed to migrate ${jsonPath}:`, err);
        }
      }

      if (anyMigrated) migrated.push(dbName);
    }

    return migrated;
  }
}
