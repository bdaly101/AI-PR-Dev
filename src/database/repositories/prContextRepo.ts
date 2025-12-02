import { getDatabase } from '../db';
import { PR_LIMITS } from '../../config/constants';

export interface CachedPRContext {
  id?: number;
  owner: string;
  repo: string;
  pull_number: number;
  commit_sha: string;
  context_data: string;
  created_at: string;
  expires_at: string;
}

export class PRContextRepository {
  /**
   * Get cached PR context if it exists and hasn't expired
   */
  getCachedContext(
    owner: string,
    repo: string,
    pullNumber: number,
    commitSha: string
  ): CachedPRContext | null {
    const db = getDatabase();
    const now = new Date().toISOString();
    
    const stmt = db.prepare(`
      SELECT * FROM pr_context_cache 
      WHERE owner = ? AND repo = ? AND pull_number = ? AND commit_sha = ?
        AND expires_at > ?
      LIMIT 1
    `);
    
    const result = stmt.get(owner, repo, pullNumber, commitSha, now) as CachedPRContext | undefined;
    return result || null;
  }

  /**
   * Cache PR context data
   */
  cacheContext(
    owner: string,
    repo: string,
    pullNumber: number,
    commitSha: string,
    contextData: string,
    ttlSeconds: number = PR_LIMITS.PR_CONTEXT_CACHE_TTL
  ): void {
    const db = getDatabase();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
    
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO pr_context_cache 
        (owner, repo, pull_number, commit_sha, context_data, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      owner,
      repo,
      pullNumber,
      commitSha,
      contextData,
      now.toISOString(),
      expiresAt.toISOString()
    );
  }

  /**
   * Delete expired cache entries
   */
  cleanupExpired(): number {
    const db = getDatabase();
    const now = new Date().toISOString();
    
    const stmt = db.prepare(`
      DELETE FROM pr_context_cache WHERE expires_at < ?
    `);
    
    const result = stmt.run(now);
    return result.changes;
  }

  /**
   * Invalidate cache for a specific PR (useful when PR is updated)
   */
  invalidateCache(owner: string, repo: string, pullNumber: number): void {
    const db = getDatabase();
    
    const stmt = db.prepare(`
      DELETE FROM pr_context_cache 
      WHERE owner = ? AND repo = ? AND pull_number = ?
    `);
    
    stmt.run(owner, repo, pullNumber);
  }

  /**
   * Get cache statistics
   */
  getStats(): { totalEntries: number; expiredEntries: number } {
    const db = getDatabase();
    const now = new Date().toISOString();
    
    const totalStmt = db.prepare('SELECT COUNT(*) as count FROM pr_context_cache');
    const expiredStmt = db.prepare('SELECT COUNT(*) as count FROM pr_context_cache WHERE expires_at < ?');
    
    const total = (totalStmt.get() as { count: number }).count;
    const expired = (expiredStmt.get(now) as { count: number }).count;
    
    return { totalEntries: total, expiredEntries: expired };
  }
}

export const prContextRepo = new PRContextRepository();

