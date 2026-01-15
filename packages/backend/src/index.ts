import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { setupWebSocketRoutes } from './routes/websocket.js';
import { setupSessionRoutes } from './routes/sessions.js';
import { initDatabase } from './db/schema.js';

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function main() {
  const fastify = Fastify({
    logger: {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    },
  });

  // Initialize database
  initDatabase();

  // Register plugins
  await fastify.register(cors, {
    origin: true,
  });

  await fastify.register(websocket);

  // Register routes
  setupWebSocketRoutes(fastify);
  setupSessionRoutes(fastify);

  // Health check
  fastify.get('/api/health', async () => {
    return { status: 'ok', timestamp: Date.now() };
  });

  // Start server
  try {
    await fastify.listen({ port: PORT, host: HOST });
    console.log(`Server listening on http://${HOST}:${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
