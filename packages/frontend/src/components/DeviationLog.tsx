import { useMemo } from 'react';
import { AlertTriangle, WifiOff, Activity } from 'lucide-react';
import type { DeviationType } from '@ping/shared';
import { useSessionStore } from '../stores/session.store';

export function DeviationLog() {
  const { deviationEvents } = useSessionStore();

  // Calculate statistics
  const stats = useMemo(() => {
    if (deviationEvents.length === 0) {
      return null;
    }

    const byType: Record<DeviationType, number> = {
      latency_spike: 0,
      packet_loss: 0,
      jitter: 0,
    };

    for (const event of deviationEvents) {
      byType[event.type]++;
    }

    // Calculate mean time between deviations
    let meanInterval: number | null = null;
    if (deviationEvents.length > 1) {
      const sorted = [...deviationEvents].sort((a, b) => a.timestamp - b.timestamp);
      let totalInterval = 0;
      for (let i = 1; i < sorted.length; i++) {
        totalInterval += sorted[i].timestamp - sorted[i - 1].timestamp;
      }
      meanInterval = totalInterval / (sorted.length - 1);
    }

    return {
      total: deviationEvents.length,
      byType,
      meanInterval,
    };
  }, [deviationEvents]);

  const getIcon = (type: DeviationType) => {
    switch (type) {
      case 'latency_spike':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'packet_loss':
        return <WifiOff className="w-4 h-4 text-red-500" />;
      case 'jitter':
        return <Activity className="w-4 h-4 text-orange-500" />;
    }
  };

  const getTypeLabel = (type: DeviationType) => {
    switch (type) {
      case 'latency_spike':
        return 'Latency Spike';
      case 'packet_loss':
        return 'Packet Loss';
      case 'jitter':
        return 'Jitter Spike';
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatInterval = (ms: number) => {
    if (ms < 1000) {
      return `${ms.toFixed(0)}ms`;
    }
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Stats header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Deviations
        </h3>

        {stats ? (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Total</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {stats.total}
              </span>
            </div>

            {stats.meanInterval !== null && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Mean interval</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {formatInterval(stats.meanInterval)}
                </span>
              </div>
            )}

            <div className="pt-2 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                  <AlertTriangle className="w-3 h-3 text-yellow-500" />
                  Spikes
                </span>
                <span className="font-medium">{stats.byType.latency_spike}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                  <WifiOff className="w-3 h-3 text-red-500" />
                  Packet loss
                </span>
                <span className="font-medium">{stats.byType.packet_loss}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                  <Activity className="w-3 h-3 text-orange-500" />
                  Jitter
                </span>
                <span className="font-medium">{stats.byType.jitter}</span>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No deviations detected
          </p>
        )}
      </div>

      {/* Event list */}
      <div className="flex-1 overflow-y-auto">
        {deviationEvents.length === 0 ? (
          <div className="p-4 text-sm text-gray-500 dark:text-gray-400 text-center">
            Deviations will appear here
          </div>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {[...deviationEvents].reverse().slice(0, 100).map((event) => (
              <li
                key={event.id}
                className="px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/50"
              >
                <div className="flex items-center gap-2">
                  {getIcon(event.type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {getTypeLabel(event.type)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatTime(event.timestamp)}
                      {event.type !== 'packet_loss' && (
                        <span className="ml-2">
                          {event.value.toFixed(2)}ms (threshold: {event.threshold.toFixed(2)}ms)
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
