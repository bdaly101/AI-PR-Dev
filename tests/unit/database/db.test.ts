import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  initDatabase,
  getDatabase,
  closeDatabase,
} from '../../../src/database/db';

describe('database/db', () => {
  beforeEach(() => {
    // Ensure clean state
    closeDatabase();
    process.env.DATABASE_PATH = ':memory:';
  });

  afterEach(() => {
    closeDatabase();
  });

  describe('initDatabase', () => {
    it('should create database instance', () => {
      const db = initDatabase();
      expect(db).toBeDefined();
    });

    it('should create reviews table', () => {
      const db = initDatabase();
      const tables = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='reviews'"
        )
        .get();
      expect(tables).toBeDefined();
    });

    it('should create audit_logs table', () => {
      const db = initDatabase();
      const tables = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='audit_logs'"
        )
        .get();
      expect(tables).toBeDefined();
    });

    it('should create pr_context_cache table', () => {
      const db = initDatabase();
      const tables = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='pr_context_cache'"
        )
        .get();
      expect(tables).toBeDefined();
    });

    it('should create metrics table', () => {
      const db = initDatabase();
      const tables = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='metrics'"
        )
        .get();
      expect(tables).toBeDefined();
    });

    it('should create indexes', () => {
      const db = initDatabase();
      const indexes = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'"
        )
        .all();
      expect(indexes.length).toBeGreaterThan(0);
    });

    it('should return same instance when called multiple times', () => {
      const db1 = initDatabase();
      const db2 = initDatabase();
      expect(db1).toBe(db2);
    });

    it('should set journal mode (WAL for file, memory for in-memory)', () => {
      const db = initDatabase();
      const result = db.prepare('PRAGMA journal_mode').get() as { journal_mode: string };
      // In-memory databases use 'memory' mode, file-based use 'wal'
      expect(['wal', 'memory']).toContain(result.journal_mode);
    });
  });

  describe('getDatabase', () => {
    it('should return initialized database', () => {
      initDatabase();
      const db = getDatabase();
      expect(db).toBeDefined();
    });

    it('should initialize database if not already initialized', () => {
      const db = getDatabase();
      expect(db).toBeDefined();
    });
  });

  describe('closeDatabase', () => {
    it('should close database connection', () => {
      initDatabase();
      closeDatabase();
      // Re-initializing should work without errors
      const db = initDatabase();
      expect(db).toBeDefined();
    });

    it('should be safe to call multiple times', () => {
      initDatabase();
      closeDatabase();
      closeDatabase(); // Should not throw
    });

    it('should be safe to call without initialization', () => {
      closeDatabase(); // Should not throw
    });
  });

  describe('table schemas', () => {
    it('reviews table should have correct columns', () => {
      const db = initDatabase();
      const columns = db.prepare('PRAGMA table_info(reviews)').all() as Array<{
        name: string;
        type: string;
      }>;
      const columnNames = columns.map((c) => c.name);

      expect(columnNames).toContain('id');
      expect(columnNames).toContain('owner');
      expect(columnNames).toContain('repo');
      expect(columnNames).toContain('pull_number');
      expect(columnNames).toContain('commit_sha');
      expect(columnNames).toContain('reviewed_at');
      expect(columnNames).toContain('model_used');
      expect(columnNames).toContain('review_summary');
    });

    it('audit_logs table should have correct columns', () => {
      const db = initDatabase();
      const columns = db.prepare('PRAGMA table_info(audit_logs)').all() as Array<{
        name: string;
      }>;
      const columnNames = columns.map((c) => c.name);

      expect(columnNames).toContain('id');
      expect(columnNames).toContain('timestamp');
      expect(columnNames).toContain('action');
      expect(columnNames).toContain('owner');
      expect(columnNames).toContain('repo');
      expect(columnNames).toContain('success');
    });

    it('pr_context_cache table should have correct columns', () => {
      const db = initDatabase();
      const columns = db.prepare('PRAGMA table_info(pr_context_cache)').all() as Array<{
        name: string;
      }>;
      const columnNames = columns.map((c) => c.name);

      expect(columnNames).toContain('id');
      expect(columnNames).toContain('owner');
      expect(columnNames).toContain('repo');
      expect(columnNames).toContain('pull_number');
      expect(columnNames).toContain('commit_sha');
      expect(columnNames).toContain('context_data');
      expect(columnNames).toContain('created_at');
      expect(columnNames).toContain('expires_at');
    });

    it('metrics table should have correct columns', () => {
      const db = initDatabase();
      const columns = db.prepare('PRAGMA table_info(metrics)').all() as Array<{
        name: string;
      }>;
      const columnNames = columns.map((c) => c.name);

      expect(columnNames).toContain('id');
      expect(columnNames).toContain('date');
      expect(columnNames).toContain('owner');
      expect(columnNames).toContain('repo');
      expect(columnNames).toContain('reviews_count');
      expect(columnNames).toContain('reviews_failed');
    });
  });
});

