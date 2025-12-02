import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { webhooks } from './github/webhooks';
import { config } from './config/env';
import { initDatabase, closeDatabase } from './database/db';
import { createLogger, logWebhook, logError } from './utils/logging';

const logger = createLogger();

const fastify = Fastify({
  logger: logger,
});

// Register rate limiting
fastify.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
});

// Health check endpoint
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Webhook endpoint
fastify.post('/webhooks/github', async (request, reply) => {
  const signature = request.headers['x-hub-signature-256'] as string;
  const event = request.headers['x-github-event'] as string;
  const id = request.headers['x-github-delivery'] as string;

  if (!signature || !event || !id) {
    reply.code(400).send({ error: 'Missing required headers' });
    return;
  }

  const webhookLogger = logWebhook(logger, event, id);

  try {
    webhookLogger.info('Received webhook');
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await webhooks.verifyAndReceive({
      id,
      name: event as any,
      signature,
      payload: JSON.stringify(request.body),
    });

    webhookLogger.info('Webhook processed successfully');
    reply.code(200).send({ received: true });
  } catch (error) {
    logError(webhookLogger, error, { event, id });
    reply.code(500).send({ error: 'Internal server error' });
  }
});

// Initialize database
initDatabase();

// Graceful shutdown
const shutdown = async () => {
  fastify.log.info('Shutting down gracefully...');
  closeDatabase();
  await fastify.close();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
const start = async () => {
  try {
    await fastify.listen({
      port: config.server.port,
      host: '0.0.0.0',
    });

    logger.info(
      {
        port: config.server.port,
        webhookEndpoint: `/webhooks/github`,
        healthEndpoint: `/health`,
      },
      'Server started successfully'
    );
  } catch (err) {
    logError(logger, err, { context: 'server_startup' });
    process.exit(1);
  }
};

start();
