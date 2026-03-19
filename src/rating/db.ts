/** SQLite database init + migrations for rating system. */

import { Database } from "bun:sqlite";

let db: Database;

export function getDb(): Database {
  if (!db) {
    const dbPath = process.env.RATING_DB_PATH ?? "rating.db";
    db = new Database(dbPath, { create: true });
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA foreign_keys = ON");
    migrate(db);
  }
  return db;
}

function migrate(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS providers (
      id TEXT PRIMARY KEY,
      url TEXT UNIQUE NOT NULL,
      name TEXT,
      description TEXT,
      category TEXT,
      mpp_intents TEXT NOT NULL DEFAULT '[]',
      metadata TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ratings (
      id TEXT PRIMARY KEY,
      provider_id TEXT NOT NULL REFERENCES providers(id),
      payment_id TEXT UNIQUE NOT NULL,
      daimo_session_id TEXT NOT NULL,
      agent_id TEXT,
      overall_score INTEGER NOT NULL CHECK(overall_score BETWEEN 1 AND 5),
      speed_score INTEGER CHECK(speed_score BETWEEN 1 AND 5),
      quality_score INTEGER CHECK(quality_score BETWEEN 1 AND 5),
      value_score INTEGER CHECK(value_score BETWEEN 1 AND 5),
      reliability_score INTEGER CHECK(reliability_score BETWEEN 1 AND 5),
      comment TEXT,
      tags TEXT,
      use_case TEXT,
      amount_paid TEXT,
      mpp_intent TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      provider_url TEXT,
      payment_id TEXT,
      daimo_session_id TEXT,
      agent_wallet TEXT,
      amount TEXT,
      metadata TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
    CREATE INDEX IF NOT EXISTS idx_events_provider_url ON events(provider_url);
    CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);
    CREATE INDEX IF NOT EXISTS idx_ratings_provider_id ON ratings(provider_id);
    CREATE INDEX IF NOT EXISTS idx_ratings_created_at ON ratings(created_at);
  `);

  // FTS5 virtual table — separate try since it errors if already exists
  try {
    db.exec(`
      CREATE VIRTUAL TABLE providers_fts USING fts5(
        name, description, category,
        content=providers, content_rowid=rowid
      );
    `);
  } catch {
    // already exists
  }
}
