import { create } from 'zustand';
import type {
  Session,
  SessionSettings,
  PingResult,
  DeviationEvent,
  RollingStats,
  SessionStats,
  SessionAnalysis,
} from '@ping/shared';
import { DEFAULT_SESSION_SETTINGS } from '@ping/shared';

// localStorage keys
const STORAGE_KEYS = {
  THEME: 'ping-theme',
  SETTINGS: 'ping-settings',
  SELECTED_SESSION: 'ping-selected-session',
  UI_STATE: 'ping-ui-state',
} as const;

// UI expand states
interface UIState {
  showHistory: boolean;
  showBursts: boolean;
  showAdvancedSettings: boolean;
}

const DEFAULT_UI_STATE: UIState = {
  showHistory: false,
  showBursts: false,
  showAdvancedSettings: false,
};

// Load UI state from localStorage
function loadUIState(): UIState {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.UI_STATE);
    if (stored) {
      return { ...DEFAULT_UI_STATE, ...JSON.parse(stored) };
    }
  } catch {
    // localStorage not available
  }
  return { ...DEFAULT_UI_STATE };
}

// Save UI state to localStorage
function saveUIState(state: UIState): void {
  try {
    localStorage.setItem(STORAGE_KEYS.UI_STATE, JSON.stringify(state));
  } catch {
    // localStorage not available
  }
}

// Load theme from localStorage
function loadTheme(): 'light' | 'dark' {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.THEME);
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
  } catch {
    // localStorage not available
  }
  return 'dark'; // default
}

// Save theme to localStorage
function saveTheme(theme: 'light' | 'dark'): void {
  try {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
  } catch {
    // localStorage not available
  }
}

// Load settings from localStorage
function loadSettings(): SessionSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with defaults to ensure all fields exist
      return { ...DEFAULT_SESSION_SETTINGS, ...parsed };
    }
  } catch {
    // localStorage not available or invalid JSON
  }
  return { ...DEFAULT_SESSION_SETTINGS };
}

// Save settings to localStorage
function saveSettings(settings: SessionSettings): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch {
    // localStorage not available
  }
}

// Load selected session ID from localStorage
function loadSelectedSessionId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.SELECTED_SESSION);
  } catch {
    return null;
  }
}

// Save selected session ID to localStorage
function saveSelectedSessionId(sessionId: string | null): void {
  try {
    if (sessionId) {
      localStorage.setItem(STORAGE_KEYS.SELECTED_SESSION, sessionId);
    } else {
      localStorage.removeItem(STORAGE_KEYS.SELECTED_SESSION);
    }
  } catch {
    // localStorage not available
  }
}

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

  // Session analysis
  sessionAnalysis: SessionAnalysis | null;

  // Historical sessions
  historicalSessions: Session[];
  selectedHistoricalSession: Session | null;

  // UI state
  flashKey: number; // Increment to trigger flash animation
  flashType: 'latency_spike' | 'packet_loss' | 'jitter' | null; // Type of deviation for flash color
  theme: 'light' | 'dark';
  uiState: UIState;

  // Actions
  setSettings: (settings: Partial<SessionSettings>) => void;
  startSession: (session: Session) => void;
  endSession: (stats: SessionStats) => void;
  addPingResult: (result: PingResultWithStats) => void;
  addDeviation: (event: DeviationEvent) => void;
  triggerFlash: (type: 'latency_spike' | 'packet_loss' | 'jitter') => void;
  setHistoricalSessions: (sessions: Session[]) => void;
  selectHistoricalSession: (session: Session | null) => void;
  loadHistoricalSession: (
    session: Session,
    pingResults: PingResult[],
    deviationEvents: DeviationEvent[],
    stats: SessionStats | null,
    analysis: SessionAnalysis | null
  ) => void;
  setSessionAnalysis: (analysis: SessionAnalysis | null) => void;
  toggleTheme: () => void;
  setUIState: (state: Partial<UIState>) => void;
  reset: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  // Initial state (load persisted values from localStorage)
  currentSession: null,
  isRunning: false,
  settings: loadSettings(),
  pingResults: [],
  deviationEvents: [],
  latestStats: null,
  finalStats: null,
  sessionAnalysis: null,
  historicalSessions: [],
  selectedHistoricalSession: null,
  flashKey: 0,
  flashType: null,
  theme: loadTheme(),
  uiState: loadUIState(),

  // Actions
  setSettings: (newSettings) =>
    set((state) => {
      const updatedSettings = { ...state.settings, ...newSettings };
      saveSettings(updatedSettings);
      return { settings: updatedSettings };
    }),

  startSession: (session) => {
    // Clear persisted session when starting a new one
    saveSelectedSessionId(null);
    set({
      currentSession: session,
      isRunning: true,
      pingResults: [],
      deviationEvents: [],
      latestStats: null,
      finalStats: null,
      selectedHistoricalSession: null,
    });
  },

  endSession: (stats) =>
    set((state) => {
      // Persist the ended session so it's restored on reload
      if (state.currentSession) {
        saveSelectedSessionId(state.currentSession.id);
      }
      return {
        isRunning: false,
        finalStats: stats,
      };
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

  triggerFlash: (type) =>
    set((state) => ({
      flashKey: state.flashKey + 1,
      flashType: type,
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

  loadHistoricalSession: (session, pingResults, deviationEvents, stats, analysis) => {
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

    // Persist selected session ID
    saveSelectedSessionId(session.id);

    set({
      currentSession: session,
      selectedHistoricalSession: session,
      isRunning: false,
      pingResults: resultsWithStats,
      deviationEvents,
      finalStats: stats,
      sessionAnalysis: analysis,
      latestStats: null,
    });
  },

  setSessionAnalysis: (analysis) =>
    set({
      sessionAnalysis: analysis,
    }),

  toggleTheme: () =>
    set((state) => {
      const newTheme = state.theme === 'dark' ? 'light' : 'dark';
      // Update document class
      if (newTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      // Persist to localStorage
      saveTheme(newTheme);
      return { theme: newTheme };
    }),

  setUIState: (newState) =>
    set((state) => {
      const updatedUIState = { ...state.uiState, ...newState };
      saveUIState(updatedUIState);
      return { uiState: updatedUIState };
    }),

  reset: () => {
    // Clear persisted session on reset
    saveSelectedSessionId(null);
    set({
      currentSession: null,
      isRunning: false,
      pingResults: [],
      deviationEvents: [],
      latestStats: null,
      finalStats: null,
      sessionAnalysis: null,
      selectedHistoricalSession: null,
    });
  },
}));

// Export for use in components that need to load persisted session on mount
export { loadSelectedSessionId };
