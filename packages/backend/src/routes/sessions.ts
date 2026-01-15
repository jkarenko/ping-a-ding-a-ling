import type { FastifyInstance } from 'fastify';
import {
  getAllSessions,
  getSession,
  deleteSession,
  getPingResults,
  getDeviationEvents,
  getSessionStats,
} from '../db/queries.js';

export function setupSessionRoutes(fastify: FastifyInstance): void {
  // Get all sessions
  fastify.get('/api/sessions', async () => {
    const sessions = getAllSessions();
    return { sessions };
  });

  // Get a single session with all data
  fastify.get<{ Params: { id: string } }>('/api/sessions/:id', async (request, reply) => {
    const { id } = request.params;
    const session = getSession(id);

    if (!session) {
      reply.code(404);
      return { error: 'Session not found' };
    }

    const pingResults = getPingResults(id);
    const deviationEvents = getDeviationEvents(id);
    const stats = getSessionStats(id);

    return {
      session,
      pingResults,
      deviationEvents,
      stats,
    };
  });

  // Delete a session
  fastify.delete<{ Params: { id: string } }>('/api/sessions/:id', async (request, reply) => {
    const { id } = request.params;
    const session = getSession(id);

    if (!session) {
      reply.code(404);
      return { error: 'Session not found' };
    }

    deleteSession(id);
    return { success: true };
  });

  // Export session as CSV
  fastify.get<{ Params: { id: string } }>('/api/sessions/:id/export/csv', async (request, reply) => {
    const { id } = request.params;
    const session = getSession(id);

    if (!session) {
      reply.code(404);
      return { error: 'Session not found' };
    }

    const pingResults = getPingResults(id);
    const deviationEvents = getDeviationEvents(id);

    // Create a map of deviations by timestamp for quick lookup
    const deviationMap = new Map<number, string>();
    for (const event of deviationEvents) {
      deviationMap.set(event.timestamp, event.type);
    }

    // Generate CSV
    const headers = ['timestamp', 'latency_ms', 'seq', 'deviation_type'];
    const rows = pingResults.map((result) => {
      const deviation = deviationMap.get(result.timestamp) || '';
      return [
        result.timestamp.toString(),
        result.latency?.toString() || '',
        result.seq.toString(),
        deviation,
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');

    reply.header('Content-Type', 'text/csv');
    reply.header(
      'Content-Disposition',
      `attachment; filename="session-${id}.csv"`
    );
    return csv;
  });

  // Get session stats only
  fastify.get<{ Params: { id: string } }>('/api/sessions/:id/stats', async (request, reply) => {
    const { id } = request.params;
    const stats = getSessionStats(id);

    if (!stats) {
      reply.code(404);
      return { error: 'Session stats not found' };
    }

    return { stats };
  });

  // Update session name
  fastify.patch<{ Params: { id: string }; Body: { name: string } }>(
    '/api/sessions/:id',
    async (request, reply) => {
      const { id } = request.params;
      const { name } = request.body;

      const session = getSession(id);
      if (!session) {
        reply.code(404);
        return { error: 'Session not found' };
      }

      // Update name in database
      const { getDatabase } = await import('../db/schema.js');
      const db = getDatabase();
      db.prepare('UPDATE sessions SET name = ? WHERE id = ?').run(name, id);

      return { success: true };
    }
  );
}
