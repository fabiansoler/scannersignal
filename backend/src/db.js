import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'signals.db');

let db;

export function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS signals (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        pair      TEXT NOT NULL,
        market    TEXT NOT NULL,
        direction TEXT NOT NULL,
        setup     TEXT NOT NULL,
        score     INTEGER NOT NULL,
        price     REAL,
        timeframe TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_signals_timestamp ON signals(timestamp DESC);
    `);
  }
  return db;
}

export function saveSignal(signal) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO signals (pair, market, direction, setup, score, price, timeframe, timestamp)
    VALUES (@pair, @market, @direction, @setup, @score, @price, @timeframe, @timestamp)
  `);
  stmt.run({
    pair: signal.pair,
    market: signal.market,
    direction: signal.direction,
    setup: signal.setup,
    score: signal.score,
    price: signal.price ?? null,
    timeframe: signal.timeframe,
    timestamp: signal.timestamp ?? Date.now()
  });
}

export function getSignalsHistory(limit = 50) {
  const db = getDb();
  return db
    .prepare('SELECT * FROM signals ORDER BY timestamp DESC LIMIT ?')
    .all(limit);
}
