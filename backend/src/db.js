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

      CREATE TABLE IF NOT EXISTS position_calculations (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        pair          TEXT,
        direction     TEXT,
        entry         REAL,
        sl            REAL,
        tp            REAL,
        position_size REAL,
        risk_amount   REAL,
        risk_pct      REAL,
        capital       REAL,
        rr            REAL,
        timestamp     INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_poscalc_timestamp ON position_calculations(timestamp DESC);
    `);

    // Migración: agregar columna is_high_liquidity si no existe
    // (SQLite no soporta ADD COLUMN IF NOT EXISTS)
    const cols = db.prepare('PRAGMA table_info(signals)').all();
    if (!cols.some(c => c.name === 'is_high_liquidity')) {
      db.exec('ALTER TABLE signals ADD COLUMN is_high_liquidity INTEGER DEFAULT 0');
    }
  }
  return db;
}

export function saveCalculation(data) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO position_calculations
      (pair, direction, entry, sl, tp, position_size, risk_amount, risk_pct, capital, rr, timestamp)
    VALUES
      (@pair, @direction, @entry, @sl, @tp, @position_size, @risk_amount, @risk_pct, @capital, @rr, @timestamp)
  `);
  const info = stmt.run({
    pair: data.pair ?? null,
    direction: data.direction ?? null,
    entry: data.entry ?? null,
    sl: data.sl ?? null,
    tp: data.tp ?? null,
    position_size: data.positionSize ?? null,
    risk_amount: data.riskAmount ?? null,
    risk_pct: data.riskPct ?? null,
    capital: data.capital ?? null,
    rr: data.rr ?? null,
    timestamp: data.timestamp ?? Date.now()
  });
  return info.lastInsertRowid;
}

export function saveSignal(signal) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO signals (pair, market, direction, setup, score, price, timeframe, timestamp, is_high_liquidity)
    VALUES (@pair, @market, @direction, @setup, @score, @price, @timeframe, @timestamp, @is_high_liquidity)
  `);
  stmt.run({
    pair: signal.pair,
    market: signal.market,
    direction: signal.direction,
    setup: signal.setup,
    score: signal.score,
    price: signal.price ?? null,
    timeframe: signal.timeframe,
    timestamp: signal.timestamp ?? Date.now(),
    is_high_liquidity: signal.is_high_liquidity ? 1 : 0
  });
}

export function getSignalsHistory(limit = 50) {
  const db = getDb();
  return db
    .prepare('SELECT * FROM signals ORDER BY timestamp DESC LIMIT ?')
    .all(limit);
}
