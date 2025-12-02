import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuditRepository } from '../../../../src/database/repositories/auditRepo';
import { initDatabase, closeDatabase } from '../../../../src/database/db';

describe('database/repositories/auditRepo', () => {
  let auditRepo: AuditRepository;

  beforeEach(() => {
    process.env.DATABASE_PATH = ':memory:';
    initDatabase();
    auditRepo = new AuditRepository();
  });

  afterEach(() => {
    closeDatabase();
  });

  describe('log', () => {
    it('should insert audit log record', () => {
      auditRepo.log({
        timestamp: '2024-01-15T10:00:00Z',
        action: 'pr_reviewed',
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 1,
        success: 1,
      });

      const logs = auditRepo.getLogs('test-owner', 'test-repo');
      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe('pr_reviewed');
    });

    it('should handle all optional fields', () => {
      auditRepo.log({
        timestamp: '2024-01-15T10:00:00Z',
        action: 'pr_reviewed',
        triggered_by: 'user',
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 1,
        pr_number: 2,
        files_changed: 'file1.ts,file2.ts',
        lines_added: 100,
        lines_deleted: 50,
        ai_model: 'gpt-4',
        success: 1,
        error_message: null,
      });

      const logs = auditRepo.getLogs('test-owner', 'test-repo');
      expect(logs[0].triggered_by).toBe('user');
      expect(logs[0].files_changed).toBe('file1.ts,file2.ts');
      expect(logs[0].ai_model).toBe('gpt-4');
    });

    it('should handle failure records', () => {
      auditRepo.log({
        timestamp: '2024-01-15T10:00:00Z',
        action: 'pr_review_failed',
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 1,
        success: 0,
        error_message: 'API timeout',
      });

      const logs = auditRepo.getLogs('test-owner', 'test-repo');
      expect(logs[0].success).toBe(0);
      expect(logs[0].error_message).toBe('API timeout');
    });

    it('should handle null optional fields', () => {
      auditRepo.log({
        timestamp: '2024-01-15T10:00:00Z',
        action: 'test_action',
        success: 1,
      });

      const logs = auditRepo.getLogsByAction('test_action');
      expect(logs).toHaveLength(1);
      expect(logs[0].owner).toBeNull();
    });
  });

  describe('getLogs', () => {
    beforeEach(() => {
      // Insert multiple logs
      for (let i = 1; i <= 10; i++) {
        auditRepo.log({
          timestamp: `2024-01-${String(i).padStart(2, '0')}T10:00:00Z`,
          action: `action_${i}`,
          owner: 'test-owner',
          repo: 'test-repo',
          success: 1,
        });
      }
    });

    it('should return logs ordered by timestamp descending', () => {
      const logs = auditRepo.getLogs('test-owner', 'test-repo');
      
      expect(logs.length).toBeGreaterThan(0);
      for (let i = 1; i < logs.length; i++) {
        expect(logs[i - 1].timestamp >= logs[i].timestamp).toBe(true);
      }
    });

    it('should respect limit parameter', () => {
      const logs = auditRepo.getLogs('test-owner', 'test-repo', 5);
      expect(logs).toHaveLength(5);
    });

    it('should use default limit of 100', () => {
      const logs = auditRepo.getLogs('test-owner', 'test-repo');
      expect(logs.length).toBeLessThanOrEqual(100);
    });

    it('should filter by owner and repo', () => {
      auditRepo.log({
        timestamp: '2024-01-15T10:00:00Z',
        action: 'other_action',
        owner: 'other-owner',
        repo: 'other-repo',
        success: 1,
      });

      const logs = auditRepo.getLogs('test-owner', 'test-repo');
      expect(logs.every(l => l.owner === 'test-owner' && l.repo === 'test-repo')).toBe(true);
    });
  });

  describe('getLogsByAction', () => {
    beforeEach(() => {
      auditRepo.log({
        timestamp: '2024-01-15T10:00:00Z',
        action: 'pr_reviewed',
        owner: 'owner1',
        repo: 'repo1',
        success: 1,
      });

      auditRepo.log({
        timestamp: '2024-01-16T10:00:00Z',
        action: 'pr_reviewed',
        owner: 'owner2',
        repo: 'repo2',
        success: 1,
      });

      auditRepo.log({
        timestamp: '2024-01-17T10:00:00Z',
        action: 'pr_created',
        owner: 'owner1',
        repo: 'repo1',
        success: 1,
      });
    });

    it('should return logs filtered by action', () => {
      const logs = auditRepo.getLogsByAction('pr_reviewed');
      expect(logs).toHaveLength(2);
      expect(logs.every(l => l.action === 'pr_reviewed')).toBe(true);
    });

    it('should return logs ordered by timestamp descending', () => {
      const logs = auditRepo.getLogsByAction('pr_reviewed');
      
      for (let i = 1; i < logs.length; i++) {
        expect(logs[i - 1].timestamp >= logs[i].timestamp).toBe(true);
      }
    });

    it('should respect limit parameter', () => {
      const logs = auditRepo.getLogsByAction('pr_reviewed', 1);
      expect(logs).toHaveLength(1);
    });

    it('should return empty array for non-existing action', () => {
      const logs = auditRepo.getLogsByAction('non_existing_action');
      expect(logs).toHaveLength(0);
    });
  });
});

