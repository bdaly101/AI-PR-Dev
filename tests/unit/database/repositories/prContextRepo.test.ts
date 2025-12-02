import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PRContextRepository } from '../../../../src/database/repositories/prContextRepo';
import { initDatabase, closeDatabase } from '../../../../src/database/db';

describe('database/repositories/prContextRepo', () => {
  let prContextRepo: PRContextRepository;

  beforeEach(() => {
    process.env.DATABASE_PATH = ':memory:';
    initDatabase();
    prContextRepo = new PRContextRepository();
  });

  afterEach(() => {
    closeDatabase();
  });

  describe('cacheContext', () => {
    it('should store context data', () => {
      const contextData = JSON.stringify({ title: 'Test PR', files: [] });
      
      prContextRepo.cacheContext(
        'test-owner',
        'test-repo',
        1,
        'abc123',
        contextData
      );

      const cached = prContextRepo.getCachedContext(
        'test-owner',
        'test-repo',
        1,
        'abc123'
      );

      expect(cached).not.toBeNull();
      expect(cached?.context_data).toBe(contextData);
    });

    it('should replace existing cache entry', () => {
      prContextRepo.cacheContext(
        'test-owner',
        'test-repo',
        1,
        'abc123',
        'original'
      );

      prContextRepo.cacheContext(
        'test-owner',
        'test-repo',
        1,
        'abc123',
        'updated'
      );

      const cached = prContextRepo.getCachedContext(
        'test-owner',
        'test-repo',
        1,
        'abc123'
      );

      expect(cached?.context_data).toBe('updated');
    });

    it('should set expiration time correctly', () => {
      const ttl = 3600; // 1 hour
      prContextRepo.cacheContext(
        'test-owner',
        'test-repo',
        1,
        'abc123',
        'data',
        ttl
      );

      const cached = prContextRepo.getCachedContext(
        'test-owner',
        'test-repo',
        1,
        'abc123'
      );

      expect(cached).not.toBeNull();
      const createdAt = new Date(cached!.created_at);
      const expiresAt = new Date(cached!.expires_at);
      const diff = (expiresAt.getTime() - createdAt.getTime()) / 1000;
      expect(diff).toBeCloseTo(ttl, 0);
    });
  });

  describe('getCachedContext', () => {
    it('should return null for non-existing entry', () => {
      const cached = prContextRepo.getCachedContext(
        'test-owner',
        'test-repo',
        1,
        'nonexistent'
      );

      expect(cached).toBeNull();
    });

    it('should return null for expired entry', () => {
      // Cache with TTL of 0 (immediately expired)
      prContextRepo.cacheContext(
        'test-owner',
        'test-repo',
        1,
        'abc123',
        'data',
        -1 // Negative TTL = already expired
      );

      const cached = prContextRepo.getCachedContext(
        'test-owner',
        'test-repo',
        1,
        'abc123'
      );

      expect(cached).toBeNull();
    });

    it('should match on owner, repo, pull_number, and commit_sha', () => {
      prContextRepo.cacheContext('owner1', 'repo1', 1, 'sha1', 'data1');
      prContextRepo.cacheContext('owner1', 'repo1', 2, 'sha2', 'data2');
      prContextRepo.cacheContext('owner2', 'repo2', 1, 'sha1', 'data3');

      expect(
        prContextRepo.getCachedContext('owner1', 'repo1', 1, 'sha1')?.context_data
      ).toBe('data1');
      expect(
        prContextRepo.getCachedContext('owner1', 'repo1', 2, 'sha2')?.context_data
      ).toBe('data2');
      expect(
        prContextRepo.getCachedContext('owner2', 'repo2', 1, 'sha1')?.context_data
      ).toBe('data3');
    });
  });

  describe('invalidateCache', () => {
    it('should remove all cache entries for a PR', () => {
      prContextRepo.cacheContext('owner', 'repo', 1, 'sha1', 'data1');
      prContextRepo.cacheContext('owner', 'repo', 1, 'sha2', 'data2');
      prContextRepo.cacheContext('owner', 'repo', 2, 'sha3', 'data3');

      prContextRepo.invalidateCache('owner', 'repo', 1);

      expect(prContextRepo.getCachedContext('owner', 'repo', 1, 'sha1')).toBeNull();
      expect(prContextRepo.getCachedContext('owner', 'repo', 1, 'sha2')).toBeNull();
      expect(prContextRepo.getCachedContext('owner', 'repo', 2, 'sha3')).not.toBeNull();
    });

    it('should not affect other repos', () => {
      prContextRepo.cacheContext('owner', 'repo1', 1, 'sha1', 'data1');
      prContextRepo.cacheContext('owner', 'repo2', 1, 'sha2', 'data2');

      prContextRepo.invalidateCache('owner', 'repo1', 1);

      expect(prContextRepo.getCachedContext('owner', 'repo2', 1, 'sha2')).not.toBeNull();
    });
  });

  describe('cleanupExpired', () => {
    it('should delete expired entries', () => {
      // Create expired entry
      prContextRepo.cacheContext('owner', 'repo', 1, 'expired', 'data', -1);
      // Create valid entry
      prContextRepo.cacheContext('owner', 'repo', 2, 'valid', 'data', 3600);

      const deleted = prContextRepo.cleanupExpired();

      expect(deleted).toBe(1);
      expect(prContextRepo.getCachedContext('owner', 'repo', 1, 'expired')).toBeNull();
      expect(prContextRepo.getCachedContext('owner', 'repo', 2, 'valid')).not.toBeNull();
    });

    it('should return count of deleted entries', () => {
      // Create multiple expired entries
      prContextRepo.cacheContext('owner', 'repo', 1, 'exp1', 'data', -1);
      prContextRepo.cacheContext('owner', 'repo', 2, 'exp2', 'data', -1);
      prContextRepo.cacheContext('owner', 'repo', 3, 'exp3', 'data', -1);

      const deleted = prContextRepo.cleanupExpired();

      expect(deleted).toBe(3);
    });

    it('should return 0 when no expired entries', () => {
      prContextRepo.cacheContext('owner', 'repo', 1, 'valid', 'data', 3600);

      const deleted = prContextRepo.cleanupExpired();

      expect(deleted).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return correct total entries count', () => {
      prContextRepo.cacheContext('owner', 'repo', 1, 'sha1', 'data', 3600);
      prContextRepo.cacheContext('owner', 'repo', 2, 'sha2', 'data', 3600);
      prContextRepo.cacheContext('owner', 'repo', 3, 'sha3', 'data', 3600);

      const stats = prContextRepo.getStats();

      expect(stats.totalEntries).toBe(3);
    });

    it('should return correct expired entries count', () => {
      prContextRepo.cacheContext('owner', 'repo', 1, 'valid', 'data', 3600);
      prContextRepo.cacheContext('owner', 'repo', 2, 'expired1', 'data', -1);
      prContextRepo.cacheContext('owner', 'repo', 3, 'expired2', 'data', -1);

      const stats = prContextRepo.getStats();

      expect(stats.totalEntries).toBe(3);
      expect(stats.expiredEntries).toBe(2);
    });

    it('should return zeros for empty database', () => {
      const stats = prContextRepo.getStats();

      expect(stats.totalEntries).toBe(0);
      expect(stats.expiredEntries).toBe(0);
    });
  });
});

