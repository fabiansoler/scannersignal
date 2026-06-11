// Cripto vía Yahoo Finance v8 API — sin dependencias externas, usa fetch nativo (Node 18+)

const SYMBOL_MAP = {
  'BTC/USDT': 'BTC-USD',
  'ETH/USDT': 'ETH-USD',
  'SOL/USDT': 'SOL-USD',
  'BNB/USDT': 'BNB-USD',
  'XRP/USDT': 'XRP-USD',
};

const TF_MAP   = { M1: '1m', M5: '5m', M15: '15m' };
const CACHE_TTL_MS = 60_000;

const cache = new Map();

async function fetchFromYahoo(symbol, interval) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&range=7d`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  if (!res.ok) throw new Error(`Yahoo Finance HTTP ${res.status} para ${symbol}`);
  const json = await res.json();

  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(`Sin datos de Yahoo Finance para ${symbol}`);

  const timestamps = result.timestamp ?? [];
  const q = result.indicators.quote[0];

  return timestamps.map((ts, i) => [
    ts * 1000,
    q.open[i],
    q.high[i],
    q.low[i],
    q.close[i],
    q.volume[i] ?? 0
  ]).filter(c => c[1] != null && c[4] != null);
}

export async function fetchOHLCV(pair, timeframe = 'M5', limit = 100) {
  const symbol = SYMBOL_MAP[pair];
  if (!symbol) throw new Error(`Par no soportado en crypto feed: ${pair}`);

  const cacheKey = `${pair}:${timeframe}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.data;
  }

  const interval = TF_MAP[timeframe] ?? '5m';
  const candles = await fetchFromYahoo(symbol, interval);

  if (candles.length === 0) throw new Error(`Yahoo Finance devolvió 0 velas para ${pair}`);

  const data = candles.slice(-limit);
  cache.set(cacheKey, { data, ts: Date.now() });
  return data;
}

export async function fetchCurrentPrice(pair) {
  const candles = await fetchOHLCV(pair, 'M5', 1);
  return candles[candles.length - 1]?.[4] ?? null;
}
