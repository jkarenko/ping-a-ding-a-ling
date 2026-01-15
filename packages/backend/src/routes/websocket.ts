import type { FastifyInstance } from 'fastify';
import type { WebSocket } from '@fastify/websocket';
import type {
  ClientMessage,
  Session,
  SessionSettings,
  PingResult,
  RollingStats,
  DeviationEvent,
  SessionStats,
} from '@ping/shared';
import { DEFAULT_SESSION_SETTINGS } from '@ping/shared';
import { PingService } from '../services/ping.service.js';
import { DeviationDetector } from '../services/deviation.service.js';
import {
  createSession,
  endSession,
  savePingResult,
  saveDeviationEvent,
  saveSessionStats,
  getPingResults,
  saveSessionAnalysis,
} from '../db/queries.js';
import { computeSessionAnalysis } from '../services/analysis.service.js';
import { randomUUID } from 'crypto';

interface ActiveSession {
  session: Session;
  pingService: PingService;
  deviationDetector: DeviationDetector;
  pingResults: PingResult[];
  deviationEvents: DeviationEvent[];
  totalPings: number;
  successfulPings: number;
}

// Track active sessions per WebSocket connection
const activeSessions = new Map<WebSocket, ActiveSession>();

export function setupWebSocketRoutes(fastify: FastifyInstance): void {
  fastify.get('/ws', { websocket: true }, (socket) => {
    fastify.log.info('WebSocket client connected');

    socket.on('message', (rawMessage: Buffer) => {
      try {
        const message = JSON.parse(rawMessage.toString()) as ClientMessage;
        handleMessage(socket, message, fastify);
      } catch {
        sendError(socket, 'Invalid message format');
      }
    });

    socket.on('close', () => {
      fastify.log.info('WebSocket client disconnected');
      // Stop any active session for this client
      const active = activeSessions.get(socket);
      if (active) {
        stopSession(socket, active);
      }
    });

    socket.on('error', (err: Error) => {
      fastify.log.error({ err }, 'WebSocket error');
    });
  });
}

function handleMessage(
  socket: WebSocket,
  message: ClientMessage,
  fastify: FastifyInstance
): void {
  switch (message.type) {
    case 'start_session':
      startSession(socket, message.settings, fastify);
      break;

    case 'stop_session':
      const active = activeSessions.get(socket);
      if (active) {
        stopSession(socket, active);
      }
      break;

    case 'update_settings':
      const session = activeSessions.get(socket);
      if (session) {
        session.deviationDetector.updateSettings(message.settings);
      }
      break;
  }
}

function startSession(
  socket: WebSocket,
  settings: SessionSettings,
  fastify: FastifyInstance
): void {
  // Stop any existing session
  const existing = activeSessions.get(socket);
  if (existing) {
    stopSession(socket, existing);
  }

  // Validate target
  if (!settings.target || settings.target.trim() === '') {
    sendError(socket, 'Target is required');
    return;
  }

  // Create session
  const sessionId = randomUUID();
  const now = Date.now();
  const sessionName = `Session ${new Date(now).toLocaleString()}`;

  const mergedSettings: SessionSettings = {
    ...DEFAULT_SESSION_SETTINGS,
    ...settings,
  };

  const session: Session = {
    id: sessionId,
    name: sessionName,
    target: mergedSettings.target,
    interval: mergedSettings.interval,
    createdAt: now,
    endedAt: null,
    settings: mergedSettings,
  };

  // Save to database
  createSession(session);

  // Create services
  const pingService = new PingService(mergedSettings);
  const deviationDetector = new DeviationDetector(mergedSettings);

  const activeSession: ActiveSession = {
    session,
    pingService,
    deviationDetector,
    pingResults: [],
    deviationEvents: [],
    totalPings: 0,
    successfulPings: 0,
  };

  activeSessions.set(socket, activeSession);

  // Send session started message
  sendMessage(socket, 'session_started', session);

  // Start ping service
  pingService.start({
    onPing: (result: PingResult, stats: RollingStats) => {
      activeSession.totalPings++;
      if (result.latency !== null) {
        activeSession.successfulPings++;
      }

      // Calculate packet loss rate
      const packetLossRate =
        activeSession.totalPings > 0
          ? ((activeSession.totalPings - activeSession.successfulPings) /
              activeSession.totalPings) *
            100
          : 0;

      const statsWithPacketLoss: RollingStats = {
        ...stats,
        packetLossRate,
      };

      // Save to buffer (we'll batch save periodically)
      activeSession.pingResults.push(result);

      // Check for deviations
      const deviations = deviationDetector.detect(result, statsWithPacketLoss);
      for (const deviation of deviations) {
        activeSession.deviationEvents.push(deviation);
        sendMessage(socket, 'deviation', deviation);
      }

      // Send ping result with stats
      sendMessage(socket, 'ping_result', { ...result, stats: statsWithPacketLoss });

      // Batch save every 100 pings
      if (activeSession.pingResults.length >= 100) {
        flushPingResults(activeSession, session.id);
      }
    },
    onError: (error: Error) => {
      fastify.log.error({ err: error }, 'Ping error');
      sendError(socket, `Ping error: ${error.message}`);
    },
  });

  fastify.log.info(`Started session ${sessionId} for target ${settings.target}`);
}

