import { calculateIndicators } from './indicators.js';
import { calcScore } from './scoring.js';
import { sendAlert } from './alerts.js';
import { saveSignal } from './db.js';
import { isHighLiquidity } from './sessions.js';
import * as cryptoFeed from './feeds/crypto.js';
import * as forexFeed from './feeds/forex.js';

export const PAIRS = {
  crypto: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT'],
  forex: ['EUR/USD', 'GBP/USD', 'USD/JPY', 'GBP/JPY', 'AUD/USD'],
  futures: ['NQ1!', 'ES1!', 'CL1!']
};

const signalState = new Map();
const changeListeners = [];

export function onSignalChange(cb) {
  changeListeners.push(cb);
}

function notifyListeners(signals) {
  for (const cb of changeListeners) {
    try { cb(signals); } catch (e) { console.error('[scanner] Listener error:', e.message); }
  }
}

function getFeed(market) {
  return market === 'crypto' ? cryptoFeed : forexFeed;
}

async function scanPair(pair, market, timeframe) {
  const feed = getFeed(market);
  const candles = await feed.fetchOHLCV(pair, timeframe, 100);

  if (candles.length < 30) {
    console.warn(`[scanner] Pocas velas para ${pair} ${timeframe} (${candles.length})`);
    return null;
  }

  const indicators = calculateIndicators(candles);
  const { score, direction, setup, indicatorFlags } = calcScore(indicators);

  const minScore = Number(process.env.MIN_SCORE_PUBLISH ?? 50);
  if (score < minScore) return null;

  const price = candles[candles.length - 1][4];

  return {
    pair,
    market,
    direction,
    setup,
    score,
    indicators: indicatorFlags,
    price,
    timeframe,
    timestamp: Date.now(),
    is_high_liquidity: isHighLiquidity()
  };
}

async function runScan(timeframe) {
  const results = [];
  const allPairs = [
    ...PAIRS.crypto.map(p => ({ pair: p, market: 'crypto' })),
    ...PAIRS.forex.map(p => ({ pair: p, market: 'forex' })),
    ...PAIRS.futures.map(p => ({ pair: p, market: 'futures' }))
  ];

  await Promise.allSettled(
    allPairs.map(async ({ pair, market }) => {
      try {
        const signal = await scanPair(pair, market, timeframe);
        if (!signal) return;

        const key = `${pair}:${timeframe}`;
        const prev = signalState.get(key);
        const changed = !prev || prev.score !== signal.score || prev.direction !== signal.direction;

        signalState.set(key, signal);
        results.push(signal);

        if (changed) {
          await sendAlert(signal);
          saveSignal(signal);
        }
      } catch (err) {
        console.error(`[scanner] Sin datos para ${pair}: ${err.message}`);
      }
    })
  );

  if (results.length) {
    notifyListeners(results);
  }

  return results;
}

export function getAllSignals() {
  return Array.from(signalState.values());
}

export function startScanner() {
  const interval = Number(process.env.SCAN_INTERVAL_MS ?? 10000);
  const timeframe = process.env.DEFAULT_TIMEFRAME ?? 'M5';

  console.log(`[scanner] Iniciando scanner — timeframe=${timeframe} interval=${interval}ms`);

  runScan(timeframe).then(results => {
    console.log(`[scanner] Escaneo inicial: ${results.length} señales activas`);
  });

  setInterval(() => {
    runScan(timeframe).catch(err => console.error('[scanner] Error en ciclo:', err.message));
  }, interval);
}
