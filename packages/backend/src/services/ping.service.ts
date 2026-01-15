import ping from 'ping';
import type { PingResult, SessionSettings, RollingStats } from '@ping/shared';

export interface PingCallback {
  onPing: (result: PingResult, stats: RollingStats) => void;
  onError: (error: Error) => void;
}

export class PingService {
  private target: string;
  private interval: number;
  private settings: SessionSettings;
  private isRunning = false;
  private seq = 0;
  private timeoutId: NodeJS.Timeout | null = null;
  private callback: PingCallback | null = null;

  // Rolling window data for statistics
  private latencies: number[] = [];
  private deltas: number[] = [];
  private lastLatency: number | null = null;

  constructor(settings: SessionSettings) {
    this.target = settings.target;
    this.interval = settings.interval;
    this.settings = settings;
  }

  start(callback: PingCallback): void {
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;
    this.callback = callback;
    this.seq = 0;
    this.latencies = [];
    this.deltas = [];
    this.lastLatency = null;
    this.scheduleNextPing();
  }

  stop(): void {
    this.isRunning = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.callback = null;
  }

  private scheduleNextPing(): void {
    if (!this.isRunning) {
      return;
    }
    this.timeoutId = setTimeout(() => this.executePing(), this.interval);
  }

  private async executePing(): Promise<void> {
    if (!this.isRunning || !this.callback) {
      return;
    }

    const timestamp = Date.now();
    this.seq++;

    try {
      const res = await ping.promise.probe(this.target, {
        timeout: Math.max(1, Math.floor(this.interval / 1000)), // timeout in seconds
        min_reply: 1,
      });

      const latency = res.alive && res.time !== 'unknown' ? parseFloat(String(res.time)) : null;

      const result: PingResult = {
        timestamp,
        latency,
        seq: this.seq,
      };

      // Update rolling window
      this.updateRollingWindow(latency);

      // Calculate stats
      const stats = this.calculateStats();

      this.callback.onPing(result, stats);
    } catch (error) {
      this.callback.onError(
        error instanceof Error ? error : new Error(String(error))
      );
    }

    // Schedule next ping
    this.scheduleNextPing();
  }

  private updateRollingWindow(latency: number | null): void {
    const windowSize = this.settings.rollingWindowSize;

    if (latency !== null) {
      this.latencies.push(latency);

      // Track jitter (delta between consecutive latencies)
      if (this.lastLatency !== null) {
        this.deltas.push(Math.abs(latency - this.lastLatency));
      }
      this.lastLatency = latency;

      // Trim to window size
      if (this.latencies.length > windowSize) {
        this.latencies.shift();
      }
      if (this.deltas.length > windowSize) {
        this.deltas.shift();
      }
    } else {
      // For packet loss, we still want to track it in our window
      // but don't update latencies array
      this.lastLatency = null;
    }
  }

  private calculateStats(): RollingStats {
    if (this.latencies.length === 0) {
      return {
        mean: 0,
        median: 0,
        stdDev: 0,
        min: 0,
        max: 0,
        p95: 0,
        p99: 0,
        q1: 0,
        q3: 0,
        iqr: 0,
        jitter: 0,
        packetLossRate: 0,
        sampleCount: 0,
      };
    }

    const sorted = [...this.latencies].sort((a, b) => a - b);
    const n = sorted.length;

    // Basic stats
    const sum = sorted.reduce((acc, val) => acc + val, 0);
    const mean = sum / n;
    const min = sorted[0];
    const max = sorted[n - 1];

    // Median
    const median =
      n % 2 === 0
        ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
        : sorted[Math.floor(n / 2)];

    // Standard deviation
    const squaredDiffs = sorted.map((val) => Math.pow(val - mean, 2));
    const avgSquaredDiff =
      squaredDiffs.reduce((acc, val) => acc + val, 0) / n;
    const stdDev = Math.sqrt(avgSquaredDiff);

    // Quartiles for IQR
    const q1Index = Math.floor(n * 0.25);
    const q3Index = Math.floor(n * 0.75);
    const q1 = sorted[q1Index];
    const q3 = sorted[q3Index];
    const iqr = q3 - q1;

    // Percentiles
    const p95Index = Math.floor(n * 0.95);
    const p99Index = Math.floor(n * 0.99);
    const p95 = sorted[Math.min(p95Index, n - 1)];
    const p99 = sorted[Math.min(p99Index, n - 1)];

    // Jitter (mean of deltas)
    const jitter =
      this.deltas.length > 0
        ? this.deltas.reduce((acc, val) => acc + val, 0) / this.deltas.length
        : 0;

    // Packet loss rate (we track this separately based on total pings vs successful)
    // This is handled at a higher level, but we report 0 here for the rolling window
    const packetLossRate = 0; // Will be calculated at session level

    return {
      mean,
      median,
      stdDev,
      min,
      max,
      p95,
      p99,
      q1,
      q3,
      iqr,
      jitter,
      packetLossRate,
      sampleCount: n,
    };
  }

  getLatencies(): number[] {
    return [...this.latencies];
  }
}
