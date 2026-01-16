import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import os from 'os';

/**
 * Get the platform-specific user data directory for storing the database.
 * - Windows: %APPDATA%/ping-a-ding-a-ling/
 * - macOS: ~/Library/Application Support/ping-a-ding-a-ling/
 * - Linux: ~/.local/share/ping-a-ding-a-ling/
 */
function getDataDirectory(): string {
  const appName = 'ping-a-ding-a-ling';
  const platform = os.platform();

  if (platform === 'win32') {
    // Windows: use APPDATA
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(appData, appName);
  } else if (platform === 'darwin') {
    // macOS: use Application Support
    return path.join(os.homedir(), 'Library', 'Application Support', appName);
  } else {
    // Linux and others: use XDG_DATA_HOME or ~/.local/share
    const dataHome = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
    return path.join(dataHome, appName);
  }
}

const DB_PATH = path.join(getDataDirectory(), 'ping.db');

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export function initDatabase(): void {
  // Ensure data directory exists
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  // Create sessions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      target TEXT NOT NULL,
      interval INTEGER NOT NULL DEFAULT 100,
      created_at INTEGER NOT NULL,
      ended_at INTEGER,
      settings TEXT NOT NULL
    )
  `);

  // Create ping_results table
  db.exec(`
    CREATE TABLE IF NOT EXISTS ping_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      latency REAL,
      seq INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    )
  `);

  // Create index for faster lookups
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_ping_results_session_id
    ON ping_results(session_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_ping_results_timestamp
    ON ping_results(session_id, timestamp)
  `);

  // Create deviation_events table
  db.exec(`
    CREATE TABLE IF NOT EXISTS deviation_events (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      type TEXT NOT NULL,
      value REAL NOT NULL,
      threshold REAL NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_deviation_events_session_id
    ON deviation_events(session_id)
  `);

  // Create session_stats table for finalized sessions
  db.exec(`
    CREATE TABLE IF NOT EXISTS session_stats (
      session_id TEXT PRIMARY KEY,
      total_pings INTEGER NOT NULL,
      successful_pings INTEGER NOT NULL,
      packet_loss REAL NOT NULL,
      latency_min REAL,
      latency_max REAL,
      latency_mean REAL,
      latency_median REAL,
      latency_std_dev REAL,
      latency_p95 REAL,
      latency_p99 REAL,
      jitter_mean REAL,
      deviation_count INTEGER NOT NULL,
      mean_time_between_deviations REAL,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    )
  `);

  // Create session_analysis table for post-session analysis
  db.exec(`
    CREATE TABLE IF NOT EXISTS session_analysis (
      session_id TEXT PRIMARY KEY,
      computed_at INTEGER NOT NULL,

      -- Timing metrics
      span_seconds REAL NOT NULL,
      sample_count INTEGER NOT NULL,
      sampling_interval_mean REAL NOT NULL,
      sampling_interval_median REAL NOT NULL,
      sampling_interval_p95 REAL NOT NULL,

      -- Latency distribution
      latency_min REAL NOT NULL,
      latency_mean REAL NOT NULL,
      latency_median REAL NOT NULL,
      latency_p95 REAL NOT NULL,
      latency_p99 REAL NOT NULL,
      latency_max REAL NOT NULL,
      latency_std_dev REAL NOT NULL,

      -- Tail-risk thresholds (stored as JSON)
      thresholds TEXT NOT NULL,

      -- Burst analysis
      burst_count INTEGER NOT NULL,
      burst_size_median REAL,
      burst_size_max INTEGER,
      inter_burst_interval_median REAL,
      inter_burst_interval_p95 REAL,

      -- Quality assessment
      quality_grade TEXT NOT NULL,
      quality_summary TEXT NOT NULL,

      FOREIGN KEY (session_id) REFERENCES sessions(id)
    )
  `);

  // Create session_bursts table for detailed burst data
  db.exec(`
    CREATE TABLE IF NOT EXISTS session_bursts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      burst_index INTEGER NOT NULL,
      start_timestamp INTEGER NOT NULL,
      end_timestamp INTEGER NOT NULL,
      sample_count INTEGER NOT NULL,
      max_latency REAL NOT NULL,
      mean_latency REAL NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_session_bursts_session_id
    ON session_bursts(session_id)
  `);

  console.log('Database initialized at', DB_PATH);
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
