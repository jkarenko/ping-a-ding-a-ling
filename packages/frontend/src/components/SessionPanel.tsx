import { useEffect, useState } from 'react';
import {
  Play,
  Square,
  Clock,
  Download,
  Trash2,
  History,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { Session } from '@ping/shared';
import { useSessionStore } from '../stores/session.store';
import { useWebSocket } from '../hooks/useWebSocket';

export function SessionPanel() {
  const {
    settings,
    isRunning,
    currentSession,
    finalStats,
    historicalSessions,
    setHistoricalSessions,
    selectedHistoricalSession,
    loadHistoricalSession,
    reset,
  } = useSessionStore();

  const { startPingSession, stopPingSession } = useWebSocket();
  const [showHistory, setShowHistory] = useState(false);
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);

  // Fetch historical sessions on mount
  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/sessions');
      const data = await response.json();
      setHistoricalSessions(data.sessions);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    }
  };

  const handleStart = () => {
    if (!settings.target.trim()) {
      alert('Please enter a target IP or hostname');
      return;
    }
    reset();
    startPingSession(settings);
  };

  const handleStop = () => {
    stopPingSession();
    // Refresh session list after a short delay
    setTimeout(fetchSessions, 500);
  };

  const handleSelectSession = async (session: Session) => {
    setLoadingSessionId(session.id);
    try {
      const response = await fetch(`/api/sessions/${session.id}`);
      const data = await response.json();
      loadHistoricalSession(
        data.session,
        data.pingResults || [],
        data.deviationEvents || [],
        data.stats || null
      );
    } catch (error) {
      console.error('Failed to load session:', error);
    } finally {
      setLoadingSessionId(null);
    }
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this session?')) {
      return;
    }
    try {
      await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
      fetchSessions();
      if (selectedHistoricalSession?.id === sessionId) {
        selectHistoricalSession(null);
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  const handleExportCSV = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`/api/sessions/${sessionId}/export/csv`, '_blank');
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatDuration = (start: number, end: number | null) => {
    const duration = (end || Date.now()) - start;
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  return (
    <div className="space-y-4">
      {/* Control buttons */}
      <div className="flex gap-2">
        {isRunning ? (
          <button
            onClick={handleStop}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3
                       bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg
                       transition-colors"
          >
            <Square className="w-5 h-5" />
            Stop
          </button>
        ) : (
          <button
            onClick={handleStart}
            disabled={!settings.target.trim()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3
                       bg-green-500 hover:bg-green-600 disabled:bg-gray-400
                       text-white font-medium rounded-lg transition-colors
                       disabled:cursor-not-allowed"
          >
            <Play className="w-5 h-5" />
            Start
          </button>
        )}
      </div>

      {/* Current session info */}
      {currentSession && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {isRunning ? 'Active Session' : 'Session Ended'}
            </span>
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <div>Target: {currentSession.target}</div>
            <div>
              Duration: {formatDuration(currentSession.createdAt, currentSession.endedAt)}
            </div>
            {finalStats && (
              <>
                <div className="pt-2 border-t border-gray-200 dark:border-gray-700 mt-2">
                  <div>Total pings: {finalStats.totalPings}</div>
                  <div>Packet loss: {finalStats.packetLoss.toFixed(2)}%</div>
                  <div>Mean latency: {finalStats.latencyMean.toFixed(2)}ms</div>
                  <div>P95 latency: {finalStats.latencyP95.toFixed(2)}ms</div>
                  <div>Deviations: {finalStats.deviationCount}</div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* History toggle */}
      <button
        onClick={() => setShowHistory(!showHistory)}
        className="w-full flex items-center justify-between px-4 py-2
                   bg-white dark:bg-gray-800 rounded-lg shadow
                   text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
      >
        <div className="flex items-center gap-2">
          <History className="w-4 h-4" />
          <span className="text-sm font-medium">Session History</span>
          {historicalSessions.length > 0 && (
            <span className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full">
              {historicalSessions.length}
            </span>
          )}
        </div>
        {showHistory ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>

      {/* Session history list */}
      {showHistory && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {historicalSessions.length === 0 ? (
            <div className="p-4 text-sm text-gray-500 dark:text-gray-400 text-center">
              No previous sessions
            </div>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700 max-h-64 overflow-y-auto">
              {historicalSessions.map((session) => (
                <li
                  key={session.id}
                  onClick={() => handleSelectSession(session)}
                  className={`
                    px-4 py-3 cursor-pointer transition-colors
                    ${
                      selectedHistoricalSession?.id === session.id
                        ? 'bg-green-50 dark:bg-green-900/20'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }
                    ${loadingSessionId === session.id ? 'opacity-50' : ''}
                  `}
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {loadingSessionId === session.id ? 'Loading...' : session.target}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(session.createdAt)}
                        <span className="mx-1">·</span>
                        {formatDuration(session.createdAt, session.endedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={(e) => handleExportCSV(session.id, e)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200
                                   hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                        title="Export CSV"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteSession(session.id, e)}
                        className="p-1.5 text-gray-400 hover:text-red-500
                                   hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                        title="Delete session"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
