import type { FastifyInstance } from 'fastify';
import {
  getAllSessions,
  getSession,
  deleteSession,
  getPingResults,
  getDeviationEvents,
  getSessionStats,
  getSessionAnalysis,
  saveSessionAnalysis,
} from '../db/queries.js';
import { computeSessionAnalysis } from '../services/analysis.service.js';

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
    const analysis = getSessionAnalysis(id);

    return {
      session,
      pingResults,
      deviationEvents,
      stats,
      analysis,
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

    // Sort deviations by timestamp for efficient matching
    const sortedDeviations = [...deviationEvents].sort((a, b) => a.timestamp - b.timestamp);

    // Match deviations to ping results by finding closest timestamp within tolerance
    const tolerance = session.interval + 50; // ping interval + small buffer

    const findDeviation = (pingTimestamp: number): string => {
      for (const deviation of sortedDeviations) {
        const diff = Math.abs(deviation.timestamp - pingTimestamp);
        if (diff <= tolerance) {
          return deviation.type;
        }
        // Since sorted, if we're past the tolerance window, stop searching
        if (deviation.timestamp > pingTimestamp + tolerance) {
          break;
        }
      }
      return '';
    };

    // Generate CSV
    const headers = ['timestamp', 'latency_ms', 'seq', 'deviation_type'];
    const rows = pingResults.map((result) => {
      const deviation = findDeviation(result.timestamp);
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

  // Get session analysis
  fastify.get<{ Params: { id: string }; Querystring: { live?: string } }>(
    '/api/sessions/:id/analysis',
    async (request, reply) => {
      const { id } = request.params;
      const isLive = request.query.live === 'true';
      const session = getSession(id);

      if (!session) {
        reply.code(404);
        return { error: 'Session not found' };
      }

      let analysis = null;

      // For live sessions, always compute fresh (don't use cached)
      if (isLive) {
        const pingResults = getPingResults(id);
        if (pingResults.length > 0) {
          analysis = computeSessionAnalysis(id, pingResults);
          // Don't save during live - will be saved when session ends
        }
      } else {
        // For historical sessions, use cached or compute and save
        analysis = getSessionAnalysis(id);
        if (!analysis) {
          const pingResults = getPingResults(id);
          if (pingResults.length > 0) {
            analysis = computeSessionAnalysis(id, pingResults);
            saveSessionAnalysis(analysis);
          }
        }
      }

      if (!analysis) {
        reply.code(404);
        return { error: 'No data available for analysis' };
      }

      return { analysis };
    }
  );

  // Export analysis as JSON
  fastify.get<{ Params: { id: string } }>('/api/sessions/:id/export/analysis', async (request, reply) => {
    const { id } = request.params;
    const session = getSession(id);

    if (!session) {
      reply.code(404);
      return { error: 'Session not found' };
    }

    let analysis = getSessionAnalysis(id);

    if (!analysis) {
      const pingResults = getPingResults(id);
      if (pingResults.length > 0) {
        analysis = computeSessionAnalysis(id, pingResults);
        saveSessionAnalysis(analysis);
      }
    }

    if (!analysis) {
      reply.code(404);
      return { error: 'No data available for analysis' };
    }

    reply.header('Content-Type', 'application/json');
    reply.header(
      'Content-Disposition',
      `attachment; filename="session-${id}-analysis.json"`
    );
    return analysis;
  });
}
