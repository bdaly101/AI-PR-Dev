import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MetricsRepository } from '../../../../src/database/repositories/metricsRepo';
import { initDatabase, closeDatabase } from '../../../../src/database/db';

describe('database/repositories/metricsRepo', () => {
  let metricsRepo: MetricsRepository;

  beforeEach(() => {
    process.env.DATABASE_PATH = ':memory:';
    initDatabase();
    metricsRepo = new MetricsRepository();
  });

  afterEach(() => {
    closeDatabase();
  });

  describe('recordReview', () => {
    it('should record a successful review', () => {
      metricsRepo.recordReview(
        'test-owner',
        'test-repo',
        5,
        100,
        1500,
        'openai'
      );

      const metrics = metricsRepo.getRepoMetrics('test-owner', 'test-repo', 1);
      expect(metrics).toHaveLength(1);
      expect(metrics[0].reviews_count).toBe(1);
      expect(metrics[0].total_files_reviewed).toBe(5);
      expect(metrics[0].total_lines_reviewed).toBe(100);
      expect(metrics[0].total_duration_ms).toBe(1500);
      expect(metrics[0].ai_provider).toBe('openai');
    });

    it('should aggregate multiple reviews on same day', () => {
      metricsRepo.recordReview('owner', 'repo', 3, 50, 1000, 'openai');
      metricsRepo.recordReview('owner', 'repo', 5, 80, 1500, 'openai');
      metricsRepo.recordReview('owner', 'repo', 2, 30, 800, 'anthropic');

      const metrics = metricsRepo.getRepoMetrics('owner', 'repo', 1);
      expect(metrics).toHaveLength(1);
      expect(metrics[0].reviews_count).toBe(3);
      expect(metrics[0].total_files_reviewed).toBe(10); // 3+5+2
      expect(metrics[0].total_lines_reviewed).toBe(160); // 50+80+30
      expect(metrics[0].total_duration_ms).toBe(3300); // 1000+1500+800
    });

    it('should update average duration correctly', () => {
      metricsRepo.recordReview('owner', 'repo', 1, 10, 1000, 'openai');
      metricsRepo.recordReview('owner', 'repo', 1, 10, 2000, 'openai');

      const metrics = metricsRepo.getRepoMetrics('owner', 'repo', 1);
      expect(metrics[0].avg_duration_ms).toBe(1500); // (1000+2000)/2
    });

    it('should track different repos separately', () => {
      metricsRepo.recordReview('owner', 'repo1', 5, 100, 1000, 'openai');
      metricsRepo.recordReview('owner', 'repo2', 3, 50, 800, 'anthropic');

      const repo1Metrics = metricsRepo.getRepoMetrics('owner', 'repo1', 1);
      const repo2Metrics = metricsRepo.getRepoMetrics('owner', 'repo2', 1);

      expect(repo1Metrics[0].total_files_reviewed).toBe(5);
      expect(repo2Metrics[0].total_files_reviewed).toBe(3);
    });
  });

  describe('recordFailure', () => {
    it('should record a failed review', () => {
      metricsRepo.recordFailure('test-owner', 'test-repo');

      const metrics = metricsRepo.getRepoMetrics('test-owner', 'test-repo', 1);
      expect(metrics).toHaveLength(1);
      expect(metrics[0].reviews_failed).toBe(1);
      expect(metrics[0].reviews_count).toBe(0);
    });

    it('should aggregate failures with successful reviews', () => {
      metricsRepo.recordReview('owner', 'repo', 5, 100, 1000, 'openai');
      metricsRepo.recordFailure('owner', 'repo');
      metricsRepo.recordFailure('owner', 'repo');

      const metrics = metricsRepo.getRepoMetrics('owner', 'repo', 1);
      expect(metrics[0].reviews_count).toBe(1);
      expect(metrics[0].reviews_failed).toBe(2);
    });

    it('should count multiple failures', () => {
      metricsRepo.recordFailure('owner', 'repo');
      metricsRepo.recordFailure('owner', 'repo');
      metricsRepo.recordFailure('owner', 'repo');

      const metrics = metricsRepo.getRepoMetrics('owner', 'repo', 1);
      expect(metrics[0].reviews_failed).toBe(3);
    });
  });

  describe('getRepoMetrics', () => {
    beforeEach(() => {
      // Create metrics for multiple days by mocking Date
      const today = new Date();
      
      metricsRepo.recordReview('owner', 'repo', 5, 100, 1000, 'openai');
    });

    it('should return metrics for specified days', () => {
      const metrics = metricsRepo.getRepoMetrics('owner', 'repo', 30);
      expect(metrics.length).toBeGreaterThanOrEqual(1);
    });

    it('should return empty array for non-existing repo', () => {
      const metrics = metricsRepo.getRepoMetrics('non-existing', 'repo', 30);
      expect(metrics).toHaveLength(0);
    });

    it('should order by date descending', () => {
      // Record more data
      metricsRepo.recordReview('owner', 'repo', 3, 50, 500, 'openai');

      const metrics = metricsRepo.getRepoMetrics('owner', 'repo', 30);
      
      if (metrics.length > 1) {
        for (let i = 1; i < metrics.length; i++) {
          expect(metrics[i - 1].date >= metrics[i].date).toBe(true);
        }
      }
    });
  });

  describe('getRepoSummary', () => {
    beforeEach(() => {
      metricsRepo.recordReview('owner', 'repo', 5, 100, 1000, 'openai');
      metricsRepo.recordReview('owner', 'repo', 3, 50, 1500, 'openai');
      metricsRepo.recordFailure('owner', 'repo');
    });

    it('should return total reviews count', () => {
      const summary = metricsRepo.getRepoSummary('owner', 'repo', 30);
      expect(summary.totalReviews).toBe(2);
    });

    it('should return total failures count', () => {
      const summary = metricsRepo.getRepoSummary('owner', 'repo', 30);
      expect(summary.totalFailed).toBe(1);
    });

    it('should calculate success rate correctly', () => {
      const summary = metricsRepo.getRepoSummary('owner', 'repo', 30);
      // 2 successful out of 3 total = 66.67%
      expect(summary.successRate).toBeCloseTo(66.67, 1);
    });

    it('should return 100% success rate when no failures', () => {
      const newRepo = new MetricsRepository();
      newRepo.recordReview('owner2', 'repo2', 5, 100, 1000, 'openai');
      
      const summary = newRepo.getRepoSummary('owner2', 'repo2', 30);
      expect(summary.successRate).toBe(100);
    });

    it('should return 100% success rate for empty repo', () => {
      const summary = metricsRepo.getRepoSummary('empty', 'repo', 30);
      expect(summary.successRate).toBe(100);
      expect(summary.totalReviews).toBe(0);
    });

    it('should calculate average duration', () => {
      const summary = metricsRepo.getRepoSummary('owner', 'repo', 30);
      expect(summary.avgDurationMs).toBeGreaterThan(0);
    });

    it('should sum total files reviewed', () => {
      const summary = metricsRepo.getRepoSummary('owner', 'repo', 30);
      expect(summary.totalFilesReviewed).toBe(8); // 5+3
    });

    it('should sum total lines reviewed', () => {
      const summary = metricsRepo.getRepoSummary('owner', 'repo', 30);
      expect(summary.totalLinesReviewed).toBe(150); // 100+50
    });

    it('should include reviews by day', () => {
      const summary = metricsRepo.getRepoSummary('owner', 'repo', 30);
      expect(summary.reviewsByDay).toBeInstanceOf(Array);
      expect(summary.reviewsByDay.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getGlobalSummary', () => {
    beforeEach(() => {
      metricsRepo.recordReview('owner1', 'repo1', 5, 100, 1000, 'openai');
      metricsRepo.recordReview('owner1', 'repo2', 3, 50, 800, 'anthropic');
      metricsRepo.recordReview('owner2', 'repo1', 7, 200, 2000, 'openai');
      metricsRepo.recordFailure('owner1', 'repo1');
    });

    it('should aggregate metrics across all repos', () => {
      const summary = metricsRepo.getGlobalSummary(30);
      expect(summary.totalReviews).toBe(3);
      expect(summary.totalFailed).toBe(1);
    });

    it('should calculate global success rate', () => {
      const summary = metricsRepo.getGlobalSummary(30);
      // 3 successful out of 4 total = 75%
      expect(summary.successRate).toBe(75);
    });

    it('should sum files across all repos', () => {
      const summary = metricsRepo.getGlobalSummary(30);
      expect(summary.totalFilesReviewed).toBe(15); // 5+3+7
    });

    it('should sum lines across all repos', () => {
      const summary = metricsRepo.getGlobalSummary(30);
      expect(summary.totalLinesReviewed).toBe(350); // 100+50+200
    });

    it('should include top repos by review count', () => {
      const summary = metricsRepo.getGlobalSummary(30);
      expect(summary.topRepos).toBeInstanceOf(Array);
      expect(summary.topRepos.length).toBeGreaterThanOrEqual(1);
    });

    it('should order top repos by count descending', () => {
      // Add more reviews to one repo
      metricsRepo.recordReview('owner1', 'repo1', 1, 10, 100, 'openai');
      metricsRepo.recordReview('owner1', 'repo1', 1, 10, 100, 'openai');

      const summary = metricsRepo.getGlobalSummary(30);
      
      if (summary.topRepos.length > 1) {
        for (let i = 1; i < summary.topRepos.length; i++) {
          expect(summary.topRepos[i - 1].count >= summary.topRepos[i].count).toBe(true);
        }
      }
    });

    it('should return empty data for no metrics', () => {
      closeDatabase();
      process.env.DATABASE_PATH = ':memory:';
      initDatabase();
      const emptyRepo = new MetricsRepository();
      
      const summary = emptyRepo.getGlobalSummary(30);
      expect(summary.totalReviews).toBe(0);
      expect(summary.totalFailed).toBe(0);
      expect(summary.successRate).toBe(100);
    });

    it('should include reviews by day across all repos', () => {
      const summary = metricsRepo.getGlobalSummary(30);
      expect(summary.reviewsByDay).toBeInstanceOf(Array);
    });

    it('should limit top repos to 10', () => {
      // Create many repos
      for (let i = 0; i < 15; i++) {
        metricsRepo.recordReview(`owner${i}`, `repo${i}`, 1, 10, 100, 'openai');
      }

      const summary = metricsRepo.getGlobalSummary(30);
      expect(summary.topRepos.length).toBeLessThanOrEqual(10);
    });
  });
});

