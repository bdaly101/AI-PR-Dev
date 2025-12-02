import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHmac } from 'crypto';
import Fastify, { FastifyInstance } from 'fastify';
import { Webhooks } from '@octokit/webhooks';
import prOpenedPayload from '../fixtures/github/pr-opened-payload.json';
import issueCommentPayload from '../fixtures/github/issue-comment-payload.json';

// Mock dependencies before importing modules that use them
vi.mock('../../src/services/reviewService', () => ({
  reviewService: {
    reviewPullRequest: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../src/services/devAgentService', () => ({
  devAgentService: {
    handleFixLints: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('Webhook Flow Integration', () => {
  let app: FastifyInstance;
  const webhookSecret = 'test-webhook-secret';

  // Helper to sign payloads
  function signPayload(payload: object): string {
    const hmac = createHmac('sha256', webhookSecret);
    hmac.update(JSON.stringify(payload));
    return `sha256=${hmac.digest('hex')}`;
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Create a minimal Fastify app with webhook endpoint
    app = Fastify({ logger: false });

    // Create webhooks instance
    const webhooks = new Webhooks({ secret: webhookSecret });
    
    // Import mocked services
    const { reviewService } = await import('../../src/services/reviewService');
    const { devAgentService } = await import('../../src/services/devAgentService');

    // Setup webhook handlers
    webhooks.on('pull_request.opened', async ({ payload }) => {
      if (payload.installation?.id) {
        await reviewService.reviewPullRequest(
          payload.repository.owner.login,
          payload.repository.name,
          payload.pull_request.number,
          payload.installation.id
        );
      }
    });

    webhooks.on('issue_comment.created', async ({ payload }) => {
      if (!payload.issue.pull_request || !payload.installation?.id) return;

      const comment = payload.comment.body.trim();
      if (comment.startsWith('/ai-fix-lints')) {
        await devAgentService.handleFixLints(
          payload.repository.owner.login,
          payload.repository.name,
          payload.issue.number,
          payload.installation.id
        );
      }
      if (comment.startsWith('/ai-review')) {
        await reviewService.reviewPullRequest(
          payload.repository.owner.login,
          payload.repository.name,
          payload.issue.number,
          payload.installation.id
        );
      }
    });

    // Register webhook endpoint
    app.post('/webhooks/github', async (request, reply) => {
      const signature = request.headers['x-hub-signature-256'] as string;
      const event = request.headers['x-github-event'] as string;
      const id = request.headers['x-github-delivery'] as string;

      if (!signature || !event || !id) {
        return reply.code(400).send({ error: 'Missing required headers' });
      }

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await webhooks.verifyAndReceive({
          id,
          name: event as any,
          signature,
          payload: JSON.stringify(request.body),
        });
        return reply.code(200).send({ received: true });
      } catch (error) {
        return reply.code(500).send({ error: 'Webhook verification failed' });
      }
    });

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Webhook validation', () => {
    it('should reject requests with missing headers', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/github',
        payload: prOpenedPayload,
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error).toContain('Missing required headers');
    });

    it('should reject requests with invalid signature', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/github',
        headers: {
          'x-github-event': 'pull_request',
          'x-github-delivery': 'test-delivery-id',
          'x-hub-signature-256': 'sha256=invalid',
          'content-type': 'application/json',
        },
        payload: prOpenedPayload,
      });

      expect(response.statusCode).toBe(500);
    });

    it('should accept requests with valid signature', async () => {
      const signature = signPayload(prOpenedPayload);

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/github',
        headers: {
          'x-github-event': 'pull_request',
          'x-github-delivery': 'test-delivery-id',
          'x-hub-signature-256': signature,
          'content-type': 'application/json',
        },
        payload: prOpenedPayload,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body).received).toBe(true);
    });
  });

  describe('pull_request.opened event', () => {
    it('should trigger review service', async () => {
      const { reviewService } = await import('../../src/services/reviewService');
      const signature = signPayload(prOpenedPayload);

      await app.inject({
        method: 'POST',
        url: '/webhooks/github',
        headers: {
          'x-github-event': 'pull_request',
          'x-github-delivery': 'test-delivery-id',
          'x-hub-signature-256': signature,
          'content-type': 'application/json',
        },
        payload: prOpenedPayload,
      });

      expect(reviewService.reviewPullRequest).toHaveBeenCalledWith(
        'test-owner',
        'test-repo',
        1,
        12345
      );
    });
  });

  describe('issue_comment.created event', () => {
    it('should trigger review on /ai-review command', async () => {
      const { reviewService } = await import('../../src/services/reviewService');
      const signature = signPayload(issueCommentPayload);

      await app.inject({
        method: 'POST',
        url: '/webhooks/github',
        headers: {
          'x-github-event': 'issue_comment',
          'x-github-delivery': 'test-delivery-id',
          'x-hub-signature-256': signature,
          'content-type': 'application/json',
        },
        payload: issueCommentPayload,
      });

      expect(reviewService.reviewPullRequest).toHaveBeenCalledWith(
        'test-owner',
        'test-repo',
        1,
        12345
      );
    });

    it('should trigger fix lints on /ai-fix-lints command', async () => {
      const { devAgentService } = await import('../../src/services/devAgentService');
      const fixLintsPayload = {
        ...issueCommentPayload,
        comment: {
          ...issueCommentPayload.comment,
          body: '/ai-fix-lints',
        },
      };
      const signature = signPayload(fixLintsPayload);

      await app.inject({
        method: 'POST',
        url: '/webhooks/github',
        headers: {
          'x-github-event': 'issue_comment',
          'x-github-delivery': 'test-delivery-id',
          'x-hub-signature-256': signature,
          'content-type': 'application/json',
        },
        payload: fixLintsPayload,
      });

      expect(devAgentService.handleFixLints).toHaveBeenCalledWith(
        'test-owner',
        'test-repo',
        1,
        12345
      );
    });

    it('should ignore comments on issues (not PRs)', async () => {
      const { reviewService } = await import('../../src/services/reviewService');
      const issueOnlyPayload = {
        ...issueCommentPayload,
        issue: {
          ...issueCommentPayload.issue,
          pull_request: undefined,
        },
      };
      const signature = signPayload(issueOnlyPayload);

      await app.inject({
        method: 'POST',
        url: '/webhooks/github',
        headers: {
          'x-github-event': 'issue_comment',
          'x-github-delivery': 'test-delivery-id',
          'x-hub-signature-256': signature,
          'content-type': 'application/json',
        },
        payload: issueOnlyPayload,
      });

      expect(reviewService.reviewPullRequest).not.toHaveBeenCalled();
    });
  });
});

