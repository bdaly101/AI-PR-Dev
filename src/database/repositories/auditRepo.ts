import { getDatabase } from '../db';

export interface AuditLogRecord {
  id?: number;
  timestamp: string;
  action: string;
  triggered_by?: string;
  owner?: string;
  repo?: string;
  pull_number?: number;
  pr_number?: number;
  files_changed?: string;
  lines_added?: number;
  lines_deleted?: number;
  ai_model?: string;
  success: number;
  error_message?: string;
}

export class AuditRepository {
  /**
   * Log an audit event
   */
  log(record: AuditLogRecord): void {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO audit_logs 
        (timestamp, action, triggered_by, owner, repo, pull_number, pr_number, 
         files_changed, lines_added, lines_deleted, ai_model, success, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      record.timestamp,
      record.action,
      record.triggered_by || null,
      record.owner || null,
      record.repo || null,
      record.pull_number || null,
      record.pr_number || null,
      record.files_changed || null,
      record.lines_added || null,
      record.lines_deleted || null,
      record.ai_model || null,
      record.success,
      record.error_message || null
    );
  }

  /**
   * Get audit logs for a repository
   */
  getLogs(owner: string, repo: string, limit: number = 100): AuditLogRecord[] {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM audit_logs 
      WHERE owner = ? AND repo = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    
    return stmt.all(owner, repo, limit) as AuditLogRecord[];
  }

  /**
   * Get audit logs by action type
   */
  getLogsByAction(action: string, limit: number = 100): AuditLogRecord[] {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM audit_logs 
      WHERE action = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    
    return stmt.all(action, limit) as AuditLogRecord[];
  }
}

export const auditRepo = new AuditRepository();

