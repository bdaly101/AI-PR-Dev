import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GitHubClient } from '../../../src/github/client';
import { aiReviewer } from '../../../src/ai/reviewer';
import * as prHelpers from '../../../src/github/prHelpers';
import { reviewRepo } from '../../../src/database/repositories/reviewRepo';
import { auditRepo } from '../../../src/database/repositories/auditRepo';
import validReviewResponse from '../../fixtures/ai/review-response-valid.json';

// Mock all dependencies
vi.mock('../../../src/github/client');
vi.mock('../../../src/ai/reviewer');
vi.mock('../../../src/github/prHelpers');
vi.mock('../../../src/database/repositories/reviewRepo');
vi.mock('../../../src/database/repositories/auditRepo');

// Import after mocking
import { reviewService } from '../../../src/services/reviewService';

describe('services/reviewService', () => {
  let mockClient: GitHubClient;

  const mockPRContext: prHelpers.PRContext = {
    owner: 'test-owner',
    repo: 'test-repo',
    pullNumber: 1,
    title: 'Test PR',
    description: 'Test description',
    author: 'testuser',
    baseBranch: 'main',
    headBranch: 'feature',
    commitSha: 'abc123',
    totalFiles: 2,
    totalAdditions: 50,
    totalDeletions: 10,
    reviewedFiles: 2,
    skippedFiles: 0,
    truncatedFiles: 0,
    files: [
      {
        filename: 'src/test.ts',
        status: 'modified',
        additions: 50,
        deletions: 10,
        changes: 60,
        truncated: false,
        skipped: false,
      },
    ],
    formattedDiff: '+const x = 1;',
    warnings: [],
    fromCache: false,
    fetchedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup mock client
    mockClient = {
      createReview: vi.fn().mockResolvedValue(undefined),
      createIssueComment: vi.fn().mockResolvedValue(undefined),
      addLabels: vi.fn().mockResolvedValue(undefined),
    } as unknown as GitHubClient;

    // Mock GitHubClient constructor
    vi.mocked(GitHubClient).mockImplementation(() => mockClient);

    // Setup default mock behaviors
    vi.mocked(prHelpers.fetchPRContext).mockResolvedValue(mockPRContext);
    vi.mocked(prHelpers.isPRTooLarge).mockReturnValue(false);
    vi.mocked(reviewRepo.hasBeenReviewed).mockReturnValue(false);
    vi.mocked(reviewRepo.recordReview).mockImplementation(() => {});
    vi.mocked(auditRepo.log).mockImplementation(() => {});
    vi.mocked(aiReviewer.reviewPullRequestContext).mockResolvedValue({
      review: validReviewResponse as unknown as ReturnType<typeof aiReviewer.reviewPullRequestContext> extends Promise<infer R> ? R['review'] : never,
      provider: 'openai',
      model: 'gpt-4',
      durationMs: 1000,
    } as Awaited<ReturnType<typeof aiReviewer.reviewPullRequestContext>>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('reviewPullRequest', () => {
    it('should complete full review flow successfully', async () => {
      await reviewService.reviewPullRequest('owner', 'repo', 1, 12345);

      // Should fetch PR context
      expect(prHelpers.fetchPRContext).toHaveBeenCalledWith(
        expect.any(Object),
        'owner',
        'repo',
        1,
        expect.any(Object)
      );

      // Should call AI reviewer
      expect(aiReviewer.reviewPullRequestContext).toHaveBeenCalled();

      // Should post review
      expect(mockClient.createReview).toHaveBeenCalled();

      // Should add label
      expect(mockClient.addLabels).toHaveBeenCalledWith(
        'owner',
        'repo',
        1,
        ['ai-reviewed']
      );

      // Should record in database
      expect(reviewRepo.recordReview).toHaveBeenCalled();
      expect(auditRepo.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'pr_reviewed',
          success: 1,
        })
      );
    });

    it('should skip review for already reviewed commits', async () => {
      vi.mocked(reviewRepo.hasBeenReviewed).mockReturnValue(true);

      await reviewService.reviewPullRequest('owner', 'repo', 1, 12345);

      expect(aiReviewer.reviewPullRequestContext).not.toHaveBeenCalled();
      expect(mockClient.createReview).not.toHaveBeenCalled();
    });

    it('should handle PRs that are too large', async () => {
      vi.mocked(prHelpers.isPRTooLarge).mockReturnValue(true);
      vi.mocked(prHelpers.generateLargePRSummary).mockReturnValue('PR is too large');

      await reviewService.reviewPullRequest('owner', 'repo', 1, 12345);

      expect(aiReviewer.reviewPullRequestContext).not.toHaveBeenCalled();
      expect(mockClient.createIssueComment).toHaveBeenCalledWith(
        'owner',
        'repo',
        1,
        'PR is too large'
      );
      expect(reviewRepo.recordReview).toHaveBeenCalledWith(
        expect.objectContaining({
          model_used: 'skipped-too-large',
        })
      );
    });

    it('should handle PRs with no reviewable files', async () => {
      vi.mocked(prHelpers.fetchPRContext).mockResolvedValue({
        ...mockPRContext,
        reviewedFiles: 0,
      });

      await reviewService.reviewPullRequest('owner', 'repo', 1, 12345);

      expect(aiReviewer.reviewPullRequestContext).not.toHaveBeenCalled();
      expect(mockClient.createIssueComment).toHaveBeenCalledWith(
        'owner',
        'repo',
        1,
        expect.stringContaining('No reviewable')
      );
    });

    it('should continue if label addition fails', async () => {
      vi.mocked(mockClient.addLabels).mockRejectedValue(new Error('Label error'));

      await reviewService.reviewPullRequest('owner', 'repo', 1, 12345);

      // Should still complete successfully
      expect(reviewRepo.recordReview).toHaveBeenCalled();
    });

    it('should post error comment on AI failure', async () => {
      vi.mocked(aiReviewer.reviewPullRequestContext).mockRejectedValue(
        new Error('AI error')
      );

      await reviewService.reviewPullRequest('owner', 'repo', 1, 12345);

      expect(mockClient.createIssueComment).toHaveBeenCalledWith(
        'owner',
        'repo',
        1,
        expect.stringContaining('Failed to generate')
      );

      expect(auditRepo.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'pr_review_failed',
          success: 0,
        })
      );
    });

    it('should filter inline comments to reviewed files only', async () => {
      const contextWithMultipleFiles = {
        ...mockPRContext,
        files: [
          { filename: 'reviewed.ts', skipped: false, additions: 10, deletions: 0, changes: 10, truncated: false, status: 'modified' as const },
          { filename: 'skipped.ts', skipped: true, additions: 5, deletions: 0, changes: 5, truncated: false, status: 'modified' as const },
        ],
      };
      vi.mocked(prHelpers.fetchPRContext).mockResolvedValue(contextWithMultipleFiles);

      const reviewWithMultipleComments = {
        ...validReviewResponse,
        inlineComments: [
          { path: 'reviewed.ts', line: 1, body: 'Good' },
          { path: 'skipped.ts', line: 1, body: 'Should not appear' },
          { path: 'unknown.ts', line: 1, body: 'Also filtered' },
        ],
      };
      vi.mocked(aiReviewer.reviewPullRequestContext).mockResolvedValue({
        review: reviewWithMultipleComments as Awaited<ReturnType<typeof aiReviewer.reviewPullRequestContext>>['review'],
        provider: 'openai',
        model: 'gpt-4',
        durationMs: 1000,
      });

      await reviewService.reviewPullRequest('owner', 'repo', 1, 12345);

      expect(mockClient.createReview).toHaveBeenCalledWith(
        'owner',
        'repo',
        1,
        expect.any(String),
        'COMMENT',
        expect.arrayContaining([
          expect.objectContaining({ path: 'reviewed.ts' }),
        ])
      );

      const reviewCall = vi.mocked(mockClient.createReview).mock.calls[0];
      const comments = reviewCall[4] as Array<{ path: string; line: number; body: string }> | undefined;
      // Check that skipped files are not in comments
      const hasSkippedFile = comments && Array.isArray(comments) 
        ? comments.some((c) => c.path === 'skipped.ts')
        : false;
      expect(hasSkippedFile).toBe(false);
    });
  });

  describe('formatReviewBody', () => {
    it('should include summary', async () => {
      await reviewService.reviewPullRequest('owner', 'repo', 1, 12345);

      const reviewCall = vi.mocked(mockClient.createReview).mock.calls[0];
      const body = reviewCall[3];
      
      expect(body).toContain('Summary');
      expect(body).toContain(validReviewResponse.summary);
    });

    it('should include severity with emoji', async () => {
      await reviewService.reviewPullRequest('owner', 'repo', 1, 12345);

      const reviewCall = vi.mocked(mockClient.createReview).mock.calls[0];
      const body = reviewCall[3];
      
      expect(body).toContain('WARNING');
      expect(body).toMatch(/🟡|🟢|🔴/);
    });

    it('should include strengths section', async () => {
      await reviewService.reviewPullRequest('owner', 'repo', 1, 12345);

      const reviewCall = vi.mocked(mockClient.createReview).mock.calls[0];
      const body = reviewCall[3];
      
      expect(body).toContain('Strengths');
      expect(body).toContain('✅');
    });

    it('should include risks section', async () => {
      await reviewService.reviewPullRequest('owner', 'repo', 1, 12345);

      const reviewCall = vi.mocked(mockClient.createReview).mock.calls[0];
      const body = reviewCall[3];
      
      expect(body).toContain('Risks');
      expect(body).toContain('⚠️');
    });

    it('should include suggestions section', async () => {
      await reviewService.reviewPullRequest('owner', 'repo', 1, 12345);

      const reviewCall = vi.mocked(mockClient.createReview).mock.calls[0];
      const body = reviewCall[3];
      
      expect(body).toContain('Suggestions');
      expect(body).toContain('💡');
    });

    it('should include stats table', async () => {
      await reviewService.reviewPullRequest('owner', 'repo', 1, 12345);

      const reviewCall = vi.mocked(mockClient.createReview).mock.calls[0];
      const body = reviewCall[3];
      
      expect(body).toContain('Stats');
      expect(body).toContain('Files Reviewed');
    });

    it('should include warnings when present', async () => {
      vi.mocked(prHelpers.fetchPRContext).mockResolvedValue({
        ...mockPRContext,
        warnings: ['Some files were skipped'],
      });

      await reviewService.reviewPullRequest('owner', 'repo', 1, 12345);

      const reviewCall = vi.mocked(mockClient.createReview).mock.calls[0];
      const body = reviewCall[3];
      
      expect(body).toContain('Review Notes');
      expect(body).toContain('files were skipped');
    });

    it('should include model attribution in footer', async () => {
      await reviewService.reviewPullRequest('owner', 'repo', 1, 12345);

      const reviewCall = vi.mocked(mockClient.createReview).mock.calls[0];
      const body = reviewCall[3];
      
      expect(body).toContain('gpt-4');
      expect(body).toContain('Generated by AI');
    });
  });
});
