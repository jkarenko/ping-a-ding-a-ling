import type {
  PingResult,
  SessionAnalysis,
  LatencyBurst,
  ThresholdCount,
  QualityGrade,
} from '@ping/shared';

// Threshold levels to analyze (in ms)
const THRESHOLD_LEVELS = [10, 20, 50, 100];

// Burst detection: gap in ms to consider a new burst
const BURST_GAP_MS = 5000;

// Spike threshold for burst detection (ms)
const SPIKE_THRESHOLD_MS = 10;

/**
 * Compute comprehensive analysis of a session's ping data
 */
export function computeSessionAnalysis(
  sessionId: string,
  pingResults: PingResult[]
): SessionAnalysis {
  const computedAt = Date.now();

  // Filter to only successful pings for latency analysis
  const successfulPings = pingResults.filter((p) => p.latency !== null);
  const latencies = successfulPings.map((p) => p.latency as number);

  // Sort by timestamp for time-series analysis
  const sortedResults = [...pingResults].sort((a, b) => a.timestamp - b.timestamp);

  // Timing metrics
  const timing = computeTimingMetrics(sortedResults);

  // Latency distribution
  const latencyStats = computeLatencyStats(latencies);

  // Threshold analysis
  const thresholds = computeThresholdCounts(latencies);

  // Burst analysis
  const burstAnalysis = computeBurstAnalysis(sortedResults);

  // Quality assessment
  const quality = assessQuality(latencyStats, thresholds, timing.sampleCount);

  return {
    sessionId,
    computedAt,
    ...timing,
    ...latencyStats,
    thresholds,
    ...burstAnalysis,
    ...quality,
  };
}

interface TimingMetrics {
  spanSeconds: number;
  sampleCount: number;
  samplingIntervalMean: number;
  samplingIntervalMedian: number;
  samplingIntervalP95: number;
}

function computeTimingMetrics(sortedResults: PingResult[]): TimingMetrics {
  if (sortedResults.length < 2) {
    return {
      spanSeconds: 0,
      sampleCount: sortedResults.length,
      samplingIntervalMean: 0,
      samplingIntervalMedian: 0,
      samplingIntervalP95: 0,
    };
  }

  const firstTimestamp = sortedResults[0].timestamp;
  const lastTimestamp = sortedResults[sortedResults.length - 1].timestamp;
  const spanSeconds = (lastTimestamp - firstTimestamp) / 1000;

  // Compute inter-sample intervals
  const intervals: number[] = [];
  for (let i = 1; i < sortedResults.length; i++) {
    intervals.push((sortedResults[i].timestamp - sortedResults[i - 1].timestamp) / 1000);
  }

  const sortedIntervals = [...intervals].sort((a, b) => a - b);
  const n = sortedIntervals.length;

  return {
    spanSeconds,
    sampleCount: sortedResults.length,
    samplingIntervalMean: intervals.reduce((a, b) => a + b, 0) / n,
    samplingIntervalMedian: n % 2 === 0
      ? (sortedIntervals[n / 2 - 1] + sortedIntervals[n / 2]) / 2
      : sortedIntervals[Math.floor(n / 2)],
    samplingIntervalP95: sortedIntervals[Math.floor(n * 0.95)] || 0,
  };
}

interface LatencyStats {
  latencyMin: number;
  latencyMean: number;
  latencyMedian: number;
  latencyP95: number;
  latencyP99: number;
  latencyMax: number;
  latencyStdDev: number;
}

function computeLatencyStats(latencies: number[]): LatencyStats {
  if (latencies.length === 0) {
    return {
      latencyMin: 0,
      latencyMean: 0,
      latencyMedian: 0,
      latencyP95: 0,
      latencyP99: 0,
      latencyMax: 0,
      latencyStdDev: 0,
    };
  }

  const sorted = [...latencies].sort((a, b) => a - b);
  const n = sorted.length;
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = sum / n;

  // Standard deviation
  const squaredDiffs = sorted.map((v) => Math.pow(v - mean, 2));
  const stdDev = Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / n);

  return {
    latencyMin: sorted[0],
    latencyMean: mean,
    latencyMedian: n % 2 === 0
      ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
      : sorted[Math.floor(n / 2)],
    latencyP95: sorted[Math.floor(n * 0.95)] || sorted[n - 1],
    latencyP99: sorted[Math.floor(n * 0.99)] || sorted[n - 1],
    latencyMax: sorted[n - 1],
    latencyStdDev: stdDev,
  };
}

function computeThresholdCounts(latencies: number[]): ThresholdCount[] {
  const total = latencies.length;
  if (total === 0) {
    return THRESHOLD_LEVELS.map((t) => ({
      thresholdMs: t,
      count: 0,
      percentage: 0,
    }));
  }

  return THRESHOLD_LEVELS.map((threshold) => {
    const count = latencies.filter((l) => l >= threshold).length;
    return {
      thresholdMs: threshold,
      count,
      percentage: (count / total) * 100,
    };
  });
}

interface BurstAnalysis {
  burstCount: number;
  burstSizeMedian: number;
  burstSizeMax: number;
  interBurstIntervalMedian: number | null;
  interBurstIntervalP95: number | null;
  bursts: LatencyBurst[];
}

