/**
 * Feed de datos OHLCV para criptomonedas.
 * Intenta conectar a Binance via ccxt. Si falla (red corporativa, firewall),
 * cae automáticamente a un mock con precios y volatilidades realistas.
 */

import ccxt from 'ccxt';

const TF_MAP = { M1: '1m', M5: '5m', M15: '15m' };

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_PRICES = {
  'BTC/USDT': 67500,
  'ETH/USDT': 3520,
  'SOL/USDT': 172,
  'BNB/USDT': 598,
  'XRP/USDT': 0.528
};

// Volatilidad por vela (en unidades del precio)
const MOCK_VOL = {
  'BTC/USDT': 55,
  'ETH/USDT': 4.5,
  'SOL/USDT': 0.5,
  'BNB/USDT': 0.8,
  'XRP/USDT': 0.0008
};

const trendState = {};
let scanCycle = 0;
const ROTATE_EVERY = 6;

export function advanceCycle() { scanCycle++; }

function getTrend(pair) {
  if (!trendState[pair] || scanCycle % ROTATE_EVERY === 0 && scanCycle > 0) {
    const seed = pair.charCodeAt(0) + pair.charCodeAt(2) + scanCycle + 7; // +7 para desfasar de forex
    trendState[pair] = seed % 2 === 0 ? 1 : -1;
  }
  return trendState[pair];
}

function mockOHLCV(pair, timeframe, limit) {
  const vol = MOCK_VOL[pair] ?? 1;
  let price = MOCK_PRICES[pair] ?? 100;
  const now = Date.now();
  const intervalMs = timeframe === 'M1' ? 60000 : timeframe === 'M15' ? 900000 : 300000;
  const dir = getTrend(pair);
  const candles = [];

  for (let i = limit; i >= 0; i--) {
    let bias, volMultiplier;
    if (i >= 40) {
      bias = -dir * vol * 0.9 + (Math.random() - 0.5) * vol * 0.4;
      volMultiplier = 0.7 + Math.random() * 0.5;
    } else {
      bias = dir * vol * 1.4 + (Math.random() - 0.5) * vol * 0.3;
      volMultiplier = 2.0 + Math.random() * 2.5;
    }
    const open = price;
    const close = open + bias;
    const high = Math.max(open, close) + Math.random() * vol * 0.4;
    const low  = Math.min(open, close) - Math.random() * vol * 0.4;
    const volume = (pair === 'BTC/USDT' ? 800 : 3000) * volMultiplier;
    candles.push([now - i * intervalMs, open, high, low, close, volume]);
    price = close;
  }

  // No mutamos MOCK_PRICES: cada llamada parte del precio base real para evitar drift
  return candles;
}

// ── Binance via ccxt (con circuit-breaker) ────────────────────────────────────

let exchange;
let useMock = false; // se activa permanentemente si Binance falla

const MAX_FAILURES = 3;
let consecutiveFailures = 0;

function getExchange() {
  if (!exchange) {
    exchange = new ccxt.binance({
      apiKey: process.env.BINANCE_API_KEY || '',
      secret: process.env.BINANCE_SECRET || '',
      enableRateLimit: true,
      timeout: 8000
    });
  }
  return exchange;
}

// ── API pública ───────────────────────────────────────────────────────────────

export async function fetchOHLCV(pair, timeframe = 'M5', limit = 100) {
  if (useMock) return mockOHLCV(pair, timeframe, limit);

  const tf = TF_MAP[timeframe] ?? '5m';
  try {
    const ohlcv = await getExchange().fetchOHLCV(pair, tf, undefined, limit);
    consecutiveFailures = 0;
    return ohlcv;
  } catch (err) {
    consecutiveFailures++;
    if (consecutiveFailures >= MAX_FAILURES) {
      useMock = true;
      console.warn('[crypto] Binance no accesible — usando mock para todos los pares crypto');
    } else {
      console.error(`[crypto] Error ${pair} ${tf}:`, err.message);
    }
    return mockOHLCV(pair, timeframe, limit);
  }
}

export async function fetchCurrentPrice(pair) {
  if (useMock) {
    const candles = mockOHLCV(pair, 'M5', 1);
    return candles[candles.length - 1]?.[4] ?? MOCK_PRICES[pair] ?? null;
  }
  try {
    const ticker = await getExchange().fetchTicker(pair);
    consecutiveFailures = 0;
    return ticker.last ?? null;
  } catch {
    return MOCK_PRICES[pair] ?? null;
  }
}
