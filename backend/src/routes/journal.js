import express from 'express';
import {
  saveTrade, updateTrade, getTradeById, deleteTrade, getTrades,
  saveJournalAnalysis, getLatestJournalAnalysis
} from '../db.js';
import { streamJSONCompletion, checkGroqStatus } from '../groq-client.js';
import { getActiveSessions, isHighLiquidity } from '../sessions.js';

const router = express.Router();

const ANALYZE_RATE_LIMIT_MS = 60 * 60 * 1000; // 1 análisis general cada 60 min
const MIN_TRADES_FOR_AI = 5;

const round2 = (n) => (Number.isFinite(n) ? Math.round(n * 100) / 100 : null);
const round1 = (n) => (Number.isFinite(n) ? Math.round(n * 10) / 10 : null);

function sessionFor(ts) {
  const d = new Date(ts);
  if (isHighLiquidity(d)) return 'london_ny_overlap';
  const active = getActiveSessions(d);
  return active[0] ?? 'off_session';
}

/** Calcula campos derivados (result, pnl, pnl_pct, rr_actual) a partir del trade. */
function computeDerived(t) {
  const out = {};
  const entry = Number(t.entry_price);
  const exit = t.exit_price == null ? null : Number(t.exit_price);

  if (exit == null || !Number.isFinite(exit)) {
    out.result = 'OPEN';
    return out;
  }

  const isLong = t.direction === 'LONG';
  const priceDiff = isLong ? exit - entry : entry - exit;
  const size = Number(t.position_size) || 0;

  out.pnl = round2(priceDiff * size);
  out.pnl_pct = entry ? round1((priceDiff / entry) * 100) : null;

  if (t.sl_price != null) {
    const risk = Math.abs(entry - Number(t.sl_price));
    out.rr_actual = risk > 0 ? round2(priceDiff / risk) : null;
  }

  out.result = out.pnl > 0 ? 'WIN' : out.pnl < 0 ? 'LOSS' : 'BREAKEVEN';
  out.exit_time = t.exit_time ?? Date.now();
  return out;
}

// ── CSV export (antes de /trades/:id para que no lo capture) ──
router.get('/trades/export', (_req, res) => {
  const { rows } = getTrades({ limit: 100000, offset: 0 });
  const cols = [
    'id', 'pair', 'market', 'direction', 'setup', 'timeframe', 'session',
    'entry_price', 'exit_price', 'sl_price', 'tp_price', 'position_size',
    'risk_amount', 'risk_pct', 'rr_planned', 'rr_actual', 'result', 'pnl', 'pnl_pct',
    'entry_time', 'exit_time', 'notes', 'emotion', 'followed_plan', 'signal_score'
  ];
  const esc = (v) => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="trades.csv"');
  res.send(csv);
});

