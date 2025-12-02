import { getDatabase } from '../db';

export interface DailyMetrics {
  date: string;
  owner: string;
  repo: string;
  reviews_count: number;
  reviews_failed: number;
  total_files_reviewed: number;
  total_lines_reviewed: number;
  total_duration_ms: number;
  avg_duration_ms: number;
  ai_provider?: string;
}

export interface MetricsSummary {
  totalReviews: number;
  totalFailed: number;
  successRate: number;
  avgDurationMs: number;
  totalFilesReviewed: number;
  totalLinesReviewed: number;
  reviewsByDay: Array<{ date: string; count: number }>;
}

export class MetricsRepository {
  /**
   * Record a successful review
   */
  recordReview(
    owner: string,
    repo: string,
    filesReviewed: number,
    linesReviewed: number,
    durationMs: number,
    aiProvider: string
  ): void {
    const db = getDatabase();
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    const stmt = db.prepare(`
      INSERT INTO metrics (date, owner, repo, reviews_count, reviews_failed, 
                          total_files_reviewed, total_lines_reviewed, 
                          total_duration_ms, avg_duration_ms, ai_provider)
      VALUES (?, ?, ?, 1, 0, ?, ?, ?, ?, ?)
      ON CONFLICT(date, owner, repo) DO UPDATE SET
        reviews_count = reviews_count + 1,
        total_files_reviewed = total_files_reviewed + excluded.total_files_reviewed,
        total_lines_reviewed = total_lines_reviewed + excluded.total_lines_reviewed,
        total_duration_ms = total_duration_ms + excluded.total_duration_ms,
        avg_duration_ms = (total_duration_ms + excluded.total_duration_ms) / (reviews_count + 1),
        ai_provider = excluded.ai_provider
    `);
    
    stmt.run(date, owner, repo, filesReviewed, linesReviewed, durationMs, durationMs, aiProvider);
  }

  /**
   * Record a failed review
   */
  recordFailure(owner: string, repo: string): void {
    const db = getDatabase();
    const date = new Date().toISOString().split('T')[0];
    
    const stmt = db.prepare(`
      INSERT INTO metrics (date, owner, repo, reviews_count, reviews_failed,
                          total_files_reviewed, total_lines_reviewed,
                          total_duration_ms, avg_duration_ms)
      VALUES (?, ?, ?, 0, 1, 0, 0, 0, 0)
      ON CONFLICT(date, owner, repo) DO UPDATE SET
        reviews_failed = reviews_failed + 1
    `);
    
    stmt.run(date, owner, repo);
  }

  /**
   * Get metrics for a specific repository
   */
  getRepoMetrics(owner: string, repo: string, days: number = 30): DailyMetrics[] {
    const db = getDatabase();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const stmt = db.prepare(`
      SELECT * FROM metrics 
      WHERE owner = ? AND repo = ? AND date >= ?
      ORDER BY date DESC
    `);
    
    return stmt.all(owner, repo, cutoffDate.toISOString().split('T')[0]) as DailyMetrics[];
  }

  /**
   * Get summary metrics for a repository
   */
  getRepoSummary(owner: string, repo: string, days: number = 30): MetricsSummary {
    const db = getDatabase();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];
    
    const summaryStmt = db.prepare(`
      SELECT 
        COALESCE(SUM(reviews_count), 0) as totalReviews,
        COALESCE(SUM(reviews_failed), 0) as totalFailed,
        COALESCE(AVG(avg_duration_ms), 0) as avgDurationMs,
        COALESCE(SUM(total_files_reviewed), 0) as totalFilesReviewed,
        COALESCE(SUM(total_lines_reviewed), 0) as totalLinesReviewed
      FROM metrics 
      WHERE owner = ? AND repo = ? AND date >= ?
    `);
    
    const summary = summaryStmt.get(owner, repo, cutoffStr) as {
      totalReviews: number;
      totalFailed: number;
      avgDurationMs: number;
      totalFilesReviewed: number;
      totalLinesReviewed: number;
    };

    const byDayStmt = db.prepare(`
      SELECT date, reviews_count as count
      FROM metrics 
      WHERE owner = ? AND repo = ? AND date >= ?
      ORDER BY date ASC
    `);
    
    const reviewsByDay = byDayStmt.all(owner, repo, cutoffStr) as Array<{ date: string; count: number }>;

    const totalAttempts = summary.totalReviews + summary.totalFailed;
    
    return {
      totalReviews: summary.totalReviews,
      totalFailed: summary.totalFailed,
      successRate: totalAttempts > 0 ? (summary.totalReviews / totalAttempts) * 100 : 100,
      avgDurationMs: Math.round(summary.avgDurationMs),
      totalFilesReviewed: summary.totalFilesReviewed,
      totalLinesReviewed: summary.totalLinesReviewed,
      reviewsByDay,
    };
  }

  /**
   * Get global metrics across all repositories
   */
  getGlobalSummary(days: number = 30): MetricsSummary & { topRepos: Array<{ owner: string; repo: string; count: number }> } {
    const db = getDatabase();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];
    
    const summaryStmt = db.prepare(`
      SELECT 
        COALESCE(SUM(reviews_count), 0) as totalReviews,
        COALESCE(SUM(reviews_failed), 0) as totalFailed,
        COALESCE(AVG(avg_duration_ms), 0) as avgDurationMs,
        COALESCE(SUM(total_files_reviewed), 0) as totalFilesReviewed,
        COALESCE(SUM(total_lines_reviewed), 0) as totalLinesReviewed
      FROM metrics 
      WHERE date >= ?
    `);
    
    const summary = summaryStmt.get(cutoffStr) as {
      totalReviews: number;
      totalFailed: number;
      avgDurationMs: number;
      totalFilesReviewed: number;
      totalLinesReviewed: number;
    };

    const byDayStmt = db.prepare(`
      SELECT date, SUM(reviews_count) as count
      FROM metrics 
      WHERE date >= ?
      GROUP BY date
      ORDER BY date ASC
    `);
    
    const reviewsByDay = byDayStmt.all(cutoffStr) as Array<{ date: string; count: number }>;

    const topReposStmt = db.prepare(`
      SELECT owner, repo, SUM(reviews_count) as count
      FROM metrics 
      WHERE date >= ?
      GROUP BY owner, repo
      ORDER BY count DESC
      LIMIT 10
    `);
    
    const topRepos = topReposStmt.all(cutoffStr) as Array<{ owner: string; repo: string; count: number }>;

    const totalAttempts = summary.totalReviews + summary.totalFailed;
    
    return {
      totalReviews: summary.totalReviews,
      totalFailed: summary.totalFailed,
      successRate: totalAttempts > 0 ? (summary.totalReviews / totalAttempts) * 100 : 100,
      avgDurationMs: Math.round(summary.avgDurationMs),
      totalFilesReviewed: summary.totalFilesReviewed,
      totalLinesReviewed: summary.totalLinesReviewed,
      reviewsByDay,
      topRepos,
    };
  }
}

export const metricsRepo = new MetricsRepository();

