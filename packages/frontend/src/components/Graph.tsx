import { useEffect, useRef, useMemo } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { useSessionStore } from '../stores/session.store';

interface GraphProps {
  className?: string;
}

export function Graph({ className = '' }: GraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const uplotRef = useRef<uPlot | null>(null);
  const { pingResults, theme, latestStats } = useSessionStore();

  // Prepare data for uPlot
  const data = useMemo(() => {
    if (pingResults.length === 0) {
      return [[], []] as [number[], (number | null)[]];
    }

    const timestamps: number[] = [];
    const latencies: (number | null)[] = [];

    for (const result of pingResults) {
      // Convert to seconds for uPlot (it expects Unix timestamps in seconds)
      timestamps.push(result.timestamp / 1000);
      latencies.push(result.latency);
    }

    return [timestamps, latencies] as [number[], (number | null)[]];
  }, [pingResults]);

  // Create or update chart
  useEffect(() => {
    if (!containerRef.current) return;

    const isDark = theme === 'dark';

    // Chart options
    const opts: uPlot.Options = {
      width: containerRef.current.clientWidth,
      height: 300,
      class: isDark ? 'dark-chart' : 'light-chart',
      scales: {
        x: {
          time: true,
        },
        y: {
          auto: true,
          range: (_self, min, max) => {
            // Add some padding
            const pad = (max - min) * 0.1 || 5;
            return [Math.max(0, min - pad), max + pad];
          },
        },
      },
      axes: [
        {
          stroke: isDark ? '#9ca3af' : '#4b5563',
          grid: {
            stroke: isDark ? '#374151' : '#e5e7eb',
            width: 1,
          },
          ticks: {
            stroke: isDark ? '#4b5563' : '#d1d5db',
          },
        },
        {
          stroke: isDark ? '#9ca3af' : '#4b5563',
          grid: {
            stroke: isDark ? '#374151' : '#e5e7eb',
            width: 1,
          },
          ticks: {
            stroke: isDark ? '#4b5563' : '#d1d5db',
          },
          label: 'Latency (ms)',
          labelFont: '12px sans-serif',
          labelGap: 8,
        },
      ],
      series: [
        {},
        {
          label: 'Latency',
          stroke: '#22c55e', // green
          width: 2,
          fill: isDark ? 'rgba(34, 197, 94, 0.1)' : 'rgba(34, 197, 94, 0.05)',
          points: {
            show: false,
          },
        },
      ],
      cursor: {
        show: true,
        x: true,
        y: true,
        points: {
          show: true,
          size: 6,
          fill: '#22c55e',
        },
      },
      legend: {
        show: false,
      },
    };

    // Destroy existing chart
    if (uplotRef.current) {
      uplotRef.current.destroy();
    }

    // Create new chart
    uplotRef.current = new uPlot(opts, data, containerRef.current);

    // Handle resize
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (uplotRef.current && entry.target === containerRef.current) {
          uplotRef.current.setSize({
            width: entry.contentRect.width,
            height: 300,
          });
        }
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (uplotRef.current) {
        uplotRef.current.destroy();
        uplotRef.current = null;
      }
    };
  }, [theme]);

  // Update data
  useEffect(() => {
    if (uplotRef.current && data[0].length > 0) {
      uplotRef.current.setData(data);
    }
  }, [data]);

  return (
    <div className={`relative ${className}`}>
      <div ref={containerRef} className="w-full" />

      {/* Stats overlay */}
      {latestStats && (
        <div className="absolute top-2 right-2 bg-gray-800/80 dark:bg-gray-900/80 text-white text-xs rounded px-2 py-1 font-mono">
          <div>Mean: {latestStats.mean.toFixed(2)}ms</div>
          <div>P95: {latestStats.p95.toFixed(2)}ms</div>
          <div>Jitter: {latestStats.jitter.toFixed(2)}ms</div>
        </div>
      )}

      {/* Empty state */}
      {pingResults.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-500 dark:text-gray-400">
          Start a session to see latency data
        </div>
      )}
    </div>
  );
}
