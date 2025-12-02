import { describe, it, expect, beforeEach, vi, afterAll, beforeAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';

// Mock dependencies
const mockVerifyAndReceive = vi.fn();
const mockLoggerInfo = vi.fn();
const mockLoggerError = vi.fn();

vi.mock('../../../src/github/webhooks', () => ({
  webhooks: {
    verifyAndReceive: mockVerifyAndReceive,
  },
}));

vi.mock('../../../src/config/env', () => ({
  config: {
    server: {
      port: 3001,
    },
    github: {
      webhookSecret: 'test-secret',
    },
  },
}));

vi.mock('../../../src/database/db', () => ({
  initDatabase: vi.fn(),
  closeDatabase: vi.fn(),
}));

vi.mock('../../../src/utils/logging', () => ({
  createLogger: vi.fn().mockReturnValue({
    child: vi.fn().mockReturnThis(),
    info: mockLoggerInfo,
    error: mockLoggerError,
    warn: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
  }),
  logWebhook: vi.fn().mockReturnValue({
    info: mockLoggerInfo,
    error: mockLoggerError,
    warn: vi.fn(),
  }),
  logError: vi.fn(),
}));

// Build a test server similar to the main index.ts but without starting it
async function buildTestServer(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: false, // Disable logging for tests
  });

  // Health check endpoint
  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Webhook endpoint
  fastify.post('/webhooks/github', async (request, reply) => {
    const signature = request.headers['x-hub-signature-256'] as string;
    const event = request.headers['x-github-event'] as string;
    const id = request.headers['x-github-delivery'] as string;

    if (!signature || !event || !id) {
      reply.code(400).send({ error: 'Missing required headers' });
      return;
    }

    try {
      await mockVerifyAndReceive({
        id,
        name: event as any,
        signature,
        payload: JSON.stringify(request.body),
      });

      reply.code(200).send({ received: true });
    } catch (error) {
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  return fastify;
}

describe('server/index', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await buildTestServer();
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('ok');
      expect(body.timestamp).toBeDefined();
    });

    it('should return ISO timestamp', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/health',
      });

      const body = JSON.parse(response.body);
      // Check if timestamp is valid ISO format
      expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
    });
  });

  describe('POST /webhooks/github', () => {
    const validHeaders = {
      'x-hub-signature-256': 'sha256=valid-signature',
      'x-github-event': 'pull_request',
      'x-github-delivery': 'test-delivery-id',
      'content-type': 'application/json',
    };

    it('should return 400 when signature header is missing', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/webhooks/github',
        headers: {
          'x-github-event': 'pull_request',
          'x-github-delivery': 'test-id',
          'content-type': 'application/json',
        },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Missing required headers');
    });

    it('should return 400 when event header is missing', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/webhooks/github',
        headers: {
          'x-hub-signature-256': 'sha256=test',
          'x-github-delivery': 'test-id',
          'content-type': 'application/json',
        },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Missing required headers');
    });

    it('should return 400 when delivery header is missing', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/webhooks/github',
        headers: {
          'x-hub-signature-256': 'sha256=test',
          'x-github-event': 'pull_request',
          'content-type': 'application/json',
        },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Missing required headers');
    });

    it('should process valid webhook successfully', async () => {
      mockVerifyAndReceive.mockResolvedValue(undefined);

      const payload = {
        action: 'opened',
        pull_request: { number: 1 },
        repository: { name: 'test-repo' },
      };

      const response = await server.inject({
        method: 'POST',
        url: '/webhooks/github',
        headers: validHeaders,
        payload,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.received).toBe(true);

      expect(mockVerifyAndReceive).toHaveBeenCalledWith({
        id: 'test-delivery-id',
        name: 'pull_request',
        signature: 'sha256=valid-signature',
        payload: JSON.stringify(payload),
      });
    });

    it('should return 500 on webhook verification failure', async () => {
      mockVerifyAndReceive.mockRejectedValue(new Error('Invalid signature'));

      const response = await server.inject({
        method: 'POST',
        url: '/webhooks/github',
        headers: validHeaders,
        payload: { test: true },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Internal server error');
    });

    it('should handle different event types', async () => {
      mockVerifyAndReceive.mockResolvedValue(undefined);

      const events = ['pull_request', 'issue_comment', 'push', 'ping'];

      for (const event of events) {
        const response = await server.inject({
          method: 'POST',
          url: '/webhooks/github',
          headers: {
            ...validHeaders,
            'x-github-event': event,
          },
          payload: { action: 'test' },
        });

        expect(response.statusCode).toBe(200);
      }

      expect(mockVerifyAndReceive).toHaveBeenCalledTimes(events.length);
    });

    it('should pass payload as string to verifyAndReceive', async () => {
      mockVerifyAndReceive.mockResolvedValue(undefined);

      const payload = { complex: { nested: { data: [1, 2, 3] } } };

      await server.inject({
        method: 'POST',
        url: '/webhooks/github',
        headers: validHeaders,
        payload,
      });

      expect(mockVerifyAndReceive).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: JSON.stringify(payload),
        })
      );
    });
  });

  describe('404 handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/unknown-route',
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 for wrong methods on existing routes', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/health',
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
