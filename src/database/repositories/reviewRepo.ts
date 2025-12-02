import { getDatabase } from '../db';

export interface ReviewRecord {
  id?: number;
  owner: string;
  repo: string;
  pull_number: number;
  commit_sha: string;
  reviewed_at: string;
  model_used?: string;
  review_summary?: string;
}

export class ReviewRepository {
  /**
   * Check if a commit has already been reviewed
   */
  hasBeenReviewed(owner: string, repo: string, commitSha: string): boolean {
    const db = getDatabase();
    const stmt = db.prepare(
      'SELECT 1 FROM reviews WHERE owner = ? AND repo = ? AND commit_sha = ? LIMIT 1'
    );
    const result = stmt.get(owner, repo, commitSha);
    return result !== undefined;
  }

  /**
   * Record that a commit has been reviewed
   */
  recordReview(review: ReviewRecord): void {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO reviews 
        (owner, repo, pull_number, commit_sha, reviewed_at, model_used, review_summary)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      review.owner,
      review.repo,
      review.pull_number,
      review.commit_sha,
      review.reviewed_at,
      review.model_used || null,
      review.review_summary || null
    );
  }

  /**
   * Get review history for a repository
   */
  getReviewHistory(owner: string, repo: string, limit: number = 50): ReviewRecord[] {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM reviews 
      WHERE owner = ? AND repo = ?
      ORDER BY reviewed_at DESC
      LIMIT ?
    `);
    
    return stmt.all(owner, repo, limit) as ReviewRecord[];
  }

  /**
   * Get the latest review for a specific PR
   */
  getLatestReview(owner: string, repo: string, pullNumber: number): ReviewRecord | null {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM reviews 
      WHERE owner = ? AND repo = ? AND pull_number = ?
      ORDER BY reviewed_at DESC
      LIMIT 1
    `);
    
    const result = stmt.get(owner, repo, pullNumber) as ReviewRecord | undefined;
    return result || null;
  }
}

export const reviewRepo = new ReviewRepository();

