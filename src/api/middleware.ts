import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../utils/logging';

/**
 * API authentication middleware
 * For now, supports optional API key via header or query param
 * Future: Can add GitHub token validation, OAuth, etc.
 */

export interface AuthenticatedRequest extends FastifyRequest {
  apiKey?: string;
}

/**
 * Optional API key authentication
 * If API_KEY is set in env, require it; otherwise allow public access
 */
export async function authenticateAPI(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  const apiKey = request.headers['x-api-key'] as string || 
                 (request.query as { apiKey?: string })?.apiKey;
  
  const requiredApiKey = process.env.API_KEY;
  
  // If API_KEY is configured, require it
  if (requiredApiKey) {
    if (!apiKey || apiKey !== requiredApiKey) {
      logger.warn({ 
        path: request.url,
        hasKey: !!apiKey,
      }, 'API request rejected - invalid API key');
      reply.code(401).send({ 
        error: 'Unauthorized',
        message: 'Valid API key required. Provide via X-API-Key header or apiKey query param.',
      });
      return;
    }
    
    request.apiKey = apiKey;
  }
  
  // If no API_KEY configured, allow public access (useful for development)
}

/**
 * Rate limiting middleware for API endpoints
 */
export function createAPIRateLimit() {
  return {
    max: 60, // requests
    timeWindow: '1 minute',
    skipOnError: false,
  };
}

