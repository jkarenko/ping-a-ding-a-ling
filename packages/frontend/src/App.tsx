import { useEffect } from 'react';
import { Sun, Moon, Camera, Activity } from 'lucide-react';
import { useSessionStore } from './stores/session.store';
import { Graph } from './components/Graph';
import { FlashBorder } from './components/FlashBorder';
import { DeviationLog } from './components/DeviationLog';
import { SettingsPanel } from './components/SettingsPanel';
import { SessionPanel } from './components/SessionPanel';
import { AnalysisPanel } from './components/AnalysisPanel';
import { exportGraphAsPNG } from './utils/export';

function App() {
  const { theme, toggleTheme, latestStats, finalStats, isRunning, currentSession, setSessionAnalysis } = useSessionStore();

  // Apply persisted theme on mount
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  // Run analysis every 10 seconds during active monitoring
  useEffect(() => {
    if (!isRunning || !currentSession) return;

    const runAnalysis = async () => {
      try {
        const response = await fetch(`/api/sessions/${currentSession.id}/analysis?live=true`);
        if (response.ok) {
          const data = await response.json();
          setSessionAnalysis(data.analysis);
        }
      } catch {
        // Silently ignore errors during live analysis
      }
    };

    // Run immediately after first 10 seconds, then every 10 seconds
    const timeoutId = setTimeout(() => {
      runAnalysis();
    }, 10000);

    const intervalId = setInterval(runAnalysis, 10000);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [isRunning, currentSession, setSessionAnalysis]);

  const handleExportPNG = async () => {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      await exportGraphAsPNG('graph-container', `ping-graph-${timestamp}.png`);
    } catch (error) {
      console.error('Failed to export:', error);
      alert('Failed to export graph as PNG');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="w-8 h-8 text-green-500" />
            <h1 className="text-xl font-bold">Ping-a-Ding-a-Ling</h1>
          </div>

          <div className="flex items-center gap-2">
            {/* Export PNG button */}
            <button
              onClick={handleExportPNG}
              className="p-2 rounded-lg text-gray-500 dark:text-gray-400
                       hover:bg-gray-100 dark:hover:bg-gray-700
                       transition-colors"
              title="Export graph as PNG"
            >
              <Camera className="w-5 h-5" />
            </button>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-gray-500 dark:text-gray-400
                       hover:bg-gray-100 dark:hover:bg-gray-700
                       transition-colors"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left sidebar - Settings & Session */}
          <div className="lg:col-span-3 space-y-4">
            <SettingsPanel />
            <SessionPanel />
          </div>

          {/* Main content - Graph */}
          <div className="lg:col-span-6">
            <FlashBorder className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div id="graph-container">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Latency Graph</h2>
                  {isRunning && (
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        Monitoring
                      </span>
                    </div>
                  )}
                </div>
                <Graph className="min-h-[300px]" />
              </div>
            </FlashBorder>

            {/* Stats cards - show live stats during monitoring, final stats for history */}
            {(latestStats || finalStats) && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                <StatCard
                  label="Mean"
                  value={`${(latestStats?.mean ?? finalStats?.latencyMean ?? 0).toFixed(2)}ms`}
                  color="green"
                />
                <StatCard
                  label="P95"
                  value={`${(latestStats?.p95 ?? finalStats?.latencyP95 ?? 0).toFixed(2)}ms`}
                  color="yellow"
                />
                <StatCard
                  label="Jitter"
                  value={`${(latestStats?.jitter ?? finalStats?.jitterMean ?? 0).toFixed(2)}ms`}
                  color="blue"
                />
                <StatCard
                  label="Loss"
                  value={`${(latestStats?.packetLossRate ?? finalStats?.packetLoss ?? 0).toFixed(1)}%`}
                  color={(latestStats?.packetLossRate ?? finalStats?.packetLoss ?? 0) > 0 ? 'red' : 'green'}
                />
              </div>
            )}

            {/* Session Analysis (shown for historical sessions) */}
            <div className="mt-4">
              <AnalysisPanel />
            </div>
          </div>

          {/* Right sidebar - Deviation Log */}
          <div className="lg:col-span-3">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow h-[500px]">
              <DeviationLog />
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-8 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>Ping-a-Ding-a-Ling - Network Latency Monitor</p>
      </footer>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  color: 'green' | 'yellow' | 'red' | 'blue';
}

function StatCard({ label, value, color }: StatCardProps) {
  const colorClasses = {
    green: 'text-green-500',
    yellow: 'text-yellow-500',
    red: 'text-red-500',
    blue: 'text-blue-500',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3">
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</div>
      <div className={`text-lg font-semibold ${colorClasses[color]}`}>{value}</div>
    </div>
  );
}

export default App;
