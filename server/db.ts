import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as fs from "fs";
import * as path from "path";

const dataDir = path.resolve("data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "app.db");
const sqlite = new Database(dbPath);

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
    console.log("[DB] Migrated conversations.visitor_id → user_id");
  }
} catch (err) {
  console.warn("[DB] Column migration check failed (non-fatal):", err);
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
`);

console.log(`[DB] SQLite database: ${dbPath}`);

export const db = drizzle(sqlite);
