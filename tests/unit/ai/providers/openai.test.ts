import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock all dependencies at module level without external references
const mockCreate = vi.fn();

vi.mock('openai', () => {
  class MockAPIError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.name = 'APIError';
      this.status = status;
    }
  }

  const MockOpenAI = vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  }));
  
  (MockOpenAI as any).APIError = MockAPIError;

  return { default: MockOpenAI };
});

vi.mock('../../../../src/config/env', () => ({
  config: {
    openai: {
      apiKey: 'test-openai-key',
    },
  },
}));

vi.mock('../../../../src/utils/logging', () => ({
  logger: {
    child: vi.fn().mockReturnValue({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

vi.mock('../../../../src/config/constants', () => ({
  AI_DEFAULTS: {
    REVIEW_MODEL: 'gpt-4',
    REVIEW_TEMPERATURE: 0.3,
    MAX_REVIEW_TOKENS: 4096,
  },
}));

// Import after mocking
import { callOpenAI, isOpenAIAvailable } from '../../../../src/ai/providers/openai';

describe('ai/providers/openai', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('callOpenAI', () => {
    it('should call OpenAI API successfully', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: '{"test": "response"}' } }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      });

      const result = await callOpenAI('You are a helpful assistant', 'Hello');

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are a helpful assistant' },
          { role: 'user', content: 'Hello' },
        ],
        temperature: 0.3,
        max_tokens: 4096,
        response_format: { type: 'json_object' },
      });
      expect(result).toBe('{"test": "response"}');
    });

    it('should use custom options', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: '{}' } }],
        usage: {},
      });

      await callOpenAI('System prompt', 'User prompt', {
        model: 'gpt-3.5-turbo',
        temperature: 0.7,
        maxTokens: 2048,
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-3.5-turbo',
          temperature: 0.7,
          max_tokens: 2048,
        })
      );
    });

    it('should return empty object when content is null', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: null } }],
        usage: {},
      });

      const result = await callOpenAI('System', 'User');

      expect(result).toBe('{}');
    });

    it('should return empty object when choices is empty', async () => {
      mockCreate.mockResolvedValue({
        choices: [],
        usage: {},
      });

      const result = await callOpenAI('System', 'User');

      expect(result).toBe('{}');
    });

    it('should throw on non-retryable errors', async () => {
      mockCreate.mockRejectedValue(new Error('Bad request'));

      await expect(callOpenAI('System', 'User')).rejects.toThrow('Bad request');
    });

    it('should retry on network errors (ECONNRESET)', async () => {
      vi.useFakeTimers();
      mockCreate
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValueOnce({
          choices: [{ message: { content: '{"success": true}' } }],
          usage: {},
        });

      const promise = callOpenAI('System', 'User', {
        retryConfig: { maxRetries: 3, initialDelayMs: 100, maxDelayMs: 1000, backoffMultiplier: 2 },
      });

      // Advance timers to trigger retry
      await vi.advanceTimersByTimeAsync(200);

      const result = await promise;

      expect(mockCreate).toHaveBeenCalledTimes(2);
      expect(result).toBe('{"success": true}');
    });

    it('should handle response_format in request', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: '{"valid": "json"}' } }],
        usage: {},
      });

      await callOpenAI('System', 'User');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          response_format: { type: 'json_object' },
        })
      );
    });
  });

  describe('isOpenAIAvailable', () => {
    it('should return true when API key is configured', () => {
      const result = isOpenAIAvailable();
      expect(result).toBe(true);
    });
  });
});
