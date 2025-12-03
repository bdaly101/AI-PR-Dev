import { PRContext } from '../github/prHelpers';
import { REVIEWER_SYSTEM_PROMPT, buildReviewerPrompt } from './prompts';
import { callOpenAI, isOpenAIAvailable } from './providers/openai';
import { callClaude, isAnthropicAvailable } from './providers/anthropic';
import { parseAnyReviewResponse, ReviewResponse } from '../validation/schemas';
import { logger } from '../utils/logging';
import { AI_DEFAULTS } from '../config/constants';

const reviewerLogger = logger.child({ module: 'ai-reviewer' });

/**
 * AI Provider type
 */
export type AIProvider = 'openai' | 'anthropic';

/**
 * Options for AI review
 */
export interface ReviewOptions {
  provider?: AIProvider;
  model?: string;
  temperature?: number;
  useFallback?: boolean;
}

/**
 * Result of an AI review including metadata
 */
export interface ReviewResultWithMeta {
  review: ReviewResponse;
  provider: AIProvider;
  model: string;
  durationMs: number;
}

/**
 * Legacy review result format for backwards compatibility
 */
export interface LegacyReviewResult {
  summary: string;
  riskLevel: 'low' | 'medium' | 'high';
  riskJustification: string;
  inlineComments: Array<{
    file: string;
    line: number;
    comment: string;
  }>;
  generalComments: string[];
}

/**
 * AI Reviewer class with provider fallback and validation
 */
export class AIReviewer {
  /**
   * Review a pull request using AI
   */
  async reviewPullRequestContext(
    context: PRContext,
    options: ReviewOptions = {}
  ): Promise<ReviewResultWithMeta> {
    const {
      provider = 'openai',
      model,
      temperature = AI_DEFAULTS.REVIEW_TEMPERATURE,
      useFallback = true,
    } = options;

    const userPrompt = buildReviewerPrompt(context);
    const startTime = Date.now();

    reviewerLogger.info({
      provider,
      owner: context.owner,
      repo: context.repo,
      pullNumber: context.pullNumber,
      filesCount: context.reviewedFiles,
    }, 'Starting AI review');

    // Try primary provider
    try {
      const result = await this.callProvider(
        provider,
        REVIEWER_SYSTEM_PROMPT,
        userPrompt,
        { model, temperature }
      );

      // Extract JSON from response (handle markdown code blocks)
      const jsonContent = this.extractJSON(result.content);
      const review = parseAnyReviewResponse(JSON.parse(jsonContent));
      const durationMs = Date.now() - startTime;

      reviewerLogger.info({
        provider: result.provider,
        model: result.model,
        durationMs,
        risksCount: review.risks.length,
        suggestionsCount: review.suggestions.length,
        inlineCommentsCount: review.inlineComments.length,
      }, 'AI review completed');

      return {
        review,
        provider: result.provider,
        model: result.model,
        durationMs,
      };

    } catch (primaryError) {
      reviewerLogger.warn({
        provider,
        error: primaryError instanceof Error ? primaryError.message : String(primaryError),
      }, 'Primary AI provider failed');

      // Try fallback provider if enabled
      if (useFallback) {
        const fallbackProvider = provider === 'openai' ? 'anthropic' : 'openai';
        
        if (this.isProviderAvailable(fallbackProvider)) {
          reviewerLogger.info({ fallbackProvider }, 'Attempting fallback provider');

          try {
            const result = await this.callProvider(
              fallbackProvider,
              REVIEWER_SYSTEM_PROMPT,
              userPrompt,
              { temperature }
            );

            // Extract JSON from response (handle markdown code blocks)
            const jsonContent = this.extractJSON(result.content);
            const review = parseAnyReviewResponse(JSON.parse(jsonContent));
            const durationMs = Date.now() - startTime;

            reviewerLogger.info({
              provider: result.provider,
              model: result.model,
              durationMs,
              usedFallback: true,
            }, 'AI review completed with fallback provider');

            return {
              review,
              provider: result.provider,
              model: result.model,
              durationMs,
            };

          } catch (fallbackError) {
            reviewerLogger.error({
              fallbackProvider,
              error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
            }, 'Fallback provider also failed');
          }
        }
      }

      // Both providers failed
      throw primaryError;
    }
  }

