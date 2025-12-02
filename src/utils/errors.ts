/**
 * Base class for all application errors
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.context = context;

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      context: this.context,
    };
  }
}

/**
 * Error when GitHub API calls fail
 */
export class GitHubAPIError extends AppError {
  constructor(
    message: string,
    context?: {
      owner?: string;
      repo?: string;
      endpoint?: string;
      statusCode?: number;
    }
  ) {
    super(
      message,
      'GITHUB_API_ERROR',
      context?.statusCode || 502,
      true,
      context
    );
  }

  static rateLimitExceeded(retryAfter?: number): GitHubAPIError {
    return new GitHubAPIError(
      `GitHub API rate limit exceeded. ${retryAfter ? `Retry after ${retryAfter} seconds.` : 'Please try again later.'}`,
      { statusCode: 429 }
    );
  }

  static notFound(resource: string, context?: Record<string, unknown>): GitHubAPIError {
    return new GitHubAPIError(
      `GitHub resource not found: ${resource}`,
      { ...context, statusCode: 404 }
    );
  }

  static unauthorized(): GitHubAPIError {
    return new GitHubAPIError(
      'GitHub API authentication failed. Please check your app credentials.',
      { statusCode: 401 }
    );
  }

  static installationNotFound(installationId: number): GitHubAPIError {
    return new GitHubAPIError(
      `GitHub App installation not found: ${installationId}. The app may have been uninstalled.`,
      { statusCode: 404 }
    );
  }
}

/**
 * Error when AI provider calls fail
 */
export class AIProviderError extends AppError {
  public readonly provider: string;

  constructor(
    message: string,
    provider: string,
    context?: Record<string, unknown>
  ) {
    super(
      message,
      'AI_PROVIDER_ERROR',
      502,
      true,
      { provider, ...context }
    );
    this.provider = provider;
  }

  static rateLimitExceeded(provider: string, retryAfter?: number): AIProviderError {
    return new AIProviderError(
      `${provider} API rate limit exceeded. ${retryAfter ? `Retry after ${retryAfter} seconds.` : 'Please try again later.'}`,
      provider,
      { retryAfter }
    );
  }

  static invalidResponse(provider: string, details?: string): AIProviderError {
    return new AIProviderError(
      `${provider} returned an invalid response${details ? `: ${details}` : '.'}`,
      provider
    );
  }

  static timeout(provider: string): AIProviderError {
    return new AIProviderError(
      `${provider} request timed out. The review may take too long for large PRs.`,
      provider
    );
  }

  static allProvidersFailed(providers: string[]): AIProviderError {
    return new AIProviderError(
      `All AI providers failed: ${providers.join(', ')}. Please check API keys and try again.`,
      'all',
      { providers }
    );
  }
}

/**
 * Error when validation fails
 */
export class ValidationError extends AppError {
  public readonly field?: string;
  public readonly validationErrors: string[];

  constructor(
    message: string,
    validationErrors: string[],
    field?: string
  ) {
    super(
      message,
      'VALIDATION_ERROR',
      400,
      true,
      { field, validationErrors }
    );
    this.field = field;
    this.validationErrors = validationErrors;
  }

  static invalidConfig(errors: string[]): ValidationError {
    return new ValidationError(
      `Invalid configuration: ${errors.join('; ')}`,
      errors,
      'config'
    );
  }

  static invalidWebhook(reason: string): ValidationError {
    return new ValidationError(
      `Invalid webhook payload: ${reason}`,
      [reason],
      'webhook'
    );
  }

  static invalidReviewResponse(errors: string[]): ValidationError {
    return new ValidationError(
      `Invalid AI review response: ${errors.join('; ')}`,
      errors,
      'reviewResponse'
    );
  }
}

/**
 * Error when safety limits are violated
 */
export class SafetyViolationError extends AppError {
  public readonly limit: string;
  public readonly actual: number;
  public readonly maximum: number;

  constructor(
    limit: string,
    actual: number,
    maximum: number
  ) {
    super(
      `Safety limit exceeded: ${limit} (${actual} > ${maximum})`,
      'SAFETY_VIOLATION',
      400,
      true,
      { limit, actual, maximum }
    );
    this.limit = limit;
    this.actual = actual;
    this.maximum = maximum;
  }

  static tooManyFiles(actual: number, maximum: number): SafetyViolationError {
    return new SafetyViolationError('files per PR', actual, maximum);
  }

  static tooManyLines(actual: number, maximum: number): SafetyViolationError {
    return new SafetyViolationError('lines changed', actual, maximum);
  }

  static forbiddenPath(path: string): SafetyViolationError {
    const error = new SafetyViolationError('forbidden paths', 1, 0);
    error.message = `Cannot modify protected path: ${path}`;
    return error;
  }
}

/**
 * Error when a PR cannot be reviewed
 */
export class ReviewError extends AppError {
  constructor(
    message: string,
    context?: {
      owner?: string;
      repo?: string;
      pullNumber?: number;
      reason?: string;
    }
  ) {
    super(
      message,
      'REVIEW_ERROR',
      400,
      true,
      context
    );
  }

  static prTooLarge(filesCount: number, maxFiles: number): ReviewError {
    return new ReviewError(
      `PR is too large to review: ${filesCount} files (max: ${maxFiles}). Consider breaking into smaller PRs.`,
      { reason: 'too_large' }
    );
  }

  static noReviewableFiles(): ReviewError {
    return new ReviewError(
      'No reviewable files in this PR. Files may be binary, ignored, or empty.',
      { reason: 'no_files' }
    );
  }

  static alreadyReviewed(commitSha: string): ReviewError {
    return new ReviewError(
      `This commit has already been reviewed: ${commitSha.substring(0, 7)}`,
      { reason: 'already_reviewed' }
    );
  }

  static disabled(): ReviewError {
    return new ReviewError(
      'AI review is disabled for this repository in .ai-pr-reviewer.yml',
      { reason: 'disabled' }
    );
  }
}

/**
 * Check if an error is operational (expected) vs programming error
 */
export function isOperationalError(error: unknown): boolean {
  return error instanceof AppError && error.isOperational;
}

/**
 * Format error for logging
 */
export function formatErrorForLog(error: unknown): Record<string, unknown> {
  if (error instanceof AppError) {
    return error.toJSON();
  }
  
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  
  return { error: String(error) };
}

/**
 * Format error for user display
 */
export function formatErrorForUser(error: unknown): string {
  if (error instanceof AppError) {
    return error.message;
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return 'An unexpected error occurred. Please try again.';
}

