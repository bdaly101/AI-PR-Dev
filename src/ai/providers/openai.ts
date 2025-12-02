import OpenAI from 'openai';
import { config } from '../../config/env';
import { logger } from '../../utils/logging';
import { AI_DEFAULTS } from '../../config/constants';

const openaiLogger = logger.child({ provider: 'openai' });

/**
 * OpenAI client instance
 */
let openaiClient: OpenAI | null = null;

function getClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: config.openai.apiKey,
    });
  }
  return openaiClient;
}

/**
 * Configuration for retry behavior
 */
export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

/**
 * Sleep for a specified number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate delay for exponential backoff
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  const delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt);
  // Add jitter (±10%)
  const jitter = delay * 0.1 * (Math.random() * 2 - 1);
  return Math.min(delay + jitter, config.maxDelayMs);
}

/**
 * Check if an error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof OpenAI.APIError) {
    // Retry on rate limits and server errors
    return error.status === 429 || (error.status >= 500 && error.status < 600);
  }
  // Retry on network errors
  if (error instanceof Error && error.message.includes('ECONNRESET')) {
    return true;
  }
  return false;
}

/**
 * Call OpenAI with retry logic
 */
export async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
  options: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    retryConfig?: Partial<RetryConfig>;
  } = {}
): Promise<string> {
  const {
    model = AI_DEFAULTS.REVIEW_MODEL,
    temperature = AI_DEFAULTS.REVIEW_TEMPERATURE,
    maxTokens = AI_DEFAULTS.MAX_REVIEW_TOKENS,
    retryConfig = {},
  } = options;

  const config: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  const client = getClient();

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      openaiLogger.info({
        attempt: attempt + 1,
        model,
        temperature,
      }, 'Calling OpenAI API');

      const startTime = Date.now();

      const completion = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
      });

      const duration = Date.now() - startTime;
      const content = completion.choices[0]?.message?.content || '{}';

      openaiLogger.info({
        duration,
        model,
        promptTokens: completion.usage?.prompt_tokens,
        completionTokens: completion.usage?.completion_tokens,
        totalTokens: completion.usage?.total_tokens,
      }, 'OpenAI API call successful');

      return content;

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (isRetryableError(error) && attempt < config.maxRetries) {
        const delay = calculateDelay(attempt, config);
        
        openaiLogger.warn({
          attempt: attempt + 1,
          maxRetries: config.maxRetries,
          delayMs: delay,
          error: lastError.message,
        }, 'OpenAI API call failed, retrying');

        await sleep(delay);
      } else {
        openaiLogger.error({
          attempt: attempt + 1,
          error: lastError.message,
          stack: lastError.stack,
        }, 'OpenAI API call failed, not retrying');
        break;
      }
    }
  }

  throw lastError || new Error('OpenAI API call failed');
}

/**
 * Check if OpenAI is available (has API key configured)
 */
export function isOpenAIAvailable(): boolean {
  try {
    return !!config.openai.apiKey;
  } catch {
    return false;
  }
}

