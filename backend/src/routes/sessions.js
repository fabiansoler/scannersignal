import express from 'express';
import { getDb } from '../db.js';
import { getCurrentState, getActiveSessions, isHighLiquidity } from '../sessions.js';

const router = express.Router();

// Volatilidad típica de mercado por hora UTC (fallback si no hay historial)
const MOCK_INDEX = [
  25, 20, 18, 18, 22, 28, 35,   // 0–6  Asia, bajo volumen
  60, 65, 62,                   // 7–9  apertura Londres
  50, 52,                       // 10–11
  88, 95, 100, 92, 85,          // 12–16 overlap London/NY
  55, 48, 42, 38,               // 17–20 cierre Londres, NY sola
  28, 22, 24                    // 21–23 pre-Asia
];

function mockVolatility() {
  const volatility = MOCK_INDEX.map((idx, hour) => ({
    hour,
    score_avg: 60 + Math.round(idx / 8),
    signal_count: Math.round(idx / 5),
    volatility_index: idx
  }));
  return { volatility, peak_hours: [12, 13, 14, 15], generated_at: Date.now(), source: 'mock' };
}

function computeVolatility() {
  const db = getDb();
  const rows = db.prepare('SELECT timestamp, score FROM signals').all();

  if (rows.length === 0) return mockVolatility();

  const buckets = Array.from({ length: 24 }, () => ({ count: 0, scoreSum: 0 }));
  for (const r of rows) {
    const h = new Date(r.timestamp).getUTCHours();
    buckets[h].count += 1;
    buckets[h].scoreSum += r.score;
  }

  const maxCount = Math.max(1, ...buckets.map(b => b.count));
  const volatility = buckets.map((b, hour) => ({
    hour,
    score_avg: b.count ? Math.round(b.scoreSum / b.count) : 0,
    signal_count: b.count,
    volatility_index: Math.round((b.count / maxCount) * 100)
  }));

  const peak_hours = [...volatility]
    .sort((a, b) => b.volatility_index - a.volatility_index)
    .slice(0, 4)
    .map(v => v.hour)
    .sort((a, b) => a - b);

  return { volatility, peak_hours, generated_at: Date.now(), source: 'signals' };
}

router.get('/volatility', (_req, res) => {
  try {
    res.json(computeVolatility());
  } catch (err) {
    console.error('[sessions] volatility:', err.message);
    res.json(mockVolatility()); // nunca crashea: devuelve mock
  }
});

router.get('/current', (_req, res) => {
  res.json(getCurrentState(new Date()));
});

/**
 * Vigila cambios de estado de sesión cada 60s y emite `session_change` por WS.
 * @param {(payload:object)=>void} broadcast - función que envía a todos los clientes
 */
export function startSessionWatcher(broadcast) {
  let prev = getActiveSessions(new Date());

  setInterval(() => {
    const now = new Date();
    const active = getActiveSessions(now);

    const opened = active.find(s => !prev.includes(s));
    const closed = prev.find(s => !active.includes(s));

    if (opened || closed) {
      broadcast({
        type: 'session_change',
        active_sessions: active,
        is_high_liquidity: isHighLiquidity(now),
        event: opened ? `${opened}_open` : `${closed}_close`
      });
    }
    prev = active;
  }, 60_000);
}

export default router;
