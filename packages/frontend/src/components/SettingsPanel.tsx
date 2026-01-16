import { Settings, ChevronDown, ChevronUp } from 'lucide-react';
import type { DetectionMethod } from '@ping/shared';
import { useSessionStore } from '../stores/session.store';
import { Tooltip } from './Tooltip';

export function SettingsPanel() {
  const { settings, setSettings, isRunning, uiState, setUIState } = useSessionStore();

  const expanded = uiState.showAdvancedSettings;
  const setExpanded = (show: boolean) => setUIState({ showAdvancedSettings: show });

  const handleTargetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings({ target: e.target.value });
  };

  const handleIntervalChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newInterval = parseInt(e.target.value, 10);
    // Recalculate rolling window ping count to maintain the same time window
    const currentWindowSeconds = Math.round((settings.rollingWindowSize * settings.interval) / 1000);
    const newPingCount = Math.round((currentWindowSeconds * 1000) / newInterval);
    setSettings({ interval: newInterval, rollingWindowSize: newPingCount });
  };

  const handleDetectionMethodChange = (method: DetectionMethod) => {
    setSettings({ detectionMethod: method });
  };

  const handleIqrMultiplierChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSettings({ iqrMultiplier: parseFloat(e.target.value) });
  };

  const handleZScoreThresholdChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSettings({ zScoreThreshold: parseFloat(e.target.value) });
  };

  const handleManualLatencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value ? parseFloat(e.target.value) : null;
    setSettings({ manualLatencyThreshold: value });
  };

  const handleManualJitterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value ? parseFloat(e.target.value) : null;
    setSettings({ manualJitterThreshold: value });
  };

  const handleRollingWindowChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    // Value is in seconds, convert to ping count based on interval
    const seconds = parseInt(e.target.value, 10);
    const pingCount = Math.round((seconds * 1000) / settings.interval);
    setSettings({ rollingWindowSize: pingCount });
  };

  // Calculate current window in seconds from ping count
  const windowSeconds = Math.round((settings.rollingWindowSize * settings.interval) / 1000);

  // Calculate ping count for a given window in seconds
  const getPingCount = (seconds: number) => Math.round((seconds * 1000) / settings.interval);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      {/* Basic settings (always visible) */}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Settings
          </h3>
        </div>

        <div className="space-y-4">
          {/* Target */}
          <div>
            <label
              htmlFor="target"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Target (IP or hostname)
            </label>
            <input
              type="text"
              id="target"
              value={settings.target}
              onChange={handleTargetChange}
              disabled={isRunning}
              placeholder="e.g., 192.168.1.1 or router.local"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                         placeholder-gray-400 dark:placeholder-gray-500
                         focus:ring-2 focus:ring-green-500 focus:border-transparent
                         disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Interval */}
          <div>
            <label
              htmlFor="interval"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Ping interval
            </label>
            <select
              id="interval"
              value={settings.interval}
              onChange={handleIntervalChange}
              disabled={isRunning}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                         focus:ring-2 focus:ring-green-500 focus:border-transparent
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="50">50ms (20/sec)</option>
              <option value="100">100ms (10/sec)</option>
              <option value="200">200ms (5/sec)</option>
              <option value="500">500ms (2/sec)</option>
              <option value="1000">1000ms (1/sec)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Advanced settings toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2 flex items-center justify-between text-sm
                   text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50
                   border-t border-gray-200 dark:border-gray-700"
      >
        <span>Advanced settings</span>
        {expanded ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>

      {/* Advanced settings */}
      {expanded && (
        <div className="p-4 pt-0 space-y-4 border-t border-gray-200 dark:border-gray-700">
          {/* Detection method */}
          <div>
            <div className="flex items-center gap-1 mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Detection method
              </label>
              <Tooltip content="Choose how deviations are detected. IQR is robust against outliers, Z-score assumes normal distribution, Manual lets you set fixed thresholds." />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="detectionMethod"
                  value="iqr"
                  checked={settings.detectionMethod === 'iqr'}
                  onChange={() => handleDetectionMethodChange('iqr')}
                  className="text-green-500 focus:ring-green-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  IQR-based (recommended)
                </span>
                <Tooltip content="Interquartile Range method. Calculates Q1 (25th percentile) and Q3 (75th percentile), then flags values beyond Q3 + multiplier × IQR. More robust to existing outliers in data." />
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="detectionMethod"
                  value="zscore"
                  checked={settings.detectionMethod === 'zscore'}
                  onChange={() => handleDetectionMethodChange('zscore')}
                  className="text-green-500 focus:ring-green-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Z-score based
                </span>
                <Tooltip content="Statistical method measuring how many standard deviations a value is from the mean. Works best when latency follows a normal distribution. Z-score of 2 means ~95% of normal values are below threshold." />
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="detectionMethod"
                  value="manual"
                  checked={settings.detectionMethod === 'manual'}
                  onChange={() => handleDetectionMethodChange('manual')}
                  className="text-green-500 focus:ring-green-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Manual threshold
                </span>
                <Tooltip content="Set explicit millisecond thresholds for latency and jitter. Any value exceeding your threshold triggers a deviation. Simple and predictable." />
              </label>
            </div>
          </div>

          {/* IQR settings */}
          {settings.detectionMethod === 'iqr' && (
            <div>
              <div className="flex items-center gap-1 mb-1">
                <label
                  htmlFor="iqrMultiplier"
                  className="text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  IQR multiplier
                </label>
                <Tooltip content="Multiplier for IQR to determine outlier threshold. 1.5× detects mild outliers (more sensitive), 3× detects only extreme outliers (less sensitive). Threshold = Q3 + multiplier × IQR." />
              </div>
              <select
                id="iqrMultiplier"
                value={settings.iqrMultiplier}
                onChange={handleIqrMultiplierChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                           focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="1.5">1.5x (mild outliers)</option>
                <option value="3">3x (extreme outliers)</option>
              </select>
            </div>
          )}

          {/* Z-score settings */}
          {settings.detectionMethod === 'zscore' && (
            <div>
              <div className="flex items-center gap-1 mb-1">
                <label
                  htmlFor="zScoreThreshold"
                  className="text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Z-score threshold
                </label>
                <Tooltip content="Number of standard deviations from mean to trigger deviation. Lower = more sensitive. 1.5 catches ~93% outliers, 2.0 catches ~95%, 3.0 catches ~99.7% (very conservative)." />
              </div>
              <select
                id="zScoreThreshold"
                value={settings.zScoreThreshold}
                onChange={handleZScoreThresholdChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                           focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="1.5">1.5 (sensitive)</option>
                <option value="2">2 (standard)</option>
                <option value="2.5">2.5 (moderate)</option>
                <option value="3">3 (conservative)</option>
              </select>
            </div>
          )}

          {/* Manual threshold settings */}
          {settings.detectionMethod === 'manual' && (
            <>
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <label
                    htmlFor="manualLatency"
                    className="text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Latency threshold (ms)
                  </label>
                  <Tooltip content="Fixed latency threshold in milliseconds. Any ping exceeding this value triggers a latency spike deviation. For local network, 10-20ms is typical. For internet, 50-100ms is common." />
                </div>
                <input
                  type="number"
                  id="manualLatency"
                  value={settings.manualLatencyThreshold ?? ''}
                  onChange={handleManualLatencyChange}
                  placeholder="e.g., 15"
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md
                             bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                             placeholder-gray-400 dark:placeholder-gray-500
                             focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <label
                    htmlFor="manualJitter"
                    className="text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Jitter threshold (ms)
                  </label>
                  <Tooltip content="Fixed jitter threshold in milliseconds. Jitter is the variation between consecutive pings. High jitter (>5ms) can cause stuttering in real-time applications like gaming or video calls." />
                </div>
                <input
                  type="number"
                  id="manualJitter"
                  value={settings.manualJitterThreshold ?? ''}
                  onChange={handleManualJitterChange}
                  placeholder="e.g., 5"
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md
                             bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                             placeholder-gray-400 dark:placeholder-gray-500
                             focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </>
          )}

          {/* Rolling window size */}
          <div>
            <div className="flex items-center gap-1 mb-1">
              <label
                htmlFor="rollingWindow"
                className="text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Rolling window size
              </label>
              <Tooltip content="Time window for calculating statistics and detecting deviations. Shorter windows react faster to changes but may be noisier. Longer windows are more stable but slower to detect issues." />
            </div>
            <select
              id="rollingWindow"
              value={windowSeconds}
              onChange={handleRollingWindowChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                         focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="5">5s ({getPingCount(5)} pings)</option>
              <option value="10">10s ({getPingCount(10)} pings)</option>
              <option value="20">20s ({getPingCount(20)} pings)</option>
              <option value="50">50s ({getPingCount(50)} pings)</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
