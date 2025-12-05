import pino from 'pino';
import { config } from '../config/env';

const isDevelopment = config.server.nodeEnv === 'development';

/**
 * Create a Pino logger instance
 * 
 * @param name - Logger name
 * @param useStderr - If true, logs to stderr (required for MCP servers to avoid interfering with JSON-RPC on stdout)
 */
export function createLogger(name?: string, useStderr: boolean = false): pino.Logger {
  // For MCP mode, we must log to stderr to keep stdout clean for JSON-RPC
  const destination = useStderr ? pino.destination(2) : undefined; // fd 2 = stderr
  
  return pino({
    name: name || 'ai-pr-reviewer',
    level: isDevelopment ? 'debug' : 'info',
    transport: isDevelopment && !useStderr
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
    formatters: {
      level: (label) => {
        return { level: label };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  }, destination);
}

/**
 * Create a logger for MCP server (writes to stderr)
 */
export function createMCPLogger(name?: string): pino.Logger {
  return createLogger(name, true);
}

/**
 * Create a child logger with context
 */
export function createContextLogger(
  parent: pino.Logger,
  context: Record<string, unknown>
): pino.Logger {
  return parent.child(context);
}

/**
 * Log webhook events with context
 */
export function logWebhook(
  logger: pino.Logger,
  event: string,
  deliveryId: string,
  context?: Record<string, unknown>
): pino.Logger {
  return logger.child({
    event,
    deliveryId,
    ...context,
  });
}

/**
 * Log PR review operations with context
 */
export function logPRReview(
  logger: pino.Logger,
  owner: string,
  repo: string,
  pullNumber: number,
  context?: Record<string, unknown>
): pino.Logger {
  return logger.child({
    owner,
    repo,
    pullNumber,
    ...context,
  });
}

/**
 * Log errors with full context
 */
export function logError(
  logger: pino.Logger,
  error: Error | unknown,
  context?: Record<string, unknown>
): void {
  if (error instanceof Error) {
    logger.error(
      {
        err: {
          message: error.message,
          stack: error.stack,
          name: error.name,
        },
        ...context,
      },
      'Error occurred'
    );
  } else {
    logger.error({ error, ...context }, 'Unknown error occurred');
  }
}

// Default logger instance
export const logger = createLogger();

