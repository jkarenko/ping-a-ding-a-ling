#!/usr/bin/env node

import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';
import open from 'open';
import { setupWebSocketRoutes } from './routes/websocket.js';
import { setupSessionRoutes } from './routes/sessions.js';
import { initDatabase } from './db/schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Parse command line arguments
const args = process.argv.slice(2);
const portArg = args.find((arg) => arg.startsWith('--port=') || arg.startsWith('-p='));
const noBrowser = args.includes('--no-browser') || args.includes('-n');
const help = args.includes('--help') || args.includes('-h');

if (help) {
  console.log(`
Ping-a-Ding-a-Ling - Real-time network latency monitor

Usage: ping-a-ding-a-ling [options]

Options:
  -p, --port=PORT    Port to run the server on (default: 3001)
  -n, --no-browser   Don't open browser automatically
  -h, --help         Show this help message

Examples:
  npx ping-a-ding-a-ling
  npx ping-a-ding-a-ling --port=8080
  npx ping-a-ding-a-ling --no-browser
`);
  process.exit(0);
}

const PORT = portArg ? parseInt(portArg.split('=')[1], 10) : 3001;
const HOST = '127.0.0.1';

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

  // Serve static files from the frontend build
  // In the published package, frontend is at dist/frontend (same level as cli.js)
  const staticPath = path.join(__dirname, 'frontend');
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

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\nShutting down...');
    await fastify.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Start server
  try {
    await fastify.listen({ port: PORT, host: HOST });
    const url = `http://localhost:${PORT}`;
    console.log(`\n🏓 Ping-a-Ding-a-Ling is running at ${url}\n`);

    if (!noBrowser) {
      console.log('Opening browser...');
      await open(url);
    }

    console.log('Press Ctrl+C to stop\n');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
