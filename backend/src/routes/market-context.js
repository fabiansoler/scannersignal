import express from 'express';
import { getDb, saveMarketContext, getLatestMarketContext } from '../db.js';
import { analyzeMarketContext, checkGroqStatus } from '../groq-client.js';
import { getCurrentState } from '../sessions.js';

const router = express.Router();

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
const RATE_LIMIT_MS = 30 * 60 * 1000; // no más de 1 análisis cada 30 min por sesión

function buildSignalsSummary(rows) {
  if (!rows.length) return 'sin señales en las últimas 4 horas';
  const byPair = {};
  for (const r of rows) {
    const p = (byPair[r.pair] ??= { count: 0, long: 0, short: 0, scoreSum: 0 });
    p.count += 1;
    p.scoreSum += r.score;
    if (r.direction === 'LONG') p.long += 1;
    else if (r.direction === 'SHORT') p.short += 1;
  }
  return Object.entries(byPair)
    .map(([pair, s]) => `${pair}: ${s.count} señales (${s.long} LONG, ${s.short} SHORT, score prom ${Math.round(s.scoreSum / s.count)})`)
    .join('; ');
}

function recentSignals() {
  const db = getDb();
  const since = Date.now() - FOUR_HOURS_MS;
  return db.prepare('SELECT pair, direction, score FROM signals WHERE timestamp >= ?').all(since);
}

// POST /api/market-context/analyze — stream SSE
router.post('/analyze', async (req, res) => {
  const { pairs = [], timeframe = 'M5', session = 'unknown' } = req.body ?? {};

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  if (res.flushHeaders) res.flushHeaders();

  const send = (obj) => {
    try { res.write(`data: ${JSON.stringify(obj)}\n\n`); } catch { /* socket cerrado */ }
  };

  // Rate limit: si hay un análisis de la misma sesión hace menos de 30 min, devolverlo cacheado
  const latest = getLatestMarketContext();
  if (latest && latest.session === session && latest.generated_at &&
      Date.now() - latest.generated_at < RATE_LIMIT_MS) {
    send({ type: 'done', analysis: latest, cached: true });
    return res.end();
  }

  // Detecta desconexión del cliente. OJO: usar res, no req — req emite 'close'
  // apenas se termina de leer el body del POST, no cuando el cliente se va.
  let clientGone = false;
  res.on('close', () => { clientGone = true; });

  try {
    const payload = {
      session,
      timeframe,
      pairs,
      utc_time: new Date().toISOString().slice(11, 19) + ' UTC',
      signals_summary: buildSignalsSummary(recentSignals())
    };

    const { analysis, raw } = await analyzeMarketContext(payload, (delta) => {
      if (!clientGone) send({ type: 'chunk', content: delta });
    });

    if (clientGone) return;

    if (!analysis) {
      // JSON malformado → mandar texto crudo para debug
      send({ type: 'error', error: 'parse_error', message: 'La IA devolvió un JSON inválido', raw });
      return res.end();
    }

    const now = Date.now();
    const final = {
      generated_at: now,
      session,
      ...analysis,
      valid_until: now + FOUR_HOURS_MS
    };

    saveMarketContext(final);
    send({ type: 'done', analysis: final });
    res.end();
  } catch (err) {
    send({ type: 'error', error: err.code === 'groq_unavailable' ? 'groq_unavailable' : 'unknown', message: err.message });
    res.end();
  }
});

// GET /api/market-context/latest
router.get('/latest', (_req, res) => {
  const latest = getLatestMarketContext();
  if (!latest) return res.json({ stale: true, analysis: null });

  const age = Date.now() - (latest.generated_at ?? 0);
  res.json({ stale: age > FOUR_HOURS_MS, analysis: latest });
});

// GET /api/market-context/status
router.get('/status', async (_req, res) => {
  try {
    res.json(await checkGroqStatus());
  } catch (err) {
    res.json({ available: false, reason: err.message });
  }
});

export default router;
