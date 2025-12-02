import Fastify from 'fastify';
import { webhooks } from './github/webhooks';
import { config } from './config/env';

const fastify = Fastify({
  logger: true,
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

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await webhooks.verifyAndReceive({
      id,
      name: event as any,
      signature,
      payload: JSON.stringify(request.body),
    });

    reply.code(200).send({ received: true });
  } catch (error) {
    fastify.log.error({ error }, 'Webhook error');
    reply.code(500).send({ error: 'Internal server error' });
  }
});

// Start server
const start = async () => {
  try {
    await fastify.listen({
      port: config.server.port,
      host: '0.0.0.0',
    });

    console.log(`Server is running on port ${config.server.port}`);
    console.log(`Webhook endpoint: http://localhost:${config.server.port}/webhooks/github`);
    console.log(`Health check: http://localhost:${config.server.port}/health`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
