import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checksService, AI_REVIEW_CHECK_NAME } from '../../../src/services/checksService';
import { ReviewResponse } from '../../../src/validation/schemas';
import { PRContext } from '../../../src/github/prHelpers';
import { CIConfig } from '../../../src/config/repoConfig';

// Mock GitHubClient
const mockClient = {
  createCheckRun: vi.fn(),
  updateCheckRun: vi.fn(),
  listCheckRuns: vi.fn(),
};

// Sample review response
const mockReview: ReviewResponse = {
  summary: 'Good PR with minor issues',
  severity: 'warning',
  risks: [
    { category: 'bug', severity: 'medium', description: 'Potential null pointer' },
    { category: 'security', severity: 'high', description: 'SQL injection risk' },
  ],
  strengths: ['Clear code structure', 'Good test coverage'],
  suggestions: ['Add error handling', 'Consider caching'],
  inlineComments: [
    { path: 'src/index.ts', line: 10, body: 'Consider using const here' },
  ],
};

// Sample PR context
const mockContext: PRContext = {
  owner: 'testowner',
  repo: 'testrepo',
  pullNumber: 1,
  commitSha: 'abc123',
  title: 'Test PR',
  body: 'Test body',
  author: 'testuser',
  baseBranch: 'main',
  headBranch: 'feature/test',
  totalFiles: 5,
  reviewedFiles: 4,
  skippedFiles: 1,
  totalAdditions: 100,
  totalDeletions: 50,
  files: [
    { filename: 'src/index.ts', patch: '+ code', skipped: false, additions: 50, deletions: 25 },
    { filename: 'src/utils.ts', patch: '+ more code', skipped: false, additions: 50, deletions: 25 },
    { filename: 'package-lock.json', patch: '', skipped: true, additions: 0, deletions: 0, skipReason: 'ignored' },
  ],
  warnings: [],
  fromCache: false,
};

// Sample CI config
const defaultCIConfig: CIConfig = {
  enabled: true,
  postCheckRun: true,
  blockOnCritical: false,
  requiredForMerge: false,
};

