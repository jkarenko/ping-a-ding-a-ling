import type {
  DeviationEvent,
  DeviationType,
  PingResult,
  RollingStats,
  SessionSettings,
} from '@ping/shared';

export class DeviationDetector {
  private settings: SessionSettings;
  private lastLatency: number | null = null;
  private deviationCount = 0;

  constructor(settings: SessionSettings) {
    this.settings = settings;
  }

  updateSettings(settings: Partial<SessionSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }

  /**
   * Check if the current ping result is a deviation
   * Returns an array of deviation events (can be multiple: latency spike + jitter)
   */
  detect(result: PingResult, stats: RollingStats): DeviationEvent[] {
    const events: DeviationEvent[] = [];

    // Check for packet loss
    if (result.latency === null) {
      events.push(this.createEvent('packet_loss', 0, 0, result.timestamp));
      this.lastLatency = null;
      return events;
    }

    // Need sufficient samples for statistical detection
    const minSamples = 10;
    if (stats.sampleCount < minSamples) {
      this.lastLatency = result.latency;
      return events;
    }

    // Check for latency spike based on detection method
    const latencyDeviation = this.detectLatencySpike(result.latency, stats, result.timestamp);
    if (latencyDeviation) {
      events.push(latencyDeviation);
    }

    // Check for jitter spike
    const jitterDeviation = this.detectJitterSpike(result.latency, stats, result.timestamp);
    if (jitterDeviation) {
      events.push(jitterDeviation);
    }

    this.lastLatency = result.latency;
    return events;
  }

  private detectLatencySpike(
    latency: number,
    stats: RollingStats,
    timestamp: number
  ): DeviationEvent | null {
    switch (this.settings.detectionMethod) {
      case 'iqr': {
        // IQR-based detection
        // Outlier if latency > Q3 + (iqrMultiplier * IQR)
        const threshold = stats.q3 + this.settings.iqrMultiplier * stats.iqr;

        // Ensure threshold is meaningful (at least 1ms above median)
        const effectiveThreshold = Math.max(threshold, stats.median + 1);

        if (latency > effectiveThreshold) {
          return this.createEvent(
            'latency_spike',
            latency,
            effectiveThreshold,
            timestamp
          );
        }
        break;
      }

      case 'zscore': {
        // Z-score based detection
        if (stats.stdDev === 0) {
          return null;
        }
        const zScore = (latency - stats.mean) / stats.stdDev;
        if (zScore > this.settings.zScoreThreshold) {
          const threshold =
            stats.mean + this.settings.zScoreThreshold * stats.stdDev;
          return this.createEvent('latency_spike', latency, threshold, timestamp);
        }
        break;
      }

      case 'manual': {
        // Manual threshold detection
        const threshold = this.settings.manualLatencyThreshold;
        if (threshold !== null && latency > threshold) {
          return this.createEvent('latency_spike', latency, threshold, timestamp);
        }
        break;
      }
    }

    return null;
  }

  private detectJitterSpike(
    latency: number,
    stats: RollingStats,
    timestamp: number
  ): DeviationEvent | null {
    if (this.lastLatency === null) {
      return null;
    }

    const delta = Math.abs(latency - this.lastLatency);

    // Calculate jitter threshold
    let threshold: number;

    if (this.settings.manualJitterThreshold !== null) {
      threshold = this.settings.manualJitterThreshold;
    } else {
      // Auto threshold: 2x the mean jitter, minimum 2ms
      threshold = Math.max(stats.jitter * 2, 2);
    }

    if (delta > threshold) {
      return this.createEvent('jitter', delta, threshold, timestamp);
    }

    return null;
  }

  private createEvent(
    type: DeviationType,
    value: number,
    threshold: number,
    timestamp: number
  ): DeviationEvent {
    this.deviationCount++;
    return {
      id: `${type}-${timestamp}-${this.deviationCount}`,
      timestamp,
      type,
      value,
      threshold,
    };
  }

  getDeviationCount(): number {
    return this.deviationCount;
  }

  reset(): void {
    this.lastLatency = null;
    this.deviationCount = 0;
  }
}