  /**
   * Legacy method for backwards compatibility
   * Maps old interface to new implementation
   */
  async reviewPullRequest(
    prTitle: string,
    prDescription: string,
    diff: string
  ): Promise<LegacyReviewResult> {
    // Create minimal context for legacy calls
    const minimalContext: PRContext = {
      owner: '',
      repo: '',
      pullNumber: 0,
      title: prTitle,
      description: prDescription,
      author: 'unknown',
      baseBranch: 'main',
      headBranch: 'feature',
      commitSha: '',
      totalFiles: 1,
      totalAdditions: 0,
      totalDeletions: 0,
      reviewedFiles: 1,
      skippedFiles: 0,
      truncatedFiles: 0,
      files: [],
      formattedDiff: diff,
      warnings: [],
      fromCache: false,
      fetchedAt: new Date().toISOString(),
    };

    const result = await this.reviewPullRequestContext(minimalContext);
    
    // Convert new format to legacy format
    return this.convertToLegacyFormat(result.review);
  }

  /**
   * Convert new ReviewResponse to legacy format
   */
  private convertToLegacyFormat(review: ReviewResponse): LegacyReviewResult {
    // Map severity to riskLevel
    const riskLevel = review.severity === 'critical' ? 'high' :
                      review.severity === 'warning' ? 'medium' : 'low';

    // Build risk justification from risks
    const riskJustification = review.risks.length > 0
      ? review.risks
          .sort((a, b) => {
            const severityOrder = { high: 0, medium: 1, low: 2 };
            return severityOrder[a.severity] - severityOrder[b.severity];
          })
          .slice(0, 3)
          .map(r => `[${r.category.toUpperCase()}] ${r.description}`)
          .join('; ')
      : 'No significant risks identified';

    return {
      summary: review.summary,
      riskLevel,
      riskJustification,
      inlineComments: review.inlineComments.map(c => ({
        file: c.path,
        line: c.line,
        comment: c.body,
      })),
      generalComments: [
        ...review.strengths.map(s => `✅ ${s}`),
        ...review.suggestions,
      ],
    };
  }

  /**
   * Call the specified AI provider
   */
  private async callProvider(
    provider: AIProvider,
    systemPrompt: string,
    userPrompt: string,
    options: { model?: string; temperature?: number }
  ): Promise<{ content: string; provider: AIProvider; model: string }> {
    if (provider === 'openai') {
      if (!isOpenAIAvailable()) {
        throw new Error('OpenAI API key not configured');
      }
      const model = options.model || AI_DEFAULTS.REVIEW_MODEL;
      const content = await callOpenAI(systemPrompt, userPrompt, {
        model,
        temperature: options.temperature,
      });
      return { content, provider: 'openai', model };
    } else {
      if (!isAnthropicAvailable()) {
        throw new Error('Anthropic API key not configured');
      }
      const model = options.model || 'claude-3-5-sonnet-20241022';
      const content = await callClaude(systemPrompt, userPrompt, {
        model,
        temperature: options.temperature,
      });
      return { content, provider: 'anthropic', model };
    }
  }

  /**
   * Check if a provider is available
   */
  private isProviderAvailable(provider: AIProvider): boolean {
    return provider === 'openai' ? isOpenAIAvailable() : isAnthropicAvailable();
  }

  /**
   * Extract JSON from AI response (handles markdown code blocks)
   */
  private extractJSON(content: string): string {
    // If it's already valid JSON, return as-is
    const trimmed = content.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      return trimmed;
    }

    // Try to extract from markdown code block
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      return jsonMatch[1].trim();
    }

    // Try to find JSON object in the content
    const objectMatch = content.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      return objectMatch[0];
    }

    // Return original content and let JSON.parse handle the error
    return content;
  }
}

// Export singleton instance
export const aiReviewer = new AIReviewer();

/**
 * Create mock review response for testing
 */
export function createMockReviewResponse(overrides: Partial<ReviewResponse> = {}): ReviewResponse {
  return {
    summary: 'This is a mock review for testing purposes.',
    severity: 'info',
    strengths: [
      'Well-structured code',
      'Good use of TypeScript types',
    ],
    risks: [
      {
        category: 'maintainability',
        description: 'Consider adding more inline comments for complex logic',
        severity: 'low',
      },
    ],
    suggestions: [
      'Add unit tests for the new functionality',
      'Consider extracting repeated code into helper functions',
    ],
    inlineComments: [
      {
        path: 'src/example.ts',
        line: 10,
        body: 'This function could benefit from a more descriptive name',
      },
    ],
    ...overrides,
  };
}