describe('ChecksService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createInProgressCheck', () => {
    it('should create an in-progress check run', async () => {
      mockClient.createCheckRun.mockResolvedValue({ id: 12345 });

      const checkRunId = await checksService.createInProgressCheck(
        mockClient as any,
        'testowner',
        'testrepo',
        'abc123',
        1
      );

      expect(checkRunId).toBe(12345);
      expect(mockClient.createCheckRun).toHaveBeenCalledWith(
        'testowner',
        'testrepo',
        AI_REVIEW_CHECK_NAME,
        'abc123',
        expect.objectContaining({
          status: 'in_progress',
          output: expect.objectContaining({
            title: 'AI Review In Progress',
          }),
        })
      );
    });

    it('should throw on API error', async () => {
      mockClient.createCheckRun.mockRejectedValue(new Error('API Error'));

      await expect(
        checksService.createInProgressCheck(mockClient as any, 'owner', 'repo', 'sha', 1)
      ).rejects.toThrow('API Error');
    });
  });

  describe('completeCheckWithReview', () => {
    it('should complete check with success for info severity', async () => {
      const infoReview = { ...mockReview, severity: 'info' as const, risks: [] };
      mockClient.updateCheckRun.mockResolvedValue({ id: 12345, html_url: 'https://github.com/check/1' });

      const result = await checksService.completeCheckWithReview(
        mockClient as any,
        'testowner',
        'testrepo',
        12345,
        infoReview,
        mockContext,
        defaultCIConfig
      );

      expect(result.conclusion).toBe('success');
      expect(mockClient.updateCheckRun).toHaveBeenCalledWith(
        'testowner',
        'testrepo',
        12345,
        expect.objectContaining({
          status: 'completed',
          conclusion: 'success',
        })
      );
    });

    it('should complete check with success for warning severity when blocking disabled', async () => {
      mockClient.updateCheckRun.mockResolvedValue({ id: 12345, html_url: 'https://github.com/check/1' });

      const result = await checksService.completeCheckWithReview(
        mockClient as any,
        'testowner',
        'testrepo',
        12345,
        mockReview,
        mockContext,
        defaultCIConfig
      );

      // When blockOnCritical is false, only critical severity returns neutral
      expect(result.conclusion).toBe('success');
    });

    it('should complete check with neutral for critical severity when blocking disabled', async () => {
      const criticalReview = { ...mockReview, severity: 'critical' as const };
      mockClient.updateCheckRun.mockResolvedValue({ id: 12345, html_url: 'https://github.com/check/1' });

      const result = await checksService.completeCheckWithReview(
        mockClient as any,
        'testowner',
        'testrepo',
        12345,
        criticalReview,
        mockContext,
        defaultCIConfig
      );

      expect(result.conclusion).toBe('neutral');
    });

    it('should complete check with failure when blockOnCritical is enabled and has high risks', async () => {
      const criticalReview = { ...mockReview, severity: 'critical' as const };
      const blockingConfig = { ...defaultCIConfig, blockOnCritical: true };
      mockClient.updateCheckRun.mockResolvedValue({ id: 12345, html_url: 'https://github.com/check/1' });

      const result = await checksService.completeCheckWithReview(
        mockClient as any,
        'testowner',
        'testrepo',
        12345,
        criticalReview,
        mockContext,
        blockingConfig
      );

      expect(result.conclusion).toBe('failure');
    });

    it('should include annotations from inline comments', async () => {
      mockClient.updateCheckRun.mockResolvedValue({ id: 12345, html_url: 'https://github.com/check/1' });

      await checksService.completeCheckWithReview(
        mockClient as any,
        'testowner',
        'testrepo',
        12345,
        mockReview,
        mockContext,
        defaultCIConfig
      );

      expect(mockClient.updateCheckRun).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          output: expect.objectContaining({
            annotations: expect.arrayContaining([
              expect.objectContaining({
                path: 'src/index.ts',
                start_line: 10,
                annotation_level: 'warning',
              }),
            ]),
          }),
        })
      );
    });
  });

  describe('completeCheckWithError', () => {
    it('should complete check with failure and error message', async () => {
      mockClient.updateCheckRun.mockResolvedValue({});

      await checksService.completeCheckWithError(
        mockClient as any,
        'testowner',
        'testrepo',
        12345,
        'API rate limit exceeded'
      );

      expect(mockClient.updateCheckRun).toHaveBeenCalledWith(
        'testowner',
        'testrepo',
        12345,
        expect.objectContaining({
          status: 'completed',
          conclusion: 'failure',
          output: expect.objectContaining({
            title: 'AI Review Failed',
            summary: expect.stringContaining('API rate limit exceeded'),
          }),
        })
      );
    });
  });

  describe('completeCheckSkipped', () => {
    it('should complete check as skipped with reason', async () => {
      mockClient.updateCheckRun.mockResolvedValue({});

      await checksService.completeCheckSkipped(
        mockClient as any,
        'testowner',
        'testrepo',
        12345,
        'PR is too large'
      );

      expect(mockClient.updateCheckRun).toHaveBeenCalledWith(
        'testowner',
        'testrepo',
        12345,
        expect.objectContaining({
          status: 'completed',
          conclusion: 'skipped',
          output: expect.objectContaining({
            title: 'AI Review Skipped',
            summary: expect.stringContaining('PR is too large'),
          }),
        })
      );
    });
  });

  describe('findExistingCheckRun', () => {
    it('should return check run id if found', async () => {
      mockClient.listCheckRuns.mockResolvedValue({
        check_runs: [{ id: 99999 }],
      });

      const result = await checksService.findExistingCheckRun(
        mockClient as any,
        'testowner',
        'testrepo',
        'abc123'
      );

      expect(result).toBe(99999);
    });

    it('should return null if no check run found', async () => {
      mockClient.listCheckRuns.mockResolvedValue({
        check_runs: [],
      });

      const result = await checksService.findExistingCheckRun(
        mockClient as any,
        'testowner',
        'testrepo',
        'abc123'
      );

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      mockClient.listCheckRuns.mockRejectedValue(new Error('API Error'));

      const result = await checksService.findExistingCheckRun(
        mockClient as any,
        'testowner',
        'testrepo',
        'abc123'
      );

      expect(result).toBeNull();
    });
  });
});