function computeBurstAnalysis(sortedResults: PingResult[]): BurstAnalysis {
  // Find spike samples (latency >= threshold or packet loss)
  const spikeSamples = sortedResults.filter(
    (p) => p.latency === null || p.latency >= SPIKE_THRESHOLD_MS
  );

  if (spikeSamples.length === 0) {
    return {
      burstCount: 0,
      burstSizeMedian: 0,
      burstSizeMax: 0,
      interBurstIntervalMedian: null,
      interBurstIntervalP95: null,
      bursts: [],
    };
  }

  // Group consecutive spikes into bursts
  const bursts: LatencyBurst[] = [];
  let currentBurst: PingResult[] = [spikeSamples[0]];

  for (let i = 1; i < spikeSamples.length; i++) {
    const gap = spikeSamples[i].timestamp - spikeSamples[i - 1].timestamp;
    if (gap <= BURST_GAP_MS) {
      // Continue current burst
      currentBurst.push(spikeSamples[i]);
    } else {
      // Finalize current burst and start new one
      bursts.push(createBurst(bursts.length, currentBurst));
      currentBurst = [spikeSamples[i]];
    }
  }
  // Don't forget the last burst
  bursts.push(createBurst(bursts.length, currentBurst));

  // Compute burst statistics
  const burstSizes = bursts.map((b) => b.sampleCount);
  const sortedSizes = [...burstSizes].sort((a, b) => a - b);
  const n = sortedSizes.length;

  // Inter-burst intervals
  let interBurstIntervalMedian: number | null = null;
  let interBurstIntervalP95: number | null = null;

  if (bursts.length > 1) {
    const intervals: number[] = [];
    for (let i = 1; i < bursts.length; i++) {
      intervals.push((bursts[i].startTimestamp - bursts[i - 1].endTimestamp) / 1000);
    }
    const sortedIntervals = [...intervals].sort((a, b) => a - b);
    const m = sortedIntervals.length;
    interBurstIntervalMedian = m % 2 === 0
      ? (sortedIntervals[m / 2 - 1] + sortedIntervals[m / 2]) / 2
      : sortedIntervals[Math.floor(m / 2)];
    interBurstIntervalP95 = sortedIntervals[Math.floor(m * 0.95)] || sortedIntervals[m - 1];
  }

  return {
    burstCount: bursts.length,
    burstSizeMedian: n % 2 === 0
      ? (sortedSizes[n / 2 - 1] + sortedSizes[n / 2]) / 2
      : sortedSizes[Math.floor(n / 2)],
    burstSizeMax: sortedSizes[n - 1],
    interBurstIntervalMedian,
    interBurstIntervalP95,
    bursts,
  };
}

function createBurst(index: number, samples: PingResult[]): LatencyBurst {
  const latencies = samples
    .map((s) => s.latency)
    .filter((l): l is number => l !== null);

  return {
    index,
    startTimestamp: samples[0].timestamp,
    endTimestamp: samples[samples.length - 1].timestamp,
    sampleCount: samples.length,
    maxLatency: latencies.length > 0 ? Math.max(...latencies) : 0,
    meanLatency: latencies.length > 0
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length
      : 0,
  };
}

interface QualityAssessment {
  qualityGrade: QualityGrade;
  qualitySummary: string;
}

function assessQuality(
  latencyStats: LatencyStats,
  thresholds: ThresholdCount[],
  sampleCount: number
): QualityAssessment {
  if (sampleCount === 0) {
    return {
      qualityGrade: 'F',
      qualitySummary: 'No data available for analysis.',
    };
  }

  // Get threshold percentages
  const pct10ms = thresholds.find((t) => t.thresholdMs === 10)?.percentage || 0;
  const pct20ms = thresholds.find((t) => t.thresholdMs === 20)?.percentage || 0;
  const pct50ms = thresholds.find((t) => t.thresholdMs === 50)?.percentage || 0;

  // Grade based on percentage of samples exceeding thresholds
  // A: <1% over 10ms - Excellent for game streaming
  // B: <3% over 10ms - Good for most streaming
  // C: <5% over 10ms or <1% over 20ms - Acceptable with occasional hiccups
  // D: <10% over 10ms or <3% over 20ms - Noticeable issues
  // F: Worse than above - Poor for streaming

  let grade: QualityGrade;
  let summary: string;

  if (pct10ms < 1 && latencyStats.latencyP95 < 10) {
    grade = 'A';
    summary = `Excellent for game streaming. ${(100 - pct10ms).toFixed(1)}% of samples under 10ms. P95: ${latencyStats.latencyP95.toFixed(1)}ms.`;
  } else if (pct10ms < 3 && pct20ms < 1) {
    grade = 'B';
    summary = `Good for most streaming. ${(100 - pct10ms).toFixed(1)}% of samples under 10ms. P95: ${latencyStats.latencyP95.toFixed(1)}ms.`;
  } else if (pct10ms < 5 || (pct20ms < 1 && pct10ms < 10)) {
    grade = 'C';
    summary = `Acceptable with occasional hiccups. ${pct10ms.toFixed(1)}% of samples ≥10ms. P95: ${latencyStats.latencyP95.toFixed(1)}ms.`;
  } else if (pct10ms < 10 || pct20ms < 3) {
    grade = 'D';
    summary = `Noticeable latency issues. ${pct10ms.toFixed(1)}% of samples ≥10ms, ${pct20ms.toFixed(1)}% ≥20ms. May cause stutter.`;
  } else {
    grade = 'F';
    summary = `Poor for streaming. ${pct10ms.toFixed(1)}% of samples ≥10ms, ${pct50ms.toFixed(1)}% ≥50ms. Expect frequent stuttering.`;
  }

  return { qualityGrade: grade, qualitySummary: summary };
}
