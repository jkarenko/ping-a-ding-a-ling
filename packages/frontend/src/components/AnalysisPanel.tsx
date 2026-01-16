import { useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  Clock,
  Zap,
  AlertTriangle,
  Download,
  ChevronDown,
  ChevronUp,
  Play,
  Loader2,
} from 'lucide-react';
import type { QualityGrade } from '@ping/shared';
import { useSessionStore } from '../stores/session.store';
import { Tooltip } from './Tooltip';

// Still need useState for isAnalyzing and error states

const GRADE_COLORS: Record<QualityGrade, string> = {
  A: 'text-green-500 bg-green-500/10',
  B: 'text-blue-500 bg-blue-500/10',
  C: 'text-yellow-500 bg-yellow-500/10',
  D: 'text-orange-500 bg-orange-500/10',
  F: 'text-red-500 bg-red-500/10',
};

const GRADE_DESCRIPTIONS: Record<QualityGrade, string> = {
  A: 'Excellent',
  B: 'Good',
  C: 'Acceptable',
  D: 'Poor',
  F: 'Bad',
};

export function AnalysisPanel() {
  const { sessionAnalysis, currentSession, isRunning, pingResults, setSessionAnalysis, uiState, setUIState } = useSessionStore();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setShowBursts = (show: boolean) => setUIState({ showBursts: show });

  // Check if we have a session with data
  const hasSessionWithData = currentSession && pingResults.length > 0;

  // Show nothing if no session or no data
  if (!hasSessionWithData) {
    return null;
  }

  // During active session, only show if we have analysis results
  if (isRunning && !sessionAnalysis) {
    return null;
  }

  const handleRunAnalysis = async () => {
    if (!currentSession) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await fetch(`/api/sessions/${currentSession.id}/analysis`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to run analysis');
      }
      const data = await response.json();
      setSessionAnalysis(data.analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run analysis');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleExportAnalysis = () => {
    if (currentSession) {
      window.open(`/api/sessions/${currentSession.id}/export/analysis`, '_blank');
    }
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes < 60) return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString();
  };

  // Show "Run Analysis" button if no analysis yet
  if (!sessionAnalysis) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
              Session Analysis
            </h3>
          </div>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Run analysis to compute detailed metrics, quality grade, and burst detection for this session.
        </p>
        {error && (
          <p className="text-sm text-red-500 mb-3">{error}</p>
        )}
        <button
          onClick={handleRunAnalysis}
          disabled={isAnalyzing}
          className="w-full flex items-center justify-center gap-2 px-4 py-2
                     bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400
                     text-white font-medium rounded-lg transition-colors"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Run Analysis
            </>
          )}
        </button>
      </div>
    );
  }

  // Show analysis results
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-4">
      {/* Header with grade */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            Session Analysis
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportAnalysis}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200
                       hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            title="Export Analysis JSON"
          >
            <Download className="w-4 h-4" />
          </button>
          <div
            className={`px-3 py-1.5 rounded-lg font-bold text-lg ${GRADE_COLORS[sessionAnalysis.qualityGrade]}`}
          >
            {sessionAnalysis.qualityGrade}
            <span className="text-xs font-normal ml-1">
              {GRADE_DESCRIPTIONS[sessionAnalysis.qualityGrade]}
            </span>
            <Tooltip content="Overall connection quality grade based on latency, jitter, packet loss, and stability. A: Excellent for competitive gaming. B: Good for most uses. C: Acceptable, minor issues. D: Poor, noticeable problems. F: Bad, significant issues." />
          </div>
        </div>
      </div>

      {/* Quality summary */}
      <p className="text-sm text-gray-600 dark:text-gray-400">
        {sessionAnalysis.qualitySummary}
      </p>

      {/* Timing section */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Timing
          </h4>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
            Duration
            <Tooltip content="Total time span of the monitoring session from first to last ping." />
          </div>
          <div className="text-gray-900 dark:text-gray-100">
            {formatDuration(sessionAnalysis.spanSeconds)}
          </div>
          <div className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
            Samples
            <Tooltip content="Total number of ping measurements collected during the session." />
          </div>
          <div className="text-gray-900 dark:text-gray-100">
            {sessionAnalysis.sampleCount.toLocaleString()}
          </div>
          <div className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
            Interval (median)
            <Tooltip content="Median time between consecutive pings. Should match your configured interval. Large deviations may indicate system load issues." />
          </div>
          <div className="text-gray-900 dark:text-gray-100">
            {(sessionAnalysis.samplingIntervalMedian * 1000).toFixed(0)}ms
          </div>
        </div>
      </div>

      {/* Latency section */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Latency Distribution
          </h4>
          <Tooltip content="Statistical breakdown of ping response times. Lower values are better. Large gaps between median and P95/P99 indicate occasional spikes." />
        </div>
        <div className="grid grid-cols-4 gap-2 text-sm text-center">
          <div>
            <div className="text-gray-500 dark:text-gray-400 text-xs flex items-center justify-center gap-0.5">
              Min
              <Tooltip content="Lowest latency observed. Represents best-case network performance." />
            </div>
            <div className="text-gray-900 dark:text-gray-100 font-medium">
              {sessionAnalysis.latencyMin.toFixed(1)}ms
            </div>
          </div>
          <div>
            <div className="text-gray-500 dark:text-gray-400 text-xs flex items-center justify-center gap-0.5">
              Median
              <Tooltip content="Middle value (50th percentile). Half of pings are faster, half are slower. More representative than mean for skewed data." />
            </div>
            <div className="text-gray-900 dark:text-gray-100 font-medium">
              {sessionAnalysis.latencyMedian.toFixed(1)}ms
            </div>
          </div>
          <div>
            <div className="text-gray-500 dark:text-gray-400 text-xs flex items-center justify-center gap-0.5">
              P95
              <Tooltip content="95th percentile. 95% of pings are faster than this. Shows typical worst-case latency excluding rare outliers." />
            </div>
            <div className="text-gray-900 dark:text-gray-100 font-medium">
              {sessionAnalysis.latencyP95.toFixed(1)}ms
            </div>
          </div>
          <div>
            <div className="text-gray-500 dark:text-gray-400 text-xs flex items-center justify-center gap-0.5">
              Max
              <Tooltip content="Highest latency observed. May be affected by outliers or one-off network events." />
            </div>
            <div className="text-gray-900 dark:text-gray-100 font-medium">
              {sessionAnalysis.latencyMax.toFixed(1)}ms
            </div>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
          <div className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
            Mean
            <Tooltip content="Average latency. Can be skewed by outliers - compare with median to assess impact of spikes." />
          </div>
          <div className="text-gray-900 dark:text-gray-100">
            {sessionAnalysis.latencyMean.toFixed(2)}ms
          </div>
          <div className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
            Std Dev
            <Tooltip content="Standard deviation - measures how spread out latencies are. Low std dev means consistent performance. High std dev indicates variable/unstable connection." />
          </div>
          <div className="text-gray-900 dark:text-gray-100">
            {sessionAnalysis.latencyStdDev.toFixed(2)}ms
          </div>
          <div className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
            P99
            <Tooltip content="99th percentile. Only 1% of pings are slower than this. Useful for understanding worst-case scenarios." />
          </div>
          <div className="text-gray-900 dark:text-gray-100">
            {sessionAnalysis.latencyP99.toFixed(1)}ms
          </div>
        </div>
      </div>

      {/* Threshold analysis */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Tail Risk (samples above threshold)
          </h4>
          <Tooltip content="Shows what percentage of pings exceeded common latency thresholds. Useful for assessing impact on different use cases. Gaming needs <50ms, video calls need <150ms." />
        </div>
        <div className="space-y-2">
          {sessionAnalysis.thresholds.map((threshold) => (
            <div key={threshold.thresholdMs} className="flex items-center gap-2">
              <div className="text-sm text-gray-500 dark:text-gray-400 w-16">
                ≥{threshold.thresholdMs}ms:
              </div>
              <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    threshold.percentage > 10
                      ? 'bg-red-500'
                      : threshold.percentage > 5
                        ? 'bg-orange-500'
                        : threshold.percentage > 1
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(threshold.percentage, 100)}%` }}
                />
              </div>
              <div className="text-sm text-gray-900 dark:text-gray-100 w-20 text-right">
                {threshold.count} ({threshold.percentage.toFixed(1)}%)
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Burst analysis */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <button
          onClick={() => setShowBursts(!uiState.showBursts)}
          className="w-full flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Latency Bursts
            </h4>
            <Tooltip content="Bursts are clusters of consecutive high-latency pings. They indicate temporary network congestion or interference. Frequent bursts suggest an unstable connection even if average latency is good." />
            <span className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full">
              {sessionAnalysis.burstCount}
            </span>
          </div>
          {uiState.showBursts ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </button>

        {sessionAnalysis.burstCount > 0 && (
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <div className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
              Burst count
              <Tooltip content="Total number of burst events detected during the session." />
            </div>
            <div className="text-gray-900 dark:text-gray-100">
              {sessionAnalysis.burstCount}
            </div>
            <div className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
              Median size
              <Tooltip content="Typical number of consecutive high-latency pings in a burst. Larger bursts mean longer periods of poor performance." />
            </div>
            <div className="text-gray-900 dark:text-gray-100">
              {sessionAnalysis.burstSizeMedian.toFixed(0)} samples
            </div>
            <div className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
              Max size
              <Tooltip content="Longest burst observed - the worst-case period of consecutive poor pings." />
            </div>
            <div className="text-gray-900 dark:text-gray-100">
              {sessionAnalysis.burstSizeMax} samples
            </div>
            {sessionAnalysis.interBurstIntervalMedian !== null && (
              <>
                <div className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  Interval (median)
                  <Tooltip content="Typical time between bursts. Short intervals indicate frequently recurring issues. Long intervals suggest occasional, isolated problems." />
                </div>
                <div className="text-gray-900 dark:text-gray-100">
                  {sessionAnalysis.interBurstIntervalMedian.toFixed(1)}s
                </div>
              </>
            )}
          </div>
        )}

        {uiState.showBursts && sessionAnalysis.bursts.length > 0 && (
          <div className="mt-3 max-h-40 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="text-left py-1">#</th>
                  <th className="text-left py-1">Time</th>
                  <th className="text-right py-1">Samples</th>
                  <th className="text-right py-1">Max</th>
                  <th className="text-right py-1">Mean</th>
                </tr>
              </thead>
              <tbody className="text-gray-900 dark:text-gray-100">
                {sessionAnalysis.bursts.map((burst) => (
                  <tr key={burst.index} className="border-t border-gray-200 dark:border-gray-700">
                    <td className="py-1">{burst.index + 1}</td>
                    <td className="py-1">{formatTimestamp(burst.startTimestamp)}</td>
                    <td className="text-right py-1">{burst.sampleCount}</td>
                    <td className="text-right py-1">{burst.maxLatency.toFixed(1)}ms</td>
                    <td className="text-right py-1">{burst.meanLatency.toFixed(1)}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
