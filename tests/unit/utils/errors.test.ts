import { describe, it, expect } from 'vitest';
import {
  AppError,
  GitHubAPIError,
  AIProviderError,
  ValidationError,
  SafetyViolationError,
  ReviewError,
  isOperationalError,
  formatErrorForLog,
  formatErrorForUser,
} from '../../../src/utils/errors';

describe('utils/errors', () => {
  describe('AppError', () => {
    it('should create error with all properties', () => {
      const error = new AppError(
        'Test error message',
        'TEST_ERROR',
        400,
        true,
        { key: 'value' }
      );

      expect(error.message).toBe('Test error message');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.isOperational).toBe(true);
      expect(error.context).toEqual({ key: 'value' });
      expect(error.name).toBe('AppError');
    });

    it('should default to 500 status code', () => {
      const error = new AppError('Test', 'TEST');
      expect(error.statusCode).toBe(500);
    });

    it('should default to operational', () => {
      const error = new AppError('Test', 'TEST');
      expect(error.isOperational).toBe(true);
    });

    it('should convert to JSON', () => {
      const error = new AppError('Test', 'TEST', 400, true, { foo: 'bar' });
      const json = error.toJSON();

      expect(json.name).toBe('AppError');
      expect(json.message).toBe('Test');
      expect(json.code).toBe('TEST');
      expect(json.statusCode).toBe(400);
      expect(json.context).toEqual({ foo: 'bar' });
    });

    it('should capture stack trace', () => {
      const error = new AppError('Test', 'TEST');
      expect(error.stack).toBeDefined();
    });
  });

  describe('GitHubAPIError', () => {
    it('should create GitHub API error', () => {
      const error = new GitHubAPIError('Failed to fetch PR', {
        owner: 'testowner',
        repo: 'testrepo',
        endpoint: '/pulls/1',
      });

      expect(error.code).toBe('GITHUB_API_ERROR');
      expect(error.message).toBe('Failed to fetch PR');
      expect(error.context?.owner).toBe('testowner');
    });

    it('should create rate limit error', () => {
      const error = GitHubAPIError.rateLimitExceeded(60);
      expect(error.message).toContain('rate limit');
      expect(error.message).toContain('60 seconds');
      expect(error.statusCode).toBe(429);
    });

    it('should create rate limit error without retry time', () => {
      const error = GitHubAPIError.rateLimitExceeded();
      expect(error.message).toContain('rate limit');
      expect(error.message).toContain('try again later');
    });

    it('should create not found error', () => {
      const error = GitHubAPIError.notFound('Pull Request #123');
      expect(error.message).toContain('not found');
      expect(error.message).toContain('Pull Request #123');
      expect(error.statusCode).toBe(404);
    });

    it('should create unauthorized error', () => {
      const error = GitHubAPIError.unauthorized();
      expect(error.message).toContain('authentication failed');
      expect(error.statusCode).toBe(401);
    });

    it('should create installation not found error', () => {
      const error = GitHubAPIError.installationNotFound(12345);
      expect(error.message).toContain('12345');
      expect(error.message).toContain('uninstalled');
    });
  });

  describe('AIProviderError', () => {
    it('should create AI provider error', () => {
      const error = new AIProviderError('API call failed', 'openai');
      expect(error.code).toBe('AI_PROVIDER_ERROR');
      expect(error.provider).toBe('openai');
      expect(error.context?.provider).toBe('openai');
    });

    it('should create rate limit error', () => {
      const error = AIProviderError.rateLimitExceeded('openai', 30);
      expect(error.message).toContain('openai');
      expect(error.message).toContain('rate limit');
      expect(error.provider).toBe('openai');
    });

    it('should create invalid response error', () => {
      const error = AIProviderError.invalidResponse('anthropic', 'missing JSON');
      expect(error.message).toContain('anthropic');
      expect(error.message).toContain('invalid response');
      expect(error.message).toContain('missing JSON');
    });

    it('should create timeout error', () => {
      const error = AIProviderError.timeout('openai');
      expect(error.message).toContain('timed out');
      expect(error.message).toContain('openai');
    });

    it('should create all providers failed error', () => {
      const error = AIProviderError.allProvidersFailed(['openai', 'anthropic']);
      expect(error.message).toContain('All AI providers failed');
      expect(error.provider).toBe('all');
      expect(error.context?.providers).toEqual(['openai', 'anthropic']);
    });
  });

  describe('ValidationError', () => {
    it('should create validation error', () => {
      const error = new ValidationError(
        'Invalid input',
        ['field1 is required', 'field2 must be positive'],
        'testField'
      );

      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.field).toBe('testField');
      expect(error.validationErrors).toHaveLength(2);
    });

    it('should create invalid config error', () => {
      const error = ValidationError.invalidConfig(['missing API key', 'invalid port']);
      expect(error.message).toContain('Invalid configuration');
      expect(error.field).toBe('config');
    });

    it('should create invalid webhook error', () => {
      const error = ValidationError.invalidWebhook('missing signature');
      expect(error.message).toContain('Invalid webhook');
      expect(error.field).toBe('webhook');
    });

    it('should create invalid review response error', () => {
      const error = ValidationError.invalidReviewResponse(['missing summary', 'invalid severity']);
      expect(error.message).toContain('Invalid AI review response');
      expect(error.field).toBe('reviewResponse');
    });
  });

  describe('SafetyViolationError', () => {
    it('should create safety violation error', () => {
      const error = new SafetyViolationError('files per PR', 15, 10);
      expect(error.code).toBe('SAFETY_VIOLATION');
      expect(error.limit).toBe('files per PR');
      expect(error.actual).toBe(15);
      expect(error.maximum).toBe(10);
    });

    it('should create too many files error', () => {
      const error = SafetyViolationError.tooManyFiles(20, 10);
      expect(error.limit).toBe('files per PR');
      expect(error.actual).toBe(20);
      expect(error.maximum).toBe(10);
    });

    it('should create too many lines error', () => {
      const error = SafetyViolationError.tooManyLines(300, 200);
      expect(error.limit).toBe('lines changed');
      expect(error.actual).toBe(300);
      expect(error.maximum).toBe(200);
    });

    it('should create forbidden path error', () => {
      const error = SafetyViolationError.forbiddenPath('Dockerfile');
      expect(error.message).toContain('Cannot modify protected path');
      expect(error.message).toContain('Dockerfile');
    });
  });

  describe('ReviewError', () => {
    it('should create review error', () => {
      const error = new ReviewError('Cannot review this PR', {
        owner: 'testowner',
        repo: 'testrepo',
        pullNumber: 1,
      });

      expect(error.code).toBe('REVIEW_ERROR');
      expect(error.context?.owner).toBe('testowner');
    });

    it('should create PR too large error', () => {
      const error = ReviewError.prTooLarge(100, 50);
      expect(error.message).toContain('too large');
      expect(error.message).toContain('100');
      expect(error.message).toContain('50');
      expect(error.context?.reason).toBe('too_large');
    });

    it('should create no reviewable files error', () => {
      const error = ReviewError.noReviewableFiles();
      expect(error.message).toContain('No reviewable files');
      expect(error.context?.reason).toBe('no_files');
    });

    it('should create already reviewed error', () => {
      const error = ReviewError.alreadyReviewed('abc123def');
      expect(error.message).toContain('already been reviewed');
      expect(error.message).toContain('abc123d');
      expect(error.context?.reason).toBe('already_reviewed');
    });

    it('should create disabled error', () => {
      const error = ReviewError.disabled();
      expect(error.message).toContain('disabled');
      expect(error.context?.reason).toBe('disabled');
    });
  });

  describe('isOperationalError', () => {
    it('should return true for operational AppError', () => {
      const error = new AppError('Test', 'TEST', 400, true);
      expect(isOperationalError(error)).toBe(true);
    });

    it('should return false for non-operational AppError', () => {
      const error = new AppError('Test', 'TEST', 500, false);
      expect(isOperationalError(error)).toBe(false);
    });

    it('should return false for regular Error', () => {
      const error = new Error('Test');
      expect(isOperationalError(error)).toBe(false);
    });

    it('should return false for non-Error values', () => {
      expect(isOperationalError('string error')).toBe(false);
      expect(isOperationalError(null)).toBe(false);
      expect(isOperationalError(undefined)).toBe(false);
    });
  });

  describe('formatErrorForLog', () => {
    it('should format AppError', () => {
      const error = new AppError('Test', 'TEST', 400, true, { foo: 'bar' });
      const formatted = formatErrorForLog(error);

      expect(formatted.name).toBe('AppError');
      expect(formatted.message).toBe('Test');
      expect(formatted.code).toBe('TEST');
      expect(formatted.statusCode).toBe(400);
    });

    it('should format regular Error', () => {
      const error = new Error('Regular error');
      const formatted = formatErrorForLog(error);

      expect(formatted.name).toBe('Error');
      expect(formatted.message).toBe('Regular error');
      expect(formatted.stack).toBeDefined();
    });

    it('should format non-Error values', () => {
      const formatted = formatErrorForLog('string error');
      expect(formatted.error).toBe('string error');
    });
  });

  describe('formatErrorForUser', () => {
    it('should return AppError message', () => {
      const error = new AppError('User-friendly message', 'TEST');
      expect(formatErrorForUser(error)).toBe('User-friendly message');
    });

    it('should return regular Error message', () => {
      const error = new Error('Error message');
      expect(formatErrorForUser(error)).toBe('Error message');
    });

    it('should return generic message for non-Error values', () => {
      expect(formatErrorForUser('string')).toContain('unexpected error');
      expect(formatErrorForUser(null)).toContain('unexpected error');
    });
  });
});

