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
  const { pingResults, theme } = useSessionStore();

  // Prepare data for uPlot: [timestamps, latencies, jitter, packetLoss]
  const data = useMemo(() => {
    if (pingResults.length === 0) {
      return [[], [], [], []] as [number[], (number | null)[], (number | null)[], (number | null)[]];
    }

    const timestamps: number[] = [];
    const latencies: (number | null)[] = [];
    const jitter: (number | null)[] = [];
    const packetLoss: (number | null)[] = [];

    let prevLatency: number | null = null;

    for (const result of pingResults) {
      // Convert to seconds for uPlot (it expects Unix timestamps in seconds)
      timestamps.push(result.timestamp / 1000);
      latencies.push(result.latency);

      // Calculate jitter (difference from previous latency)
      if (result.latency !== null && prevLatency !== null) {
        jitter.push(Math.abs(result.latency - prevLatency));
      } else {
        jitter.push(null);
      }

      // Packet loss marker (show at a value when latency is null)
      packetLoss.push(result.latency === null ? 1 : null);

      prevLatency = result.latency;
    }

    return [timestamps, latencies, jitter, packetLoss] as [number[], (number | null)[], (number | null)[], (number | null)[]];
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
        jitter: {
          auto: true,
          range: (_self, min, max) => {
            const pad = (max - min) * 0.1 || 2;
            return [Math.max(0, min - pad), max + pad];
          },
        },
        loss: {
          auto: false,
          range: [0, 1.2],
        },
      },
      axes: [
        // X-axis
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
        // Left Y-axis (Latency)
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
        // Right Y-axis (Jitter)
        {
          side: 1,
          scale: 'jitter',
          stroke: '#3b82f6', // blue
          grid: { show: false },
          ticks: {
            stroke: isDark ? '#4b5563' : '#d1d5db',
          },
          label: 'Jitter (ms)',
          labelFont: '12px sans-serif',
          labelGap: 8,
        },
      ],
      series: [
        // X series (timestamps)
        {},
        // Latency series (green, left Y-axis)
        {
          label: 'Latency',
          scale: 'y',
          stroke: '#22c55e', // green
          width: 2,
          fill: isDark ? 'rgba(34, 197, 94, 0.1)' : 'rgba(34, 197, 94, 0.05)',
          points: {
            show: false,
          },
        },
        // Jitter series (blue, right Y-axis)
        {
          label: 'Jitter',
          scale: 'jitter',
          stroke: '#3b82f6', // blue
          width: 1.5,
          points: {
            show: false,
          },
        },
        // Packet loss series (red markers)
        {
          label: 'Loss',
          scale: 'loss',
          stroke: '#ef4444', // red
          width: 0,
          points: {
            show: true,
            size: 8,
            fill: '#ef4444',
            stroke: '#ef4444',
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
        show: true,
        live: false,
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

      {/* Empty state */}
      {pingResults.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-500 dark:text-gray-400">
          Start a session to see latency data
        </div>
      )}
    </div>
  );
}