// ── Estadísticas (SQL puro, sin IA) ──
router.get('/stats', (_req, res) => {
  try {
    res.json(computeStats());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function computeStats() {
  const { rows: all } = getTrades({ limit: 100000, offset: 0 });
  const closed = all.filter(t => t.result && t.result !== 'OPEN');
  const wins = closed.filter(t => t.result === 'WIN');
  const losses = closed.filter(t => t.result === 'LOSS');

  const mean = (arr, f) => {
    const vals = arr.map(f).filter(v => Number.isFinite(v));
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  };

  const groupBy = (key) => {
    const map = new Map();
    for (const t of closed) {
      const k = t[key] || '—';
      const g = map.get(k) ?? { key: k, trades: 0, wins: 0, pnlSum: 0 };
      g.trades += 1;
      if (t.result === 'WIN') g.wins += 1;
      g.pnlSum += t.pnl ?? 0;
      map.set(k, g);
    }
    return [...map.values()].map(g => ({
      trades: g.trades,
      win_rate: round1((g.wins / g.trades) * 100),
      avg_pnl: round2(g.pnlSum / g.trades),
      _key: g.key
    }));
  };

  const bySetup = groupBy('setup').map(g => ({ setup: g._key, trades: g.trades, win_rate: g.win_rate, avg_pnl: g.avg_pnl }));
  const bySession = groupBy('session').map(g => ({ session: g._key, trades: g.trades, win_rate: g.win_rate, avg_pnl: g.avg_pnl }));
  const byPair = groupBy('pair').map(g => ({ pair: g._key, trades: g.trades, win_rate: g.win_rate, avg_pnl: g.avg_pnl }));

  const bestBy = (arr, k) => arr.length ? [...arr].sort((a, b) => b.avg_pnl - a.avg_pnl)[0][k] : null;
  const worstBy = (arr, k) => arr.length ? [...arr].sort((a, b) => a.avg_pnl - b.avg_pnl)[0][k] : null;

  // Equity curve por fecha (usa exit_time de los cerrados)
  const byDate = new Map();
  for (const t of [...closed].sort((a, b) => (a.exit_time ?? a.entry_time) - (b.exit_time ?? b.entry_time))) {
    const date = new Date(t.exit_time ?? t.entry_time).toISOString().slice(0, 10);
    byDate.set(date, (byDate.get(date) ?? 0) + (t.pnl ?? 0));
  }
  let cum = 0;
  const equity_curve = [...byDate.entries()].map(([date, pnl]) => {
    cum += pnl;
    return { date, cumulative_pnl: round2(cum) };
  });

  // Racha actual
  let streak = 0, streakType = null;
  for (const t of closed) { // closed viene ordenado desc por entry_time
    if (t.result === 'BREAKEVEN') break;
    if (streakType == null) { streakType = t.result; streak = 1; }
    else if (t.result === streakType) streak += 1;
    else break;
  }

  const emotion_breakdown = {};
  for (const t of all) if (t.emotion) emotion_breakdown[t.emotion] = (emotion_breakdown[t.emotion] ?? 0) + 1;

  const decisive = wins.length + losses.length;

  return {
    total_trades: all.length,
    open_trades: all.length - closed.length,
    win_rate: decisive ? round1((wins.length / decisive) * 100) : 0,
    avg_rr_actual: round2(mean(closed, t => t.rr_actual)),
    avg_rr_planned: round2(mean(all, t => t.rr_planned)),
    total_pnl: round2(closed.reduce((a, t) => a + (t.pnl ?? 0), 0)),
    best_setup: bestBy(bySetup, 'setup'),
    worst_setup: worstBy(bySetup, 'setup'),
    best_session: bestBy(bySession, 'session'),
    worst_session: worstBy(bySession, 'session'),
    avg_score_winning: Math.round(mean(wins, t => t.signal_score)),
    avg_score_losing: Math.round(mean(losses, t => t.signal_score)),
    followed_plan_rate: all.length ? round1((all.filter(t => t.followed_plan).length / all.length) * 100) : 0,
    current_streak: { type: streakType, count: streak },
    emotion_breakdown,
    by_setup: bySetup,
    by_session: bySession,
    by_pair: byPair,
    equity_curve
  };
}

// ── CRUD ──
router.post('/trades', (req, res) => {
  const body = req.body ?? {};
  if (!body.pair || !body.market || !body.direction || body.entry_price == null) {
    return res.status(400).json({ error: 'Faltan campos requeridos (pair, market, direction, entry_price)' });
  }
  const entry_time = body.entry_time ?? Date.now();
  const trade = {
    ...body,
    entry_time,
    session: body.session ?? sessionFor(entry_time),
    followed_plan: body.followed_plan === 0 || body.followed_plan === false ? 0 : 1,
    ...computeDerived(body)
  };
  const id = saveTrade(trade);
  res.json({ id, trade: getTradeById(id) });
});

router.get('/trades', (req, res) => {
  const { pair, result, dateFrom, dateTo } = req.query;
  const limit = Math.min(Number(req.query.limit ?? 20), 200);
  const offset = Number(req.query.offset ?? 0);
  res.json(getTrades({ limit, offset, pair, result, dateFrom, dateTo }));
});

router.get('/trades/:id', (req, res) => {
  const trade = getTradeById(Number(req.params.id));
  if (!trade) return res.status(404).json({ error: 'No existe' });
  res.json(trade);
});

router.put('/trades/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = getTradeById(id);
  if (!existing) return res.status(404).json({ error: 'No existe' });

  const merged = { ...existing, ...req.body };
  const updated = updateTrade(id, { ...req.body, ...computeDerived(merged) });
  res.json(updated);
});

router.delete('/trades/:id', (req, res) => {
  const changes = deleteTrade(Number(req.params.id));
  res.json({ deleted: changes > 0 });
});

// ── Análisis IA (SSE) ──
router.post('/analyze', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  if (res.flushHeaders) res.flushHeaders();

  const send = (obj) => { try { res.write(`data: ${JSON.stringify(obj)}\n\n`); } catch { /* */ } };

  const { rows: all } = getTrades({ limit: 100000, offset: 0 });
  if (all.length < MIN_TRADES_FOR_AI) {
    send({ type: 'error', error: 'not_enough_trades', message: `Registrá al menos ${MIN_TRADES_FOR_AI} operaciones para activar el análisis IA` });
    return res.end();
  }

  const prev = getLatestJournalAnalysis();
  if (prev && prev.generated_at && Date.now() - prev.generated_at < ANALYZE_RATE_LIMIT_MS) {
    send({ type: 'done', analysis: prev.analysis, cached: true });
    return res.end();
  }

  let clientGone = false;
  res.on('close', () => { clientGone = true; });

  try {
    const trades = all.slice(0, 50);
    const stats = computeStats();
    const prompt = buildJournalPrompt(trades, stats);

    const { analysis, raw } = await streamJSONCompletion(prompt, (d) => { if (!clientGone) send({ type: 'chunk', content: d }); });
    if (clientGone) return;

    if (!analysis) {
      send({ type: 'error', error: 'parse_error', message: 'La IA devolvió JSON inválido', raw });
      return res.end();
    }

    const now = Date.now();
    const final = { generated_at: now, ...analysis };
    saveJournalAnalysis({
      generated_at: now,
      trades_analyzed: trades.length,
      analysis: final,
      period_start: trades[trades.length - 1]?.entry_time ?? null,
      period_end: trades[0]?.entry_time ?? null
    });
    send({ type: 'done', analysis: final });
    res.end();
  } catch (err) {
    send({ type: 'error', error: err.code === 'groq_unavailable' ? 'groq_unavailable' : 'unknown', message: err.message });
    res.end();
  }
});

// ── Feedback IA por trade individual ──
router.post('/trades/:id/feedback', async (req, res) => {
  const id = Number(req.params.id);
  const trade = getTradeById(id);
  if (!trade) return res.status(404).json({ error: 'No existe' });

  try {
    const { rows: sameSetup } = getTrades({ limit: 10, offset: 0 });
    const peers = sameSetup.filter(t => t.setup === trade.setup && t.id !== id).slice(0, 10);
    const prompt = buildFeedbackPrompt(trade, peers);

    const { analysis } = await streamJSONCompletion(prompt, null);
    const feedback = analysis?.feedback ?? null;
    if (!feedback) return res.json({ error: 'parse_error', message: 'Feedback no disponible' });

    updateTrade(id, { ai_feedback: feedback, ai_feedback_at: Date.now() });
    res.json({ feedback });
  } catch (err) {
    res.json({ error: err.code === 'groq_unavailable' ? 'groq_unavailable' : 'unknown', message: err.message });
  }
});

// ── Último análisis IA guardado (sin llamar a Groq) ──
router.get('/analysis/latest', (_req, res) => {
  const latest = getLatestJournalAnalysis();
  res.json({ analysis: latest?.analysis ?? null, generated_at: latest?.generated_at ?? null });
});

// ── Status de Groq (reusa el del cliente) ──
router.get('/ai-status', async (_req, res) => {
  res.json(await checkGroqStatus());
});

function buildJournalPrompt(trades, stats) {
  return `Sos un coach de trading profesional especializado en scalping. Analizá el historial de operaciones de este trader y generá un reporte de rendimiento detallado.

HISTORIAL DE OPERACIONES (últimos ${trades.length} trades):
${JSON.stringify(trades)}

ESTADÍSTICAS GENERALES:
${JSON.stringify(stats)}

INSTRUCCIONES:
1. Identificá los 3 errores más recurrentes con ejemplos específicos de las operaciones (usá los id de trade)
2. Identificá las 2 fortalezas más claras del trader
3. Analizá si hay patrones de comportamiento emocional (FOMO, revenge trading)
4. Determiná qué setups le funcionan mejor y cuáles debería evitar
5. Evaluá si el trader sigue su plan (campo followed_plan)
6. Dá 5 recomendaciones concretas y priorizadas para mejorar
7. Calculá una "nota de disciplina" del 0 al 100
Escribí todo en español.

Respondé ÚNICAMENTE con JSON válido (sin markdown, sin texto adicional):
{
  "discipline_score": number,
  "recurring_errors": [{ "error": string, "frequency": string, "example_trade_ids": number[], "recommendation": string }],
  "strengths": [{ "strength": string, "evidence": string }],
  "emotional_patterns": [{ "emotion": string, "impact": string, "trades_affected": number }],
  "setup_analysis": [{ "setup": string, "verdict": "keep"|"avoid"|"improve", "reason": string }],
  "recommendations": [{ "priority": number, "action": string, "expected_impact": string }],
  "summary": string
}`;
}

function buildFeedbackPrompt(trade, peers) {
  return `Sos un coach de trading. Analizá esta operación puntual y dá feedback breve y accionable en español.

OPERACIÓN:
${JSON.stringify(trade)}

ÚLTIMAS OPERACIONES DEL MISMO SETUP (para comparar):
${JSON.stringify(peers)}

Respondé ÚNICAMENTE con JSON válido: { "feedback": "2-3 oraciones de feedback concreto" }`;
}

export default router;
