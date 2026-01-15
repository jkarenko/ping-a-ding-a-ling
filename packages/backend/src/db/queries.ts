import { getDatabase } from './schema.js';
import type {
  Session,
  SessionSettings,
  SessionStats,
  PingResult,
  DeviationEvent,
  SessionAnalysis,
  LatencyBurst,
  ThresholdCount,
  QualityGrade,
} from '@ping/shared';

// Re-export for convenience
export type { SessionAnalysis, LatencyBurst };

// Session queries
export function createSession(session: Session): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO sessions (id, name, target, interval, created_at, ended_at, settings)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    session.id,
    session.name,
    session.target,
    session.interval,
    session.createdAt,
    session.endedAt,
    JSON.stringify(session.settings)
  );
}

export function endSession(sessionId: string, endedAt: number): void {
  const db = getDatabase();
  const stmt = db.prepare('UPDATE sessions SET ended_at = ? WHERE id = ?');
  stmt.run(endedAt, sessionId);
}

export function getSession(sessionId: string): Session | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM sessions WHERE id = ?');
  const row = stmt.get(sessionId) as SessionRow | undefined;
  return row ? rowToSession(row) : null;
}

export function getAllSessions(): Session[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM sessions ORDER BY created_at DESC');
  const rows = stmt.all() as SessionRow[];
  return rows.map(rowToSession);
}

export function deleteSession(sessionId: string): void {
  const db = getDatabase();
  db.exec('BEGIN TRANSACTION');
  try {
    db.prepare('DELETE FROM ping_results WHERE session_id = ?').run(sessionId);
    db.prepare('DELETE FROM deviation_events WHERE session_id = ?').run(sessionId);
    db.prepare('DELETE FROM session_stats WHERE session_id = ?').run(sessionId);
    db.prepare('DELETE FROM session_analysis WHERE session_id = ?').run(sessionId);
    db.prepare('DELETE FROM session_bursts WHERE session_id = ?').run(sessionId);
    db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// Ping result queries
export function savePingResult(sessionId: string, result: PingResult): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO ping_results (session_id, timestamp, latency, seq)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(sessionId, result.timestamp, result.latency, result.seq);
}

export function savePingResultsBatch(
  sessionId: string,
  results: PingResult[]
): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO ping_results (session_id, timestamp, latency, seq)
    VALUES (?, ?, ?, ?)
  `);
  const insertMany = db.transaction((items: PingResult[]) => {
    for (const item of items) {
      stmt.run(sessionId, item.timestamp, item.latency, item.seq);
    }
  });
  insertMany(results);
}

export function getPingResults(sessionId: string): PingResult[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT timestamp, latency, seq
    FROM ping_results
    WHERE session_id = ?
    ORDER BY timestamp ASC
  `);
  return stmt.all(sessionId) as PingResult[];
}

// Deviation event queries
export function saveDeviationEvent(
  sessionId: string,
  event: DeviationEvent
): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO deviation_events (id, session_id, timestamp, type, value, threshold)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    event.id,
    sessionId,
    event.timestamp,
    event.type,
    event.value,
    event.threshold
  );
}

