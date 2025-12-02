import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock all dependencies at module level without external references
const mockMessagesCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => {
  class MockAPIError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.name = 'APIError';
      this.status = status;
    }
  }

  const MockAnthropic = vi.fn().mockImplementation(() => ({
    messages: {
      create: mockMessagesCreate,
    },
  }));
  
  (MockAnthropic as any).APIError = MockAPIError;

  return { default: MockAnthropic };
});

vi.mock('../../../../src/config/env', () => ({
  config: {
    anthropic: {
      apiKey: 'test-anthropic-key',
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

// Import after mocking
import { callClaude, isAnthropicAvailable } from '../../../../src/ai/providers/anthropic';

describe('ai/providers/anthropic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('callClaude', () => {
    it('should call Anthropic API successfully', async () => {
      mockMessagesCreate.mockResolvedValue({
        content: [{ type: 'text', text: '{"test": "response"}' }],
        usage: { input_tokens: 100, output_tokens: 50 },
        stop_reason: 'end_turn',
      });

      const result = await callClaude('You are a helpful assistant', 'Hello');

      expect(mockMessagesCreate).toHaveBeenCalledWith({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        system: 'You are a helpful assistant',
        messages: [
          {
            role: 'user',
            content: expect.stringContaining('Hello'),
          },
        ],
        temperature: 0.3,
      });
      expect(result).toBe('{"test": "response"}');
    });

    it('should use custom options', async () => {
      mockMessagesCreate.mockResolvedValue({
        content: [{ type: 'text', text: '{}' }],
        usage: {},
        stop_reason: 'end_turn',
      });

      await callClaude('System prompt', 'User prompt', {
        model: 'claude-3-opus-20240229',
        temperature: 0.7,
        maxTokens: 2048,
      });

      expect(mockMessagesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-3-opus-20240229',
          temperature: 0.7,
          max_tokens: 2048,
        })
      );
    });

    it('should return empty object when content has no text', async () => {
      mockMessagesCreate.mockResolvedValue({
        content: [{ type: 'image', source: {} }],
        usage: {},
        stop_reason: 'end_turn',
      });

      const result = await callClaude('System', 'User');

      expect(result).toBe('{}');
    });

    it('should return empty object when content is empty', async () => {
      mockMessagesCreate.mockResolvedValue({
        content: [],
        usage: {},
        stop_reason: 'end_turn',
      });

      const result = await callClaude('System', 'User');

      expect(result).toBe('{}');
    });

    it('should throw on non-retryable errors', async () => {
      mockMessagesCreate.mockRejectedValue(new Error('Invalid request'));

      await expect(callClaude('System', 'User')).rejects.toThrow('Invalid request');
    });

    it('should retry on network errors (ECONNRESET)', async () => {
      vi.useFakeTimers();
      mockMessagesCreate
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: '{"success": true}' }],
          usage: {},
          stop_reason: 'end_turn',
        });

      const promise = callClaude('System', 'User', {
        retryConfig: { maxRetries: 3, initialDelayMs: 100, maxDelayMs: 1000, backoffMultiplier: 2 },
      });

      await vi.advanceTimersByTimeAsync(200);

      const result = await promise;

      expect(mockMessagesCreate).toHaveBeenCalledTimes(2);
      expect(result).toBe('{"success": true}');
    });

    it('should include JSON instruction in combined prompt', async () => {
      mockMessagesCreate.mockResolvedValue({
        content: [{ type: 'text', text: '{}' }],
        usage: {},
        stop_reason: 'end_turn',
      });

      await callClaude('System prompt', 'User prompt');

      const call = mockMessagesCreate.mock.calls[0][0];
      expect(call.messages[0].content).toContain('respond ONLY with valid JSON');
    });
  });

  describe('isAnthropicAvailable', () => {
    it('should return true when API key is configured', () => {
      const result = isAnthropicAvailable();
      expect(result).toBe(true);
    });
  });
});
