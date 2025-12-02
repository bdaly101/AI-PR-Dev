import Database from 'better-sqlite3';
import { config } from '../config/env';
import * as path from 'path';
import * as fs from 'fs';

let db: Database.Database | null = null;

export function initDatabase(): Database.Database {
  if (db) {
    return db;
  }

  // Ensure data directory exists
  const dbPath = config.database.path;
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // Initialize database
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL'); // Better concurrency

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner TEXT NOT NULL,
      repo TEXT NOT NULL,
      pull_number INTEGER NOT NULL,
      commit_sha TEXT NOT NULL,
      reviewed_at TEXT NOT NULL,
      model_used TEXT,
      review_summary TEXT,
      UNIQUE(owner, repo, commit_sha)
    );

    CREATE INDEX IF NOT EXISTS idx_reviews_repo_commit 
      ON reviews(owner, repo, commit_sha);

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      action TEXT NOT NULL,
      triggered_by TEXT,
      owner TEXT,
      repo TEXT,
      pull_number INTEGER,
      pr_number INTEGER,
      files_changed TEXT,
      lines_added INTEGER,
      lines_deleted INTEGER,
      ai_model TEXT,
      success INTEGER NOT NULL DEFAULT 1,
      error_message TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp 
      ON audit_logs(timestamp);

    CREATE INDEX IF NOT EXISTS idx_audit_logs_repo 
      ON audit_logs(owner, repo);
  `);

  return db;
}

export function getDatabase(): Database.Database {
  if (!db) {
    return initDatabase();
  }
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

