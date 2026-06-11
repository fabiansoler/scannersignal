import ccxt from 'ccxt';

const TF_MAP = { M1: '1m', M5: '5m', M15: '15m' };

let exchange;

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

export async function fetchOHLCV(pair, timeframe = 'M5', limit = 100) {
  const tf = TF_MAP[timeframe] ?? '5m';
  return getExchange().fetchOHLCV(pair, tf, undefined, limit);
}

export async function fetchCurrentPrice(pair) {
  const ticker = await getExchange().fetchTicker(pair);
  return ticker.last ?? null;
}
