import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as fs from "fs";
import * as path from "path";
import { child, registerLogSink } from "./logger";
const log = child({ module: "db" });



const dataDir = path.resolve("data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "app.db");
export const sqlite = new Database(dbPath);

sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    page_url TEXT,
    content_type TEXT,
    content_slug TEXT,
    locale TEXT DEFAULT 'en',
    feature_tags TEXT DEFAULT '[]',
    user_id TEXT,
    started_at INTEGER
  );
`);

// Migrate existing databases: rename visitor_id column to user_id if it exists
try {
  const cols = sqlite.prepare("PRAGMA table_info(conversations)").all() as Array<{ name: string }>;
  const hasVisitorId = cols.some(c => c.name === "visitor_id");
  const hasUserId = cols.some(c => c.name === "user_id");
  if (hasVisitorId && !hasUserId) {
    sqlite.exec("ALTER TABLE conversations RENAME COLUMN visitor_id TO user_id");
    log.info("[DB] Migrated conversations.visitor_id → user_id");
  }
} catch (err) {
  log.warn("[DB] Column migration check failed (non-fatal):", err);
}

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS conversation_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    question_tag TEXT,
    rating TEXT,
    rated_by TEXT,
    rated_at INTEGER,
    override_content TEXT,
    override_by TEXT,
    override_at INTEGER,
    created_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS ai_knowledge (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    updated_at INTEGER,
    updated_by TEXT
  );

  CREATE TABLE IF NOT EXISTS error_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts INTEGER NOT NULL,
    level TEXT NOT NULL,
    module TEXT NOT NULL,
    message TEXT NOT NULL,
    err_name TEXT,
    err_stack TEXT
  );

  CREATE INDEX IF NOT EXISTS error_log_ts_idx ON error_log (ts);
  CREATE INDEX IF NOT EXISTS error_log_level_idx ON error_log (level);
`);

log.info(`[DB] SQLite database: ${dbPath}`);

// Prepared statement for inserting error log entries
const _insertErrorLog = sqlite.prepare(
  "INSERT INTO error_log (ts, level, module, message, err_name, err_stack) VALUES (?, ?, ?, ?, ?, ?)"
);

// Pruning: remove entries older than 48h
const _pruneErrorLog = sqlite.prepare(
  "DELETE FROM error_log WHERE ts < ?"
);

function pruneOldErrorLogs() {
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  try {
    _pruneErrorLog.run(cutoff);
  } catch {
    // non-fatal
  }
}

// Run pruning on startup and then every hour
pruneOldErrorLogs();
setInterval(pruneOldErrorLogs, 60 * 60 * 1000).unref();

// Register log sink so logger.ts can insert warn/error entries into SQLite
registerLogSink((ts, level, module, message, errName, errStack) => {
  try {
    _insertErrorLog.run(ts, level, module, message, errName, errStack);
  } catch {
    // never throw from a log sink
  }
});

export const db = drizzle(sqlite);
