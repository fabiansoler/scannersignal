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

      CREATE TABLE IF NOT EXISTS market_context (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        session       TEXT,
        bias          TEXT,
        confidence    INTEGER,
        analysis_json TEXT,
        generated_at  INTEGER,
        valid_until   INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_mktctx_generated ON market_context(generated_at DESC);

      CREATE TABLE IF NOT EXISTS trades (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        pair          TEXT NOT NULL,
        market        TEXT NOT NULL,
        direction     TEXT NOT NULL,
        setup         TEXT,
        timeframe     TEXT,
        session       TEXT,
        entry_price   REAL NOT NULL,
        exit_price    REAL,
        sl_price      REAL,
        tp_price      REAL,
        position_size REAL,
        risk_amount   REAL,
        risk_pct      REAL,
        rr_planned    REAL,
        rr_actual     REAL,
        result        TEXT,
        pnl           REAL,
        pnl_pct       REAL,
        entry_time    INTEGER NOT NULL,
        exit_time     INTEGER,
        notes         TEXT,
        emotion       TEXT,
        followed_plan INTEGER DEFAULT 1,
        signal_score  INTEGER,
        ai_feedback   TEXT,
        ai_feedback_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_trades_entry ON trades(entry_time DESC);

      CREATE TABLE IF NOT EXISTS journal_analysis (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        generated_at    INTEGER,
        trades_analyzed INTEGER,
        analysis_json   TEXT,
        period_start    INTEGER,
        period_end      INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_journalanalysis_generated ON journal_analysis(generated_at DESC);
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

export function saveMarketContext(data) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO market_context (session, bias, confidence, analysis_json, generated_at, valid_until)
    VALUES (@session, @bias, @confidence, @analysis_json, @generated_at, @valid_until)
  `);
  const info = stmt.run({
    session: data.session ?? null,
    bias: data.bias?.overall ?? null,
    confidence: data.bias?.confidence ?? null,
    analysis_json: JSON.stringify(data),
    generated_at: data.generated_at ?? Date.now(),
    valid_until: data.valid_until ?? null
  });
  return info.lastInsertRowid;
}

export function getLatestMarketContext() {
  const db = getDb();
  const row = db
    .prepare('SELECT analysis_json FROM market_context ORDER BY generated_at DESC LIMIT 1')
    .get();
  if (!row) return null;
  try {
    return JSON.parse(row.analysis_json);
  } catch {
    return null;
  }
}

// ── Journal de trades ──

const TRADE_COLUMNS = [
  'pair', 'market', 'direction', 'setup', 'timeframe', 'session',
  'entry_price', 'exit_price', 'sl_price', 'tp_price', 'position_size',
  'risk_amount', 'risk_pct', 'rr_planned', 'rr_actual', 'result',
  'pnl', 'pnl_pct', 'entry_time', 'exit_time', 'notes', 'emotion',
  'followed_plan', 'signal_score', 'ai_feedback', 'ai_feedback_at'
];

export function saveTrade(data) {
  const db = getDb();
  const cols = TRADE_COLUMNS.filter(c => data[c] !== undefined);
  const stmt = db.prepare(
    `INSERT INTO trades (${cols.join(', ')}) VALUES (${cols.map(c => '@' + c).join(', ')})`
  );
  const params = {};
  for (const c of cols) params[c] = data[c] ?? null;
  return db.transaction(() => stmt.run(params).lastInsertRowid)();
}

export function updateTrade(id, data) {
  const db = getDb();
  const cols = TRADE_COLUMNS.filter(c => data[c] !== undefined);
  if (!cols.length) return getTradeById(id);
  const stmt = db.prepare(
    `UPDATE trades SET ${cols.map(c => `${c} = @${c}`).join(', ')} WHERE id = @id`
  );
  const params = { id };
  for (const c of cols) params[c] = data[c] ?? null;
  stmt.run(params);
  return getTradeById(id);
}

export function getTradeById(id) {
  return getDb().prepare('SELECT * FROM trades WHERE id = ?').get(id);
}

export function deleteTrade(id) {
  return getDb().prepare('DELETE FROM trades WHERE id = ?').run(id).changes;
}

export function getTrades({ limit = 20, offset = 0, pair, result, dateFrom, dateTo } = {}) {
  const where = [];
  const params = [];
  if (pair) { where.push('pair = ?'); params.push(pair); }
  if (result) { where.push('result = ?'); params.push(result); }
  if (dateFrom) { where.push('entry_time >= ?'); params.push(Number(dateFrom)); }
  if (dateTo) { where.push('entry_time <= ?'); params.push(Number(dateTo)); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const db = getDb();
  const total = db.prepare(`SELECT COUNT(*) c FROM trades ${clause}`).get(...params).c;
  const rows = db
    .prepare(`SELECT * FROM trades ${clause} ORDER BY entry_time DESC LIMIT ? OFFSET ?`)
    .all(...params, Number(limit), Number(offset));
  return { rows, total };
}

export function saveJournalAnalysis(data) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO journal_analysis (generated_at, trades_analyzed, analysis_json, period_start, period_end)
    VALUES (@generated_at, @trades_analyzed, @analysis_json, @period_start, @period_end)
  `);
  const info = stmt.run({
    generated_at: data.generated_at ?? Date.now(),
    trades_analyzed: data.trades_analyzed ?? 0,
    analysis_json: JSON.stringify(data.analysis ?? data),
    period_start: data.period_start ?? null,
    period_end: data.period_end ?? null
  });
  return info.lastInsertRowid;
}

export function getLatestJournalAnalysis() {
  const row = getDb()
    .prepare('SELECT * FROM journal_analysis ORDER BY generated_at DESC LIMIT 1')
    .get();
  if (!row) return null;
  try {
    return { ...row, analysis: JSON.parse(row.analysis_json) };
  } catch {
    return null;
  }
}
