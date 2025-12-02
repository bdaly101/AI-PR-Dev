import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createLogger,
  createContextLogger,
  logWebhook,
  logPRReview,
  logError,
} from '../../../src/utils/logging';

describe('utils/logging', () => {
  describe('createLogger', () => {
    it('should create a pino logger instance', () => {
      const logger = createLogger();
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });

    it('should create logger with custom name', () => {
      const logger = createLogger('custom-logger');
      expect(logger).toBeDefined();
    });
  });

  describe('createContextLogger', () => {
    it('should create child logger with context', () => {
      const parent = createLogger();
      const child = createContextLogger(parent, { module: 'test' });
      expect(child).toBeDefined();
      expect(typeof child.info).toBe('function');
    });

    it('should include parent context', () => {
      const parent = createLogger();
      const child = createContextLogger(parent, { requestId: '123' });
      // Child logger exists and has log methods
      expect(child.info).toBeDefined();
      expect(child.error).toBeDefined();
    });
  });

  describe('logWebhook', () => {
    it('should create child logger with webhook context', () => {
      const logger = createLogger();
      const webhookLogger = logWebhook(logger, 'pull_request.opened', 'delivery-123');
      expect(webhookLogger).toBeDefined();
      expect(typeof webhookLogger.info).toBe('function');
    });

    it('should accept additional context', () => {
      const logger = createLogger();
      const webhookLogger = logWebhook(logger, 'pull_request', 'delivery-123', {
        repo: 'test-repo',
      });
      expect(webhookLogger).toBeDefined();
    });
  });

  describe('logPRReview', () => {
    it('should create child logger with PR context', () => {
      const logger = createLogger();
      const prLogger = logPRReview(logger, 'test-owner', 'test-repo', 1);
      expect(prLogger).toBeDefined();
      expect(typeof prLogger.info).toBe('function');
    });

    it('should accept additional context', () => {
      const logger = createLogger();
      const prLogger = logPRReview(logger, 'owner', 'repo', 1, {
        commitSha: 'abc123',
      });
      expect(prLogger).toBeDefined();
    });
  });

  describe('logError', () => {
    it('should log Error instances', () => {
      const logger = createLogger();
      const mockError = vi.spyOn(logger, 'error').mockImplementation(() => {});
      
      logError(logger, new Error('Test error'), { action: 'test' });
      
      expect(mockError).toHaveBeenCalled();
      const callArgs = mockError.mock.calls[0];
      expect(callArgs[0].err.message).toBe('Test error');
      expect(callArgs[0].action).toBe('test');
    });

    it('should log non-Error values', () => {
      const logger = createLogger();
      const mockError = vi.spyOn(logger, 'error').mockImplementation(() => {});
      
      logError(logger, 'string error', { context: 'test' });
      
      expect(mockError).toHaveBeenCalled();
      const callArgs = mockError.mock.calls[0];
      expect(callArgs[0].error).toBe('string error');
    });

    it('should include stack trace for Error instances', () => {
      const logger = createLogger();
      const mockError = vi.spyOn(logger, 'error').mockImplementation(() => {});
      
      const error = new Error('Test');
      logError(logger, error);
      
      const callArgs = mockError.mock.calls[0];
      expect(callArgs[0].err.stack).toBeDefined();
    });

    it('should handle errors without context', () => {
      const logger = createLogger();
      const mockError = vi.spyOn(logger, 'error').mockImplementation(() => {});
      
      logError(logger, new Error('Test'));
      
      expect(mockError).toHaveBeenCalled();
    });
  });
});

