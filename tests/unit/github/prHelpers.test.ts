import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchPRContext,
  isPRTooLarge,
  generateLargePRSummary,
} from '../../../src/github/prHelpers';
import { GitHubClient } from '../../../src/github/client';
import { prContextRepo } from '../../../src/database/repositories/prContextRepo';
import { PR_LIMITS } from '../../../src/config/constants';

// Mock dependencies
vi.mock('../../../src/github/client');
vi.mock('../../../src/database/repositories/prContextRepo');

describe('github/prHelpers', () => {
  let mockClient: GitHubClient;

  const mockPRData = {
    number: 1,
    title: 'Test PR',
    body: 'Test description',
    user: { login: 'testuser' },
    base: { ref: 'main' },
    head: { ref: 'feature', sha: 'abc123' },
  };

  const mockFiles = [
    {
      filename: 'src/index.ts',
      status: 'modified',
      additions: 10,
      deletions: 5,
      changes: 15,
      patch: '+const x = 1;\n-const y = 2;',
    },
    {
      filename: 'src/utils.ts',
      status: 'added',
      additions: 20,
      deletions: 0,
      changes: 20,
      patch: '+export function helper() {}',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      getPullRequest: vi.fn().mockResolvedValue(mockPRData),
      getPullRequestFilesPaginated: vi.fn().mockResolvedValue(mockFiles),
    } as unknown as GitHubClient;

    vi.mocked(prContextRepo.getCachedContext).mockReturnValue(null);
    vi.mocked(prContextRepo.cacheContext).mockImplementation(() => {});
  });

  describe('fetchPRContext', () => {
    it('should fetch PR context successfully', async () => {
      const context = await fetchPRContext(
        mockClient,
        'owner',
        'repo',
        1
      );

      expect(context.owner).toBe('owner');
      expect(context.repo).toBe('repo');
      expect(context.pullNumber).toBe(1);
      expect(context.title).toBe('Test PR');
      expect(context.description).toBe('Test description');
      expect(context.author).toBe('testuser');
      expect(context.baseBranch).toBe('main');
      expect(context.headBranch).toBe('feature');
      expect(context.commitSha).toBe('abc123');
    });

    it('should calculate file statistics correctly', async () => {
      const context = await fetchPRContext(mockClient, 'owner', 'repo', 1);

      expect(context.totalFiles).toBe(2);
      expect(context.totalAdditions).toBe(30);
      expect(context.totalDeletions).toBe(5);
      expect(context.reviewedFiles).toBe(2);
    });

    it('should return cached context when available', async () => {
      const cachedContext = {
        owner: 'owner',
        repo: 'repo',
        pullNumber: 1,
        title: 'Cached PR',
        fromCache: false,
        // ... other required fields
      };

      vi.mocked(prContextRepo.getCachedContext).mockReturnValue({
        context_data: JSON.stringify(cachedContext),
      } as unknown as ReturnType<typeof prContextRepo.getCachedContext>);

      const context = await fetchPRContext(mockClient, 'owner', 'repo', 1, {
        useCache: true,
      });

      expect(context.fromCache).toBe(true);
      expect(mockClient.getPullRequestFilesPaginated).not.toHaveBeenCalled();
    });

    it('should skip cache when useCache is false', async () => {
      vi.mocked(prContextRepo.getCachedContext).mockReturnValue({
        context_data: JSON.stringify({ title: 'Cached' }),
      } as unknown as ReturnType<typeof prContextRepo.getCachedContext>);

      const context = await fetchPRContext(mockClient, 'owner', 'repo', 1, {
        useCache: false,
      });

      expect(context.fromCache).toBe(false);
      expect(context.title).toBe('Test PR');
    });

    it('should skip files matching ignore patterns', async () => {
      const filesWithIgnored = [
        ...mockFiles,
        {
          filename: 'package-lock.json',
          status: 'modified',
          additions: 1000,
          deletions: 500,
          changes: 1500,
          patch: 'huge diff...',
        },
      ];

      vi.mocked(mockClient.getPullRequestFilesPaginated).mockResolvedValue(filesWithIgnored);

      const context = await fetchPRContext(mockClient, 'owner', 'repo', 1, {
        ignorePatterns: ['package-lock.json'],
      });

      const skippedFile = context.files.find(f => f.filename === 'package-lock.json');
      expect(skippedFile?.skipped).toBe(true);
      expect(skippedFile?.skipReason).toContain('ignore pattern');
    });

    it('should skip binary files without patches', async () => {
      const filesWithBinary = [
        ...mockFiles,
        {
          filename: 'image.png',
          status: 'added',
          additions: 0,
          deletions: 0,
          changes: 0,
          // No patch for binary files
        },
      ];

      vi.mocked(mockClient.getPullRequestFilesPaginated).mockResolvedValue(filesWithBinary);

      const context = await fetchPRContext(mockClient, 'owner', 'repo', 1);

      const binaryFile = context.files.find(f => f.filename === 'image.png');
      expect(binaryFile?.skipped).toBe(true);
      expect(binaryFile?.skipReason).toContain('Binary');
    });

    it('should respect maxFiles limit', async () => {
      const manyFiles = Array.from({ length: 60 }, (_, i) => ({
        filename: `file${i}.ts`,
        status: 'modified',
        additions: 1,
        deletions: 0,
        changes: 1,
        patch: '+code',
      }));

      vi.mocked(mockClient.getPullRequestFilesPaginated).mockResolvedValue(manyFiles);

      const context = await fetchPRContext(mockClient, 'owner', 'repo', 1, {
        maxFiles: 50,
      });

      expect(context.reviewedFiles).toBeLessThanOrEqual(50);
      expect(context.warnings.some(w => w.includes('files'))).toBe(true);
    });

    it('should handle empty PR body', async () => {
      vi.mocked(mockClient.getPullRequest).mockResolvedValue({
        ...mockPRData,
        body: null,
      });

      const context = await fetchPRContext(mockClient, 'owner', 'repo', 1);

      expect(context.description).toBe('');
    });

    it('should handle unknown user', async () => {
      vi.mocked(mockClient.getPullRequest).mockResolvedValue({
        ...mockPRData,
        user: null,
      });

      const context = await fetchPRContext(mockClient, 'owner', 'repo', 1);

      expect(context.author).toBe('unknown');
    });

    it('should cache context after fetching', async () => {
      await fetchPRContext(mockClient, 'owner', 'repo', 1, {
        useCache: true,
      });

      expect(prContextRepo.cacheContext).toHaveBeenCalled();
    });

    it('should generate warnings for truncated files', async () => {
      // Create a file with a very large diff
      const largeFile = {
        filename: 'large.ts',
        status: 'modified',
        additions: 1000,
        deletions: 500,
        changes: 1500,
        patch: Array(PR_LIMITS.MAX_DIFF_LINES_PER_FILE + 100).fill('+line').join('\n'),
      };

      vi.mocked(mockClient.getPullRequestFilesPaginated).mockResolvedValue([largeFile]);

      const context = await fetchPRContext(mockClient, 'owner', 'repo', 1);

      const truncatedFile = context.files.find(f => f.filename === 'large.ts');
      expect(truncatedFile?.truncated).toBe(true);
      expect(context.warnings.some(w => w.includes('truncated'))).toBe(true);
    });
  });

  describe('isPRTooLarge', () => {
    it('should return true for PRs exceeding double the limit', () => {
      const context = {
        totalFiles: PR_LIMITS.MAX_FILES_PER_REVIEW * 2 + 1,
      } as Parameters<typeof isPRTooLarge>[0];

      expect(isPRTooLarge(context)).toBe(true);
    });

    it('should return false for PRs within limit', () => {
      const context = {
        totalFiles: PR_LIMITS.MAX_FILES_PER_REVIEW,
      } as Parameters<typeof isPRTooLarge>[0];

      expect(isPRTooLarge(context)).toBe(false);
    });

    it('should return false for PRs at exactly double the limit', () => {
      const context = {
        totalFiles: PR_LIMITS.MAX_FILES_PER_REVIEW * 2,
      } as Parameters<typeof isPRTooLarge>[0];

      expect(isPRTooLarge(context)).toBe(false);
    });
  });

  describe('generateLargePRSummary', () => {
    const largeContext = {
      totalFiles: 100,
      totalAdditions: 5000,
      totalDeletions: 1000,
      title: 'Large refactoring PR',
      author: 'developer',
      headBranch: 'feature/big-change',
      baseBranch: 'main',
    } as Parameters<typeof generateLargePRSummary>[0];

    it('should include file count', () => {
      const summary = generateLargePRSummary(largeContext);
      expect(summary).toContain('100 files');
    });

    it('should include line statistics', () => {
      const summary = generateLargePRSummary(largeContext);
      expect(summary).toContain('+5000/-1000');
    });

    it('should include PR title', () => {
      const summary = generateLargePRSummary(largeContext);
      expect(summary).toContain('Large refactoring PR');
    });

    it('should include author mention', () => {
      const summary = generateLargePRSummary(largeContext);
      expect(summary).toContain('@developer');
    });

    it('should include branch information', () => {
      const summary = generateLargePRSummary(largeContext);
      expect(summary).toContain('feature/big-change');
      expect(summary).toContain('main');
    });

    it('should recommend breaking into smaller PRs', () => {
      const summary = generateLargePRSummary(largeContext);
      expect(summary.toLowerCase()).toContain('smaller');
    });

    it('should include warning header', () => {
      const summary = generateLargePRSummary(largeContext);
      expect(summary).toContain('⚠️');
      expect(summary).toContain('Too Large');
    });
  });
});

