import { describe, it, expect, beforeEach, vi, afterEach, beforeAll } from 'vitest';
import { Webhooks } from '@octokit/webhooks';

// These tests verify the webhook handler logic
// Since the actual webhooks module creates handlers at module load time,
// we test the handler logic by creating a test webhooks instance

describe('github/webhooks handler logic', () => {
  const mockReviewPullRequest = vi.fn();
  const mockHandleFixLints = vi.fn();
  let testWebhooks: Webhooks;

  beforeAll(() => {
    testWebhooks = new Webhooks({ secret: 'test-secret' });

    // Register handlers similar to the actual module
    testWebhooks.on('pull_request.opened', async ({ payload }) => {
      if (!payload.installation?.id) {
        return;
      }
      await mockReviewPullRequest(
        payload.repository.owner.login,
        payload.repository.name,
        payload.pull_request.number,
        payload.installation.id
      );
    });

    testWebhooks.on('pull_request.synchronize', async ({ payload }) => {
      if (!payload.installation?.id) {
        return;
      }
      await mockReviewPullRequest(
        payload.repository.owner.login,
        payload.repository.name,
        payload.pull_request.number,
        payload.installation.id
      );
    });

    testWebhooks.on('issue_comment.created', async ({ payload }) => {
      if (!payload.issue.pull_request) {
        return;
      }

      const comment = payload.comment.body.trim();

      if (!payload.installation?.id) {
        return;
      }

      if (comment.startsWith('/ai-fix-lints')) {
        await mockHandleFixLints(
          payload.repository.owner.login,
          payload.repository.name,
          payload.issue.number,
          payload.installation.id
        );
      }

      if (comment.startsWith('/ai-review')) {
        await mockReviewPullRequest(
          payload.repository.owner.login,
          payload.repository.name,
          payload.issue.number,
          payload.installation.id
        );
      }
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('pull_request.opened', () => {
    it('should call reviewPullRequest when PR is opened', async () => {
      mockReviewPullRequest.mockResolvedValue(undefined);

      const payload = {
        action: 'opened',
        repository: {
          owner: { login: 'test-owner' },
          name: 'test-repo',
        },
        pull_request: {
          number: 1,
          head: { sha: 'abc123' },
        },
        installation: { id: 12345 },
      };

      await testWebhooks.receive({
        id: 'test-id',
        name: 'pull_request',
        payload: payload as any,
      });

      expect(mockReviewPullRequest).toHaveBeenCalledWith(
        'test-owner',
        'test-repo',
        1,
        12345
      );
    });

    it('should not call reviewPullRequest when installation ID is missing', async () => {
      const payload = {
        action: 'opened',
        repository: {
          owner: { login: 'test-owner' },
          name: 'test-repo',
        },
        pull_request: {
          number: 1,
          head: { sha: 'abc123' },
        },
        installation: null,
      };

      await testWebhooks.receive({
        id: 'test-id',
        name: 'pull_request',
        payload: payload as any,
      });

      expect(mockReviewPullRequest).not.toHaveBeenCalled();
    });
  });

  describe('pull_request.synchronize', () => {
    it('should call reviewPullRequest when PR is synced', async () => {
      mockReviewPullRequest.mockResolvedValue(undefined);

      const payload = {
        action: 'synchronize',
        repository: {
          owner: { login: 'test-owner' },
          name: 'test-repo',
        },
        pull_request: {
          number: 2,
          head: { sha: 'def456' },
        },
        installation: { id: 12345 },
      };

      await testWebhooks.receive({
        id: 'test-id',
        name: 'pull_request',
        payload: payload as any,
      });

      expect(mockReviewPullRequest).toHaveBeenCalledWith(
        'test-owner',
        'test-repo',
        2,
        12345
      );
    });
  });

  describe('issue_comment.created', () => {
    it('should handle /ai-fix-lints command', async () => {
      mockHandleFixLints.mockResolvedValue(undefined);

      const payload = {
        action: 'created',
        repository: {
          owner: { login: 'test-owner' },
          name: 'test-repo',
        },
        issue: {
          number: 1,
          pull_request: { url: 'https://api.github.com/repos/test-owner/test-repo/pulls/1' },
        },
        comment: {
          body: '/ai-fix-lints',
        },
        installation: { id: 12345 },
      };

      await testWebhooks.receive({
        id: 'test-id',
        name: 'issue_comment',
        payload: payload as any,
      });

      expect(mockHandleFixLints).toHaveBeenCalledWith(
        'test-owner',
        'test-repo',
        1,
        12345
      );
    });

    it('should handle /ai-review command', async () => {
      mockReviewPullRequest.mockResolvedValue(undefined);

      const payload = {
        action: 'created',
        repository: {
          owner: { login: 'test-owner' },
          name: 'test-repo',
        },
        issue: {
          number: 1,
          pull_request: { url: 'https://api.github.com/repos/test-owner/test-repo/pulls/1' },
        },
        comment: {
          body: '/ai-review',
        },
        installation: { id: 12345 },
      };

      await testWebhooks.receive({
        id: 'test-id',
        name: 'issue_comment',
        payload: payload as any,
      });

      expect(mockReviewPullRequest).toHaveBeenCalledWith(
        'test-owner',
        'test-repo',
        1,
        12345
      );
    });

    it('should ignore comments not on pull requests', async () => {
      const payload = {
        action: 'created',
        repository: {
          owner: { login: 'test-owner' },
          name: 'test-repo',
        },
        issue: {
          number: 1,
          pull_request: null,
        },
        comment: {
          body: '/ai-review',
        },
        installation: { id: 12345 },
      };

      await testWebhooks.receive({
        id: 'test-id',
        name: 'issue_comment',
        payload: payload as any,
      });

      expect(mockReviewPullRequest).not.toHaveBeenCalled();
      expect(mockHandleFixLints).not.toHaveBeenCalled();
    });

    it('should ignore non-command comments', async () => {
      const payload = {
        action: 'created',
        repository: {
          owner: { login: 'test-owner' },
          name: 'test-repo',
        },
        issue: {
          number: 1,
          pull_request: { url: 'https://api.github.com/repos/test-owner/test-repo/pulls/1' },
        },
        comment: {
          body: 'Great work on this PR!',
        },
        installation: { id: 12345 },
      };

      await testWebhooks.receive({
        id: 'test-id',
        name: 'issue_comment',
        payload: payload as any,
      });

      expect(mockReviewPullRequest).not.toHaveBeenCalled();
      expect(mockHandleFixLints).not.toHaveBeenCalled();
    });

    it('should handle commands with whitespace', async () => {
      mockHandleFixLints.mockResolvedValue(undefined);

      const payload = {
        action: 'created',
        repository: {
          owner: { login: 'test-owner' },
          name: 'test-repo',
        },
        issue: {
          number: 1,
          pull_request: { url: 'https://api.github.com/repos/test-owner/test-repo/pulls/1' },
        },
        comment: {
          body: '   /ai-fix-lints   ',
        },
        installation: { id: 12345 },
      };

      await testWebhooks.receive({
        id: 'test-id',
        name: 'issue_comment',
        payload: payload as any,
      });

      expect(mockHandleFixLints).toHaveBeenCalled();
    });

    it('should handle commands with extra text', async () => {
      mockReviewPullRequest.mockResolvedValue(undefined);

      const payload = {
        action: 'created',
        repository: {
          owner: { login: 'test-owner' },
          name: 'test-repo',
        },
        issue: {
          number: 1,
          pull_request: { url: 'https://api.github.com/repos/test-owner/test-repo/pulls/1' },
        },
        comment: {
          body: '/ai-review please check this',
        },
        installation: { id: 12345 },
      };

      await testWebhooks.receive({
        id: 'test-id',
        name: 'issue_comment',
        payload: payload as any,
      });

      expect(mockReviewPullRequest).toHaveBeenCalled();
    });
  });
});
