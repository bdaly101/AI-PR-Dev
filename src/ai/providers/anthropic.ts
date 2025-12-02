import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../config/env';
import { logger } from '../../utils/logging';

const anthropicLogger = logger.child({ provider: 'anthropic' });

/**
 * Anthropic client instance
 */
let anthropicClient: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (!config.anthropic.apiKey) {
    return null;
  }
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: config.anthropic.apiKey,
    });
  }
  return anthropicClient;
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
  if (error instanceof Anthropic.APIError) {
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
 * Convert OpenAI-style prompts to Claude format
 * Claude uses a slightly different message structure
 */
function buildClaudePrompt(systemPrompt: string, userPrompt: string): string {
  // Claude works best with the system instructions and user request combined
  // The JSON schema request should be in the user message for best results
  return `${userPrompt}

Remember to respond ONLY with valid JSON as specified in your instructions.`;
}

/**
 * Call Anthropic Claude with retry logic
 */
export async function callClaude(
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
    model = 'claude-3-5-sonnet-20241022',
    temperature = 0.3,
    maxTokens = 4096,
    retryConfig = {},
  } = options;

  const client = getClient();
  if (!client) {
    throw new Error('Anthropic API key not configured');
  }

  const retryConf: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  const combinedPrompt = buildClaudePrompt(systemPrompt, userPrompt);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retryConf.maxRetries; attempt++) {
    try {
      anthropicLogger.info({
        attempt: attempt + 1,
        model,
        temperature,
      }, 'Calling Anthropic Claude API');

      const startTime = Date.now();

      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [
          { role: 'user', content: combinedPrompt },
        ],
        temperature,
      });

      const duration = Date.now() - startTime;

      // Extract text content from response
      const textContent = response.content.find(c => c.type === 'text');
      const content = textContent?.type === 'text' ? textContent.text : '{}';

      anthropicLogger.info({
        duration,
        model,
        inputTokens: response.usage?.input_tokens,
        outputTokens: response.usage?.output_tokens,
        stopReason: response.stop_reason,
      }, 'Anthropic Claude API call successful');

      return content;

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (isRetryableError(error) && attempt < retryConf.maxRetries) {
        const delay = calculateDelay(attempt, retryConf);
        
        anthropicLogger.warn({
          attempt: attempt + 1,
          maxRetries: retryConf.maxRetries,
          delayMs: delay,
          error: lastError.message,
        }, 'Anthropic Claude API call failed, retrying');

        await sleep(delay);
      } else {
        anthropicLogger.error({
          attempt: attempt + 1,
          error: lastError.message,
          stack: lastError.stack,
        }, 'Anthropic Claude API call failed, not retrying');
        break;
      }
    }
  }

  throw lastError || new Error('Anthropic Claude API call failed');
}

/**
 * Check if Anthropic is available (has API key configured)
 */
export function isAnthropicAvailable(): boolean {
  return !!config.anthropic.apiKey;
}

