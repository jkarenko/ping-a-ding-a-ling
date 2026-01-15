import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', '..', 'data', 'ping.db');

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

  console.log('Database initialized at', DB_PATH);
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