export function getDeviationEvents(sessionId: string): DeviationEvent[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT id, timestamp, type, value, threshold
    FROM deviation_events
    WHERE session_id = ?
    ORDER BY timestamp ASC
  `);
  return stmt.all(sessionId) as DeviationEvent[];
}

// Session stats queries
export function saveSessionStats(
  sessionId: string,
  stats: SessionStats
): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO session_stats (
      session_id, total_pings, successful_pings, packet_loss,
      latency_min, latency_max, latency_mean, latency_median,
      latency_std_dev, latency_p95, latency_p99, jitter_mean,
      deviation_count, mean_time_between_deviations
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    sessionId,
    stats.totalPings,
    stats.successfulPings,
    stats.packetLoss,
    stats.latencyMin,
    stats.latencyMax,
    stats.latencyMean,
    stats.latencyMedian,
    stats.latencyStdDev,
    stats.latencyP95,
    stats.latencyP99,
    stats.jitterMean,
    stats.deviationCount,
    stats.meanTimeBetweenDeviations
  );
}

export function getSessionStats(sessionId: string): SessionStats | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM session_stats WHERE session_id = ?');
  const row = stmt.get(sessionId) as SessionStatsRow | undefined;
  return row ? rowToSessionStats(row) : null;
}

// Helper types and functions
interface SessionRow {
  id: string;
  name: string;
  target: string;
  interval: number;
  created_at: number;
  ended_at: number | null;
  settings: string;
}

interface SessionStatsRow {
  session_id: string;
  total_pings: number;
  successful_pings: number;
  packet_loss: number;
  latency_min: number | null;
  latency_max: number | null;
  latency_mean: number | null;
  latency_median: number | null;
  latency_std_dev: number | null;
  latency_p95: number | null;
  latency_p99: number | null;
  jitter_mean: number | null;
  deviation_count: number;
  mean_time_between_deviations: number | null;
}

function rowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    name: row.name,
    target: row.target,
    interval: row.interval,
    createdAt: row.created_at,
    endedAt: row.ended_at,
    settings: JSON.parse(row.settings) as SessionSettings,
  };
}

function rowToSessionStats(row: SessionStatsRow): SessionStats {
  return {
    totalPings: row.total_pings,
    successfulPings: row.successful_pings,
    packetLoss: row.packet_loss,
    latencyMin: row.latency_min ?? 0,
    latencyMax: row.latency_max ?? 0,
    latencyMean: row.latency_mean ?? 0,
    latencyMedian: row.latency_median ?? 0,
    latencyStdDev: row.latency_std_dev ?? 0,
    latencyP95: row.latency_p95 ?? 0,
    latencyP99: row.latency_p99 ?? 0,
    jitterMean: row.jitter_mean ?? 0,
    deviationCount: row.deviation_count,
    meanTimeBetweenDeviations: row.mean_time_between_deviations,
  };
}

// Session analysis queries
export function saveSessionAnalysis(analysis: SessionAnalysis): void {
  const db = getDatabase();

  // Save main analysis record
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO session_analysis (
      session_id, computed_at,
      span_seconds, sample_count,
      sampling_interval_mean, sampling_interval_median, sampling_interval_p95,
      latency_min, latency_mean, latency_median, latency_p95, latency_p99,
      latency_max, latency_std_dev,
      thresholds,
      burst_count, burst_size_median, burst_size_max,
      inter_burst_interval_median, inter_burst_interval_p95,
      quality_grade, quality_summary
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    analysis.sessionId,
    analysis.computedAt,
    analysis.spanSeconds,
    analysis.sampleCount,
    analysis.samplingIntervalMean,
    analysis.samplingIntervalMedian,
    analysis.samplingIntervalP95,
    analysis.latencyMin,
    analysis.latencyMean,
    analysis.latencyMedian,
    analysis.latencyP95,
    analysis.latencyP99,
    analysis.latencyMax,
    analysis.latencyStdDev,
    JSON.stringify(analysis.thresholds),
    analysis.burstCount,
    analysis.burstSizeMedian,
    analysis.burstSizeMax,
    analysis.interBurstIntervalMedian,
    analysis.interBurstIntervalP95,
    analysis.qualityGrade,
    analysis.qualitySummary
  );

  // Save bursts separately
  saveSessionBursts(analysis.sessionId, analysis.bursts);
}

export function saveSessionBursts(
  sessionId: string,
  bursts: LatencyBurst[]
): void {
  const db = getDatabase();

  // Clear existing bursts for this session
  db.prepare('DELETE FROM session_bursts WHERE session_id = ?').run(sessionId);

  if (bursts.length === 0) return;

  const stmt = db.prepare(`
    INSERT INTO session_bursts (
      session_id, burst_index, start_timestamp, end_timestamp,
      sample_count, max_latency, mean_latency
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((items: LatencyBurst[]) => {
    for (const burst of items) {
      stmt.run(
        sessionId,
        burst.index,
        burst.startTimestamp,
        burst.endTimestamp,
        burst.sampleCount,
        burst.maxLatency,
        burst.meanLatency
      );
    }
  });

  insertMany(bursts);
}

interface SessionAnalysisRow {
  session_id: string;
  computed_at: number;
  span_seconds: number;
  sample_count: number;
  sampling_interval_mean: number;
  sampling_interval_median: number;
  sampling_interval_p95: number;
  latency_min: number;
  latency_mean: number;
  latency_median: number;
  latency_p95: number;
  latency_p99: number;
  latency_max: number;
  latency_std_dev: number;
  thresholds: string;
  burst_count: number;
  burst_size_median: number | null;
  burst_size_max: number | null;
  inter_burst_interval_median: number | null;
  inter_burst_interval_p95: number | null;
  quality_grade: string;
  quality_summary: string;
}

interface SessionBurstRow {
  session_id: string;
  burst_index: number;
  start_timestamp: number;
  end_timestamp: number;
  sample_count: number;
  max_latency: number;
  mean_latency: number;
}

export function getSessionAnalysis(sessionId: string): SessionAnalysis | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM session_analysis WHERE session_id = ?');
  const row = stmt.get(sessionId) as SessionAnalysisRow | undefined;

  if (!row) return null;

  const bursts = getSessionBursts(sessionId);

  return {
    sessionId: row.session_id,
    computedAt: row.computed_at,
    spanSeconds: row.span_seconds,
    sampleCount: row.sample_count,
    samplingIntervalMean: row.sampling_interval_mean,
    samplingIntervalMedian: row.sampling_interval_median,
    samplingIntervalP95: row.sampling_interval_p95,
    latencyMin: row.latency_min,
    latencyMean: row.latency_mean,
    latencyMedian: row.latency_median,
    latencyP95: row.latency_p95,
    latencyP99: row.latency_p99,
    latencyMax: row.latency_max,
    latencyStdDev: row.latency_std_dev,
    thresholds: JSON.parse(row.thresholds) as ThresholdCount[],
    burstCount: row.burst_count,
    burstSizeMedian: row.burst_size_median ?? 0,
    burstSizeMax: row.burst_size_max ?? 0,
    interBurstIntervalMedian: row.inter_burst_interval_median,
    interBurstIntervalP95: row.inter_burst_interval_p95,
    bursts,
    qualityGrade: row.quality_grade as QualityGrade,
    qualitySummary: row.quality_summary,
  };
}

export function getSessionBursts(sessionId: string): LatencyBurst[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM session_bursts
    WHERE session_id = ?
    ORDER BY burst_index ASC
  `);
  const rows = stmt.all(sessionId) as SessionBurstRow[];

  return rows.map((row) => ({
    index: row.burst_index,
    startTimestamp: row.start_timestamp,
    endTimestamp: row.end_timestamp,
    sampleCount: row.sample_count,
    maxLatency: row.max_latency,
    meanLatency: row.mean_latency,
  }));
}
