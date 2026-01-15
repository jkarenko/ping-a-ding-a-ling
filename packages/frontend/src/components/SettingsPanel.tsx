import { useState } from 'react';
import { Settings, ChevronDown, ChevronUp } from 'lucide-react';
import type { DetectionMethod } from '@ping/shared';
import { useSessionStore } from '../stores/session.store';

export function SettingsPanel() {
  const { settings, setSettings, isRunning } = useSessionStore();
  const [expanded, setExpanded] = useState(false);

  const handleTargetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings({ target: e.target.value });
  };

  const handleIntervalChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSettings({ interval: parseInt(e.target.value, 10) });
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
    setSettings({ rollingWindowSize: parseInt(e.target.value, 10) });
  };

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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Detection method
            </label>
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
              </label>
            </div>
          </div>

          {/* IQR settings */}
          {settings.detectionMethod === 'iqr' && (
            <div>
              <label
                htmlFor="iqrMultiplier"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                IQR multiplier
              </label>
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
              <label
                htmlFor="zScoreThreshold"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Z-score threshold
              </label>
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
                <label
                  htmlFor="manualLatency"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Latency threshold (ms)
                </label>
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
                <label
                  htmlFor="manualJitter"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Jitter threshold (ms)
                </label>
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
            <label
              htmlFor="rollingWindow"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Rolling window size
            </label>
            <select
              id="rollingWindow"
              value={settings.rollingWindowSize}
              onChange={handleRollingWindowChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                         focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="50">50 pings (~5 sec)</option>
              <option value="100">100 pings (~10 sec)</option>
              <option value="200">200 pings (~20 sec)</option>
              <option value="500">500 pings (~50 sec)</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
