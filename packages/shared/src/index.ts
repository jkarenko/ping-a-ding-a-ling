// Ping result from a single ICMP ping
export interface PingResult {
  timestamp: number; // Unix ms
  latency: number | null; // ms, null = timeout/loss
  seq: number; // Sequence number
}

// Types of deviations we detect
export type DeviationType = 'latency_spike' | 'packet_loss' | 'jitter';

// A detected deviation event
export interface DeviationEvent {
  id: string;
  timestamp: number;
  type: DeviationType;
  value: number; // The actual latency or jitter value
  threshold: number; // The threshold that was exceeded
}

// Detection method options
export type DetectionMethod = 'iqr' | 'zscore' | 'manual';

// Session settings configuration
export interface SessionSettings {
  target: string;
  interval: number; // ms (default: 100)

  // Detection method
  detectionMethod: DetectionMethod;

  // IQR settings
  iqrMultiplier: number; // 1.5 (mild) or 3 (extreme)

  // Z-score settings
  zScoreThreshold: number; // default: 2

  // Manual settings
  manualLatencyThreshold: number | null; // ms
  manualJitterThreshold: number | null; // ms

  // Rolling window
  rollingWindowSize: number; // 50, 100, 200, 500
}

// Default session settings
export const DEFAULT_SESSION_SETTINGS: SessionSettings = {
  target: '',
  interval: 100,
  detectionMethod: 'iqr',
  iqrMultiplier: 1.5,
  zScoreThreshold: 2,
  manualLatencyThreshold: null,
  manualJitterThreshold: null,
  rollingWindowSize: 100,
};

// A monitoring session
export interface Session {
  id: string;
  name: string;
  target: string; // IP or hostname
  interval: number; // ms (default 100)
  createdAt: number;
  endedAt: number | null;
  settings: SessionSettings;
}

// Session statistics
export interface SessionStats {
  totalPings: number;
  successfulPings: number;
  packetLoss: number; // Percentage 0-100
  latencyMin: number;
  latencyMax: number;
  latencyMean: number;
  latencyMedian: number;
  latencyStdDev: number;
  latencyP95: number;
  latencyP99: number;
  jitterMean: number;
  deviationCount: number;
  meanTimeBetweenDeviations: number | null;
}

// Rolling statistics (computed in real-time)
export interface RollingStats {
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
  p95: number;
  p99: number;
  q1: number;
  q3: number;
  iqr: number;
  jitter: number;
  packetLossRate: number; // Percentage 0-100
  sampleCount: number;
}

// WebSocket message types
export type WSMessageType =
  | 'ping_result'
  | 'deviation'
  | 'stats_update'
  | 'session_started'
  | 'session_ended'
  | 'error';

// WebSocket message wrapper
export interface WSMessage<T = unknown> {
  type: WSMessageType;
  payload: T;
  timestamp: number;
}

// Client to server messages
export type ClientMessage =
  | { type: 'start_session'; settings: SessionSettings }
  | { type: 'stop_session' }
  | { type: 'update_settings'; settings: Partial<SessionSettings> };

// Server to client messages
export type ServerMessage =
  | WSMessage<PingResult & { stats: RollingStats }>
  | WSMessage<DeviationEvent>
  | WSMessage<Session>
  | WSMessage<{ sessionId: string; stats: SessionStats }>
  | WSMessage<{ message: string }>;
