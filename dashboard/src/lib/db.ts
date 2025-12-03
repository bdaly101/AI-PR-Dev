import Database from "better-sqlite3";
import path from "path";

// Database path - connects to the main app's database
const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), "..", "data", "app.db");

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH, { readonly: true });
  }
  return db;
}

// Types for database records
export interface Review {
  id: number;
  owner: string;
  repo: string;
  pull_number: number;
  commit_sha: string;
  reviewed_at: string;
  model_used: string | null;
  review_summary: string | null;
}

export interface AuditLog {
  id: number;
  timestamp: string;
  action: string;
  triggered_by: string | null;
  owner: string | null;
  repo: string | null;
  pull_number: number | null;
  pr_number: number | null;
  files_changed: string | null;
  lines_added: number | null;
  lines_deleted: number | null;
  ai_model: string | null;
  success: number;
  error_message: string | null;
}

export interface Metrics {
  id: number;
  date: string;
  owner: string;
  repo: string;
  reviews_count: number;
  reviews_failed: number;
  total_files_reviewed: number;
  total_lines_reviewed: number;
  total_duration_ms: number;
  avg_duration_ms: number;
  ai_provider: string | null;
}

export interface ChangePlan {
  id: string;
  owner: string;
  repo: string;
  pull_number: number;
  triggered_by: string;
  plan_json: string;
  status: string;
  created_at: string;
  expires_at: string;
  comment_id: number | null;
  pr_number: number | null;
}

// Query functions
export function getReviews(options?: {
  owner?: string;
  repo?: string;
  limit?: number;
  offset?: number;
}): Review[] {
  const db = getDatabase();
  const { owner, repo, limit = 50, offset = 0 } = options || {};

  let query = "SELECT * FROM reviews";
  const params: (string | number)[] = [];
  const conditions: string[] = [];

  if (owner) {
    conditions.push("owner = ?");
    params.push(owner);
  }
  if (repo) {
    conditions.push("repo = ?");
    params.push(repo);
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }

  query += " ORDER BY reviewed_at DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  return db.prepare(query).all(...params) as Review[];
}

export function getAuditLogs(options?: {
  action?: string;
  owner?: string;
  repo?: string;
  limit?: number;
  offset?: number;
}): AuditLog[] {
  const db = getDatabase();
  const { action, owner, repo, limit = 100, offset = 0 } = options || {};

  let query = "SELECT * FROM audit_logs";
  const params: (string | number)[] = [];
  const conditions: string[] = [];

  if (action) {
    conditions.push("action LIKE ?");
    params.push(`%${action}%`);
  }
  if (owner) {
    conditions.push("owner = ?");
    params.push(owner);
  }
  if (repo) {
    conditions.push("repo = ?");
    params.push(repo);
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }

  query += " ORDER BY timestamp DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  return db.prepare(query).all(...params) as AuditLog[];
}

export function getMetricsSummary(options?: {
  owner?: string;
  repo?: string;
  days?: number;
}): {
  totalReviews: number;
  totalFailed: number;
  totalPRsCreated: number;
  avgDuration: number;
  reviewsByDay: { date: string; count: number }[];
} {
  const db = getDatabase();
  const { owner, repo, days = 30 } = options || {};

  const dateThreshold = new Date();
  dateThreshold.setDate(dateThreshold.getDate() - days);
  const dateStr = dateThreshold.toISOString().split("T")[0];

  let baseQuery = "FROM metrics WHERE date >= ?";
  const params: (string | number)[] = [dateStr];

  if (owner) {
    baseQuery += " AND owner = ?";
    params.push(owner);
  }
  if (repo) {
    baseQuery += " AND repo = ?";
    params.push(repo);
  }

  // Total reviews
  const totals = db
    .prepare(
      `SELECT 
        COALESCE(SUM(reviews_count), 0) as totalReviews,
        COALESCE(SUM(reviews_failed), 0) as totalFailed,
        COALESCE(AVG(avg_duration_ms), 0) as avgDuration
      ${baseQuery}`
    )
    .get(...params) as { totalReviews: number; totalFailed: number; avgDuration: number };

  // PRs created (from audit logs)
  let prQuery = `SELECT COUNT(*) as count FROM audit_logs 
    WHERE action = 'change_plan_executed' AND timestamp >= ?`;
  const prParams: (string | number)[] = [dateStr];

  if (owner) {
    prQuery += " AND owner = ?";
    prParams.push(owner);
  }
  if (repo) {
    prQuery += " AND repo = ?";
    prParams.push(repo);
  }

  const prsCreated = db.prepare(prQuery).get(...prParams) as { count: number };

  // Reviews by day
  const reviewsByDay = db
    .prepare(
      `SELECT date, SUM(reviews_count) as count ${baseQuery} GROUP BY date ORDER BY date`
    )
    .all(...params) as { date: string; count: number }[];

  return {
    totalReviews: totals.totalReviews,
    totalFailed: totals.totalFailed,
    totalPRsCreated: prsCreated.count,
    avgDuration: Math.round(totals.avgDuration),
    reviewsByDay,
  };
}

export function getRepositories(): { owner: string; repo: string; reviewCount: number }[] {
  const db = getDatabase();
  return db
    .prepare(
      `SELECT owner, repo, COUNT(*) as reviewCount 
       FROM reviews 
       GROUP BY owner, repo 
       ORDER BY reviewCount DESC`
    )
    .all() as { owner: string; repo: string; reviewCount: number }[];
}

export function getChangePlans(options?: {
  status?: string;
  owner?: string;
  repo?: string;
  limit?: number;
}): ChangePlan[] {
  const db = getDatabase();
  const { status, owner, repo, limit = 50 } = options || {};

  let query = "SELECT * FROM change_plans";
  const params: (string | number)[] = [];
  const conditions: string[] = [];

  if (status) {
    conditions.push("status = ?");
    params.push(status);
  }
  if (owner) {
    conditions.push("owner = ?");
    params.push(owner);
  }
  if (repo) {
    conditions.push("repo = ?");
    params.push(repo);
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }

  query += " ORDER BY created_at DESC LIMIT ?";
  params.push(limit);

  return db.prepare(query).all(...params) as ChangePlan[];
}