function stopSession(socket: WebSocket, active: ActiveSession): void {
  const { session, pingService, pingResults, deviationEvents, totalPings, successfulPings } = active;

  // Stop ping service
  pingService.stop();

  // Flush remaining ping results
  if (pingResults.length > 0) {
    flushPingResults(active, session.id);
  }

  // Save deviation events
  for (const event of deviationEvents) {
    saveDeviationEvent(session.id, event);
  }

  // Calculate final stats
  const latencies = pingService.getLatencies();
  const stats = calculateFinalStats(
    totalPings,
    successfulPings,
    latencies,
    deviationEvents
  );

  // Save stats
  saveSessionStats(session.id, stats);

  // End session in database
  const endedAt = Date.now();
  endSession(session.id, endedAt);

  // Compute and save analysis
  const allPingResults = getPingResults(session.id);
  if (allPingResults.length > 0) {
    const analysis = computeSessionAnalysis(session.id, allPingResults);
    saveSessionAnalysis(analysis);
  }

  // Send session ended message
  sendMessage(socket, 'session_ended', {
    sessionId: session.id,
    stats,
  });

  // Remove from active sessions
  activeSessions.delete(socket);
}

function flushPingResults(active: ActiveSession, sessionId: string): void {
  const { pingResults } = active;
  if (pingResults.length === 0) return;

  // Save each ping result
  for (const result of pingResults) {
    savePingResult(sessionId, result);
  }

  // Clear buffer
  active.pingResults = [];
}

function calculateFinalStats(
  totalPings: number,
  successfulPings: number,
  latencies: number[],
  deviations: DeviationEvent[]
): SessionStats {
  if (latencies.length === 0) {
    return {
      totalPings,
      successfulPings,
      packetLoss: totalPings > 0 ? ((totalPings - successfulPings) / totalPings) * 100 : 0,
      latencyMin: 0,
      latencyMax: 0,
      latencyMean: 0,
      latencyMedian: 0,
      latencyStdDev: 0,
      latencyP95: 0,
      latencyP99: 0,
      jitterMean: 0,
      deviationCount: deviations.length,
      meanTimeBetweenDeviations: null,
    };
  }

  const sorted = [...latencies].sort((a, b) => a - b);
  const n = sorted.length;

  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const mean = sum / n;
  const min = sorted[0];
  const max = sorted[n - 1];

  const median =
    n % 2 === 0
      ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
      : sorted[Math.floor(n / 2)];

  const squaredDiffs = sorted.map((val) => Math.pow(val - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((acc, val) => acc + val, 0) / n;
  const stdDev = Math.sqrt(avgSquaredDiff);

  const p95Index = Math.floor(n * 0.95);
  const p99Index = Math.floor(n * 0.99);
  const p95 = sorted[Math.min(p95Index, n - 1)];
  const p99 = sorted[Math.min(p99Index, n - 1)];

  // Calculate jitter
  let jitterSum = 0;
  for (let i = 1; i < latencies.length; i++) {
    jitterSum += Math.abs(latencies[i] - latencies[i - 1]);
  }
  const jitterMean = latencies.length > 1 ? jitterSum / (latencies.length - 1) : 0;

  // Calculate mean time between deviations
  let meanTimeBetweenDeviations: number | null = null;
  if (deviations.length > 1) {
    const sortedDeviations = [...deviations].sort((a, b) => a.timestamp - b.timestamp);
    let totalTimeBetween = 0;
    for (let i = 1; i < sortedDeviations.length; i++) {
      totalTimeBetween += sortedDeviations[i].timestamp - sortedDeviations[i - 1].timestamp;
    }
    meanTimeBetweenDeviations = totalTimeBetween / (sortedDeviations.length - 1);
  }

  return {
    totalPings,
    successfulPings,
    packetLoss: totalPings > 0 ? ((totalPings - successfulPings) / totalPings) * 100 : 0,
    latencyMin: min,
    latencyMax: max,
    latencyMean: mean,
    latencyMedian: median,
    latencyStdDev: stdDev,
    latencyP95: p95,
    latencyP99: p99,
    jitterMean,
    deviationCount: deviations.length,
    meanTimeBetweenDeviations,
  };
}

function sendMessage(socket: WebSocket, type: string, payload: unknown): void {
  socket.send(
    JSON.stringify({
      type,
      payload,
      timestamp: Date.now(),
    })
  );
}

function sendError(socket: WebSocket, message: string): void {
  sendMessage(socket, 'error', { message });
}
