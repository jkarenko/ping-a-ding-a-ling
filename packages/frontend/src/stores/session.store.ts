import { create } from 'zustand';
import type {
  Session,
  SessionSettings,
  PingResult,
  DeviationEvent,
  RollingStats,
  SessionStats,
} from '@ping/shared';
import { DEFAULT_SESSION_SETTINGS } from '@ping/shared';

interface PingResultWithStats extends PingResult {
  stats: RollingStats;
}

interface SessionState {
  // Current session
  currentSession: Session | null;
  isRunning: boolean;

  // Settings (before starting a session)
  settings: SessionSettings;

  // Live data
  pingResults: PingResultWithStats[];
  deviationEvents: DeviationEvent[];
  latestStats: RollingStats | null;

  // Final stats (after session ends)
  finalStats: SessionStats | null;

  // Historical sessions
  historicalSessions: Session[];
  selectedHistoricalSession: Session | null;

  // UI state
  flashKey: number; // Increment to trigger flash animation
  theme: 'light' | 'dark';

  // Actions
  setSettings: (settings: Partial<SessionSettings>) => void;
  startSession: (session: Session) => void;
  endSession: (stats: SessionStats) => void;
  addPingResult: (result: PingResultWithStats) => void;
  addDeviation: (event: DeviationEvent) => void;
  triggerFlash: () => void;
  setHistoricalSessions: (sessions: Session[]) => void;
  selectHistoricalSession: (session: Session | null) => void;
  loadHistoricalSession: (
    session: Session,
    pingResults: PingResult[],
    deviationEvents: DeviationEvent[],
    stats: SessionStats | null
  ) => void;
  toggleTheme: () => void;
  reset: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  // Initial state
  currentSession: null,
  isRunning: false,
  settings: { ...DEFAULT_SESSION_SETTINGS },
  pingResults: [],
  deviationEvents: [],
  latestStats: null,
  finalStats: null,
  historicalSessions: [],
  selectedHistoricalSession: null,
  flashKey: 0,
  theme: 'dark',

  // Actions
  setSettings: (newSettings) =>
    set((state) => ({
      settings: { ...state.settings, ...newSettings },
    })),

  startSession: (session) =>
    set({
      currentSession: session,
      isRunning: true,
      pingResults: [],
      deviationEvents: [],
      latestStats: null,
      finalStats: null,
      selectedHistoricalSession: null,
    }),

  endSession: (stats) =>
    set({
      isRunning: false,
      finalStats: stats,
    }),

  addPingResult: (result) =>
    set((state) => {
      // Keep last 3000 points for performance (5 minutes at 100ms interval)
      const maxPoints = 3000;
      const newResults =
        state.pingResults.length >= maxPoints
          ? [...state.pingResults.slice(1), result]
          : [...state.pingResults, result];

      return {
        pingResults: newResults,
        latestStats: result.stats,
      };
    }),

  addDeviation: (event) =>
    set((state) => ({
      deviationEvents: [...state.deviationEvents, event],
    })),

  triggerFlash: () =>
    set((state) => ({
      flashKey: state.flashKey + 1,
    })),

  setHistoricalSessions: (sessions) =>
    set({
      historicalSessions: sessions,
    }),

  selectHistoricalSession: (session) =>
    set({
      selectedHistoricalSession: session,
      // Clear current session data when viewing historical
      currentSession: session,
      isRunning: false,
    }),

  loadHistoricalSession: (session, pingResults, deviationEvents, stats) => {
    // Convert PingResult[] to PingResultWithStats[] with empty stats
    const emptyStats: RollingStats = {
      mean: 0,
      median: 0,
      stdDev: 0,
      min: 0,
      max: 0,
      p95: 0,
      p99: 0,
      q1: 0,
      q3: 0,
      iqr: 0,
      jitter: 0,
      packetLossRate: 0,
      sampleCount: 0,
    };

    const resultsWithStats: PingResultWithStats[] = pingResults.map((r) => ({
      ...r,
      stats: emptyStats,
    }));

    set({
      currentSession: session,
      selectedHistoricalSession: session,
      isRunning: false,
      pingResults: resultsWithStats,
      deviationEvents,
      finalStats: stats,
      latestStats: null,
    });
  },

  toggleTheme: () =>
    set((state) => {
      const newTheme = state.theme === 'dark' ? 'light' : 'dark';
      // Update document class
      if (newTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return { theme: newTheme };
    }),

  reset: () =>
    set({
      currentSession: null,
      isRunning: false,
      pingResults: [],
      deviationEvents: [],
      latestStats: null,
      finalStats: null,
      selectedHistoricalSession: null,
    }),
}));
