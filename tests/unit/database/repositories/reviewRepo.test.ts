import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ReviewRepository } from '../../../../src/database/repositories/reviewRepo';
import { initDatabase, closeDatabase } from '../../../../src/database/db';

describe('database/repositories/reviewRepo', () => {
  let reviewRepo: ReviewRepository;

  beforeEach(() => {
    process.env.DATABASE_PATH = ':memory:';
    initDatabase();
    reviewRepo = new ReviewRepository();
  });

  afterEach(() => {
    closeDatabase();
  });

  describe('recordReview', () => {
    it('should insert a new review record', () => {
      reviewRepo.recordReview({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 1,
        commit_sha: 'abc123',
        reviewed_at: '2024-01-15T10:00:00Z',
        model_used: 'gpt-4',
        review_summary: 'Test review',
      });

      const review = reviewRepo.getLatestReview('test-owner', 'test-repo', 1);
      expect(review).not.toBeNull();
      expect(review?.commit_sha).toBe('abc123');
      expect(review?.model_used).toBe('gpt-4');
    });

    it('should replace existing review for same commit', () => {
      reviewRepo.recordReview({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 1,
        commit_sha: 'abc123',
        reviewed_at: '2024-01-15T10:00:00Z',
        review_summary: 'First review',
      });

      reviewRepo.recordReview({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 1,
        commit_sha: 'abc123',
        reviewed_at: '2024-01-15T11:00:00Z',
        review_summary: 'Updated review',
      });

      const review = reviewRepo.getLatestReview('test-owner', 'test-repo', 1);
      expect(review?.review_summary).toBe('Updated review');
    });

    it('should handle null optional fields', () => {
      reviewRepo.recordReview({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 1,
        commit_sha: 'abc123',
        reviewed_at: '2024-01-15T10:00:00Z',
      });

      const review = reviewRepo.getLatestReview('test-owner', 'test-repo', 1);
      expect(review?.model_used).toBeNull();
      expect(review?.review_summary).toBeNull();
    });
  });

  describe('hasBeenReviewed', () => {
    it('should return true for existing commit', () => {
      reviewRepo.recordReview({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 1,
        commit_sha: 'abc123',
        reviewed_at: '2024-01-15T10:00:00Z',
      });

      expect(
        reviewRepo.hasBeenReviewed('test-owner', 'test-repo', 'abc123')
      ).toBe(true);
    });

    it('should return false for non-existing commit', () => {
      expect(
        reviewRepo.hasBeenReviewed('test-owner', 'test-repo', 'nonexistent')
      ).toBe(false);
    });

    it('should be case-sensitive for commit sha', () => {
      reviewRepo.recordReview({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 1,
        commit_sha: 'ABC123',
        reviewed_at: '2024-01-15T10:00:00Z',
      });

      expect(
        reviewRepo.hasBeenReviewed('test-owner', 'test-repo', 'abc123')
      ).toBe(false);
      expect(
        reviewRepo.hasBeenReviewed('test-owner', 'test-repo', 'ABC123')
      ).toBe(true);
    });

    it('should check owner and repo correctly', () => {
      reviewRepo.recordReview({
        owner: 'owner1',
        repo: 'repo1',
        pull_number: 1,
        commit_sha: 'abc123',
        reviewed_at: '2024-01-15T10:00:00Z',
      });

      expect(reviewRepo.hasBeenReviewed('owner1', 'repo1', 'abc123')).toBe(true);
      expect(reviewRepo.hasBeenReviewed('owner2', 'repo1', 'abc123')).toBe(false);
      expect(reviewRepo.hasBeenReviewed('owner1', 'repo2', 'abc123')).toBe(false);
    });
  });

  describe('getLatestReview', () => {
    it('should return latest review for PR', () => {
      reviewRepo.recordReview({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 1,
        commit_sha: 'abc123',
        reviewed_at: '2024-01-15T10:00:00Z',
      });

      reviewRepo.recordReview({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 1,
        commit_sha: 'def456',
        reviewed_at: '2024-01-15T12:00:00Z',
      });

      const latest = reviewRepo.getLatestReview('test-owner', 'test-repo', 1);
      expect(latest?.commit_sha).toBe('def456');
    });

    it('should return null for non-existing PR', () => {
      const review = reviewRepo.getLatestReview('test-owner', 'test-repo', 999);
      expect(review).toBeNull();
    });
  });

  describe('getReviewHistory', () => {
    beforeEach(() => {
      // Insert multiple reviews
      for (let i = 1; i <= 10; i++) {
        reviewRepo.recordReview({
          owner: 'test-owner',
          repo: 'test-repo',
          pull_number: i,
          commit_sha: `sha${i}`,
          reviewed_at: `2024-01-${String(i).padStart(2, '0')}T10:00:00Z`,
        });
      }
    });

    it('should return reviews ordered by date descending', () => {
      const history = reviewRepo.getReviewHistory('test-owner', 'test-repo');
      
      expect(history.length).toBeGreaterThan(0);
      for (let i = 1; i < history.length; i++) {
        expect(history[i - 1].reviewed_at >= history[i].reviewed_at).toBe(true);
      }
    });

    it('should respect limit parameter', () => {
      const history = reviewRepo.getReviewHistory('test-owner', 'test-repo', 5);
      expect(history).toHaveLength(5);
    });

    it('should use default limit of 50', () => {
      const history = reviewRepo.getReviewHistory('test-owner', 'test-repo');
      expect(history.length).toBeLessThanOrEqual(50);
    });

    it('should return empty array for non-existing repo', () => {
      const history = reviewRepo.getReviewHistory('non-existing', 'repo');
      expect(history).toHaveLength(0);
    });
  });
});

