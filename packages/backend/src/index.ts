import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';
import { setupWebSocketRoutes } from './routes/websocket.js';
import { setupSessionRoutes } from './routes/sessions.js';
import { initDatabase } from './db/schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';

// Check if we're running in production mode (serving static files)
const isProduction = process.env.NODE_ENV === 'production' || process.env.SERVE_STATIC === 'true';

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

  // Serve static files in production mode
  if (isProduction) {
    const staticPath = path.join(__dirname, '..', '..', 'frontend', 'dist');
    await fastify.register(fastifyStatic, {
      root: staticPath,
      prefix: '/',
    });

    // SPA fallback - serve index.html for non-API routes
    fastify.setNotFoundHandler((request, reply) => {
      if (!request.url.startsWith('/api/') && !request.url.startsWith('/ws')) {
        return reply.sendFile('index.html');
      }
      return reply.status(404).send({ error: 'Not found' });
    });
  }

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
