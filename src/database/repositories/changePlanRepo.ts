import { getDatabase } from '../db';
import { StoredChangePlan, ChangePlan, ChangePlanStatus } from '../../ai/changePlan';
import { logger } from '../../utils/logging';

/**
 * Repository for managing stored change plans
 */
class ChangePlanRepository {
  /**
   * Initialize the change_plans table
   */
  initTable(): void {
    const db = getDatabase();
    db.exec(`
      CREATE TABLE IF NOT EXISTS change_plans (
        id TEXT PRIMARY KEY,
        owner TEXT NOT NULL,
        repo TEXT NOT NULL,
        pull_number INTEGER NOT NULL,
        comment_id INTEGER NOT NULL,
        triggered_by TEXT NOT NULL,
        command TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        plan_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        approved_by TEXT,
        approved_at TEXT,
        result_pr_number INTEGER,
        error TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_change_plans_repo 
        ON change_plans(owner, repo, pull_number);
      
      CREATE INDEX IF NOT EXISTS idx_change_plans_status 
        ON change_plans(status);
      
      CREATE INDEX IF NOT EXISTS idx_change_plans_comment 
        ON change_plans(comment_id);
    `);
  }

  /**
   * Store a new change plan
   */
  create(plan: StoredChangePlan): void {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO change_plans (
        id, owner, repo, pull_number, comment_id, triggered_by, command,
        status, plan_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      plan.id,
      plan.owner,
      plan.repo,
      plan.pullNumber,
      plan.commentId,
      plan.triggeredBy,
      plan.command,
      plan.status,
      JSON.stringify(plan.plan),
      plan.createdAt,
      plan.updatedAt
    );

    logger.debug({ planId: plan.id }, 'Change plan stored');
  }

  /**
   * Get a change plan by ID
   */
  getById(id: string): StoredChangePlan | null {
    const db = getDatabase();
    const stmt = db.prepare(`SELECT * FROM change_plans WHERE id = ?`);
    const row = stmt.get(id) as Record<string, unknown> | undefined;

    if (!row) {
      return null;
    }

    return this.rowToStoredPlan(row);
  }

  /**
   * Get a change plan by comment ID
   */
  getByCommentId(commentId: number): StoredChangePlan | null {
    const db = getDatabase();
    const stmt = db.prepare(`SELECT * FROM change_plans WHERE comment_id = ?`);
    const row = stmt.get(commentId) as Record<string, unknown> | undefined;

    if (!row) {
      return null;
    }

    return this.rowToStoredPlan(row);
  }

  /**
   * Get pending plans for a PR
   */
  getPendingForPR(owner: string, repo: string, pullNumber: number): StoredChangePlan[] {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM change_plans 
      WHERE owner = ? AND repo = ? AND pull_number = ? AND status = 'pending'
      ORDER BY created_at DESC
    `);
    const rows = stmt.all(owner, repo, pullNumber) as Record<string, unknown>[];

    return rows.map(row => this.rowToStoredPlan(row));
  }

  /**
   * Update plan status
   */
  updateStatus(
    id: string,
    status: ChangePlanStatus,
    updates?: {
      approvedBy?: string;
      approvedAt?: string;
      resultPrNumber?: number;
      error?: string;
    }
  ): void {
    const db = getDatabase();
    let query = `UPDATE change_plans SET status = ?, updated_at = ?`;
    const params: (string | number | null)[] = [status, new Date().toISOString()];

    if (updates?.approvedBy) {
      query += `, approved_by = ?`;
      params.push(updates.approvedBy);
    }
    if (updates?.approvedAt) {
      query += `, approved_at = ?`;
      params.push(updates.approvedAt);
    }
    if (updates?.resultPrNumber) {
      query += `, result_pr_number = ?`;
      params.push(updates.resultPrNumber);
    }
    if (updates?.error) {
      query += `, error = ?`;
      params.push(updates.error);
    }

    query += ` WHERE id = ?`;
    params.push(id);

    const stmt = db.prepare(query);
    stmt.run(...params);

    logger.debug({ planId: id, status }, 'Change plan status updated');
  }

  /**
   * Get expired pending plans (older than 24 hours)
   */
  getExpiredPlans(): StoredChangePlan[] {
    const db = getDatabase();
    const expiryTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const stmt = db.prepare(`
      SELECT * FROM change_plans 
      WHERE status = 'pending' AND created_at < ?
    `);
    const rows = stmt.all(expiryTime) as Record<string, unknown>[];

    return rows.map(row => this.rowToStoredPlan(row));
  }

  /**
   * Expire old pending plans
   */
  expireOldPlans(): number {
    const db = getDatabase();
    const expiryTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const stmt = db.prepare(`
      UPDATE change_plans 
      SET status = 'rejected', updated_at = ?, error = 'Expired after 24 hours'
      WHERE status = 'pending' AND created_at < ?
    `);
    const result = stmt.run(new Date().toISOString(), expiryTime);

    if (result.changes > 0) {
      logger.info({ expiredCount: result.changes }, 'Expired old change plans');
    }

    return result.changes;
  }

  /**
   * Convert database row to StoredChangePlan
   */
  private rowToStoredPlan(row: Record<string, unknown>): StoredChangePlan {
    return {
      id: row.id as string,
      owner: row.owner as string,
      repo: row.repo as string,
      pullNumber: row.pull_number as number,
      commentId: row.comment_id as number,
      triggeredBy: row.triggered_by as string,
      command: row.command as string,
      status: row.status as ChangePlanStatus,
      plan: JSON.parse(row.plan_json as string) as ChangePlan,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
      approvedBy: row.approved_by as string | undefined,
      approvedAt: row.approved_at as string | undefined,
      resultPrNumber: row.result_pr_number as number | undefined,
      error: row.error as string | undefined,
    };
  }
}

export const changePlanRepo = new ChangePlanRepository();

