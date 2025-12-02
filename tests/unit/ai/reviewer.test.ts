import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AIReviewer,
  createMockReviewResponse,
} from '../../../src/ai/reviewer';
import * as openaiProvider from '../../../src/ai/providers/openai';
import * as anthropicProvider from '../../../src/ai/providers/anthropic';
import type { PRContext } from '../../../src/github/prHelpers';
import validReviewResponse from '../../fixtures/ai/review-response-valid.json';

// Mock the providers
vi.mock('../../../src/ai/providers/openai');
vi.mock('../../../src/ai/providers/anthropic');

describe('ai/reviewer', () => {
  let reviewer: AIReviewer;

  const mockPRContext: PRContext = {
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
        patch: '+const x = 1;',
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
    reviewer = new AIReviewer();
    vi.clearAllMocks();
  });

  describe('reviewPullRequestContext', () => {
    it('should return review from OpenAI on success', async () => {
      vi.mocked(openaiProvider.isOpenAIAvailable).mockReturnValue(true);
      vi.mocked(openaiProvider.callOpenAI).mockResolvedValue(
        JSON.stringify(validReviewResponse)
      );

      const result = await reviewer.reviewPullRequestContext(mockPRContext);

      expect(result.provider).toBe('openai');
      expect(result.review.summary).toBe(validReviewResponse.summary);
      expect(result.review.severity).toBe('warning');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should use specified model', async () => {
      vi.mocked(openaiProvider.isOpenAIAvailable).mockReturnValue(true);
      vi.mocked(openaiProvider.callOpenAI).mockResolvedValue(
        JSON.stringify(validReviewResponse)
      );

      await reviewer.reviewPullRequestContext(mockPRContext, {
        model: 'gpt-4',
      });

      expect(openaiProvider.callOpenAI).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ model: 'gpt-4' })
      );
    });

    it('should use specified temperature', async () => {
      vi.mocked(openaiProvider.isOpenAIAvailable).mockReturnValue(true);
      vi.mocked(openaiProvider.callOpenAI).mockResolvedValue(
        JSON.stringify(validReviewResponse)
      );

      await reviewer.reviewPullRequestContext(mockPRContext, {
        temperature: 0.5,
      });

      expect(openaiProvider.callOpenAI).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ temperature: 0.5 })
      );
    });

    it('should fallback to Anthropic when OpenAI fails', async () => {
      vi.mocked(openaiProvider.isOpenAIAvailable).mockReturnValue(true);
      vi.mocked(openaiProvider.callOpenAI).mockRejectedValue(
        new Error('OpenAI error')
      );
      vi.mocked(anthropicProvider.isAnthropicAvailable).mockReturnValue(true);
      vi.mocked(anthropicProvider.callClaude).mockResolvedValue(
        JSON.stringify(validReviewResponse)
      );

      const result = await reviewer.reviewPullRequestContext(mockPRContext, {
        useFallback: true,
      });

      expect(result.provider).toBe('anthropic');
      expect(anthropicProvider.callClaude).toHaveBeenCalled();
    });

    it('should not fallback when useFallback is false', async () => {
      vi.mocked(openaiProvider.isOpenAIAvailable).mockReturnValue(true);
      vi.mocked(openaiProvider.callOpenAI).mockRejectedValue(
        new Error('OpenAI error')
      );

      await expect(
        reviewer.reviewPullRequestContext(mockPRContext, { useFallback: false })
      ).rejects.toThrow('OpenAI error');

      expect(anthropicProvider.callClaude).not.toHaveBeenCalled();
    });

    it('should throw when both providers fail', async () => {
      vi.mocked(openaiProvider.isOpenAIAvailable).mockReturnValue(true);
      vi.mocked(openaiProvider.callOpenAI).mockRejectedValue(
        new Error('OpenAI error')
      );
      vi.mocked(anthropicProvider.isAnthropicAvailable).mockReturnValue(true);
      vi.mocked(anthropicProvider.callClaude).mockRejectedValue(
        new Error('Claude error')
      );

      await expect(
        reviewer.reviewPullRequestContext(mockPRContext, { useFallback: true })
      ).rejects.toThrow('OpenAI error');
    });

    it('should not fallback when fallback provider is unavailable', async () => {
      vi.mocked(openaiProvider.isOpenAIAvailable).mockReturnValue(true);
      vi.mocked(openaiProvider.callOpenAI).mockRejectedValue(
        new Error('OpenAI error')
      );
      vi.mocked(anthropicProvider.isAnthropicAvailable).mockReturnValue(false);

      await expect(
        reviewer.reviewPullRequestContext(mockPRContext, { useFallback: true })
      ).rejects.toThrow('OpenAI error');

      expect(anthropicProvider.callClaude).not.toHaveBeenCalled();
    });

    it('should throw when OpenAI is not available', async () => {
      vi.mocked(openaiProvider.isOpenAIAvailable).mockReturnValue(false);

      await expect(
        reviewer.reviewPullRequestContext(mockPRContext)
      ).rejects.toThrow('not configured');
    });

    it('should use Anthropic as primary when specified', async () => {
      vi.mocked(anthropicProvider.isAnthropicAvailable).mockReturnValue(true);
      vi.mocked(anthropicProvider.callClaude).mockResolvedValue(
        JSON.stringify(validReviewResponse)
      );

      const result = await reviewer.reviewPullRequestContext(mockPRContext, {
        provider: 'anthropic',
      });

      expect(result.provider).toBe('anthropic');
      expect(openaiProvider.callOpenAI).not.toHaveBeenCalled();
    });
  });

  describe('reviewPullRequest (legacy)', () => {
    it('should call reviewPullRequestContext with minimal context', async () => {
      vi.mocked(openaiProvider.isOpenAIAvailable).mockReturnValue(true);
      vi.mocked(openaiProvider.callOpenAI).mockResolvedValue(
        JSON.stringify(validReviewResponse)
      );

      const result = await reviewer.reviewPullRequest(
        'Test Title',
        'Test Description',
        '+const x = 1;'
      );

      expect(result.summary).toBeDefined();
      expect(result.riskLevel).toBeDefined();
      expect(result.inlineComments).toBeDefined();
      expect(result.generalComments).toBeDefined();
    });

    it('should convert new format to legacy format', async () => {
      vi.mocked(openaiProvider.isOpenAIAvailable).mockReturnValue(true);
      vi.mocked(openaiProvider.callOpenAI).mockResolvedValue(
        JSON.stringify(validReviewResponse)
      );

      const result = await reviewer.reviewPullRequest('Title', 'Desc', 'diff');

      // Check legacy format structure
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('riskLevel');
      expect(result).toHaveProperty('riskJustification');
      expect(result).toHaveProperty('inlineComments');
      expect(result).toHaveProperty('generalComments');

      // Check risk level mapping (warning -> medium)
      expect(result.riskLevel).toBe('medium');
    });
  });

  describe('createMockReviewResponse', () => {
    it('should create valid mock response', () => {
      const mock = createMockReviewResponse();

      expect(mock.summary).toBeDefined();
      expect(mock.severity).toBe('info');
      expect(mock.strengths).toHaveLength(2);
      expect(mock.risks).toHaveLength(1);
      expect(mock.suggestions).toHaveLength(2);
      expect(mock.inlineComments).toHaveLength(1);
    });

    it('should allow overriding fields', () => {
      const mock = createMockReviewResponse({
        severity: 'critical',
        summary: 'Custom summary',
        risks: [],
      });

      expect(mock.severity).toBe('critical');
      expect(mock.summary).toBe('Custom summary');
      expect(mock.risks).toHaveLength(0);
    });

    it('should preserve default fields when partially overriding', () => {
      const mock = createMockReviewResponse({
        severity: 'warning',
      });

      expect(mock.severity).toBe('warning');
      expect(mock.strengths).toHaveLength(2); // default
      expect(mock.summary).toContain('mock review'); // default
    });
  });

  describe('error handling', () => {
    it('should handle JSON parse errors', async () => {
      vi.mocked(openaiProvider.isOpenAIAvailable).mockReturnValue(true);
      vi.mocked(openaiProvider.callOpenAI).mockResolvedValue('not valid json');

      await expect(
        reviewer.reviewPullRequestContext(mockPRContext, { useFallback: false })
      ).rejects.toThrow();
    });

    it('should handle invalid review response schema', async () => {
      vi.mocked(openaiProvider.isOpenAIAvailable).mockReturnValue(true);
      vi.mocked(openaiProvider.callOpenAI).mockResolvedValue(
        JSON.stringify({ summary: 'too short' })
      );

      await expect(
        reviewer.reviewPullRequestContext(mockPRContext, { useFallback: false })
      ).rejects.toThrow();
    });
  });
});

