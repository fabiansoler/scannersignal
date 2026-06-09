/**
 * Feed de datos OHLCV para Forex y Futuros.
 *
 * MVP: datos mock realistas con fases tendenciales rotativas.
 * Cada par tiene una dirección dominante que cambia cada ~30 velas para que
 * RSI, EMA y MACD se alineen y produzcan señales LONG/SHORT reales.
 *
 * Preparado para conectar OANDA o Tradovate:
 *   - Implementar fetchFromOANDA() y reemplazar la lógica mock.
 */

const BASE_PRICES = {
  'EUR/USD': 1.0850,
  'GBP/USD': 1.2700,
  'USD/JPY': 154.50,
  'GBP/JPY': 196.20,
  'AUD/USD': 0.6550,
  'NQ1!': 19800,
  'ES1!': 5280,
  'CL1!': 79.50
};

const VOLATILITY = {
  'EUR/USD': 0.0004,
  'GBP/USD': 0.0006,
  'USD/JPY': 0.12,
  'GBP/JPY': 0.20,
  'AUD/USD': 0.0004,
  'NQ1!': 15,
  'ES1!': 5,
  'CL1!': 0.25
};

// Dirección tendencial actual por par: 1 = alcista, -1 = bajista
// Se elige una sola vez por sesión y se rota cada ROTATE_EVERY ciclos de escaneo.
const trendState = {};
let scanCycle = 0;
const ROTATE_EVERY = 6; // ~60 segundos con intervalo de 10s

export function advanceCycle() { scanCycle++; }

function getTrend(pair) {
  if (!trendState[pair] || scanCycle % ROTATE_EVERY === 0 && scanCycle > 0) {
    // Usar un "hash" del par + ciclo para que cada par rote distinto
    const seed = pair.charCodeAt(0) + pair.charCodeAt(1) + scanCycle;
    trendState[pair] = seed % 2 === 0 ? 1 : -1;
  }
  return trendState[pair];
}

/**
 * Genera velas OHLCV mock con tendencia clara en las últimas 40 velas.
 *
 * Para producir señales LONG necesitamos que la serie reciente sea alcista:
 *   - RSI baja (oversold) → primeras 60 velas caen → RSI en zona 30-40
 *   - Luego las últimas 40 velas suben con fuerza → EMA9 cruza EMA21 hacia arriba
 *   - MACD histogram se vuelve positivo y creciente
 *
 * Para SHORT, lo inverso.
 */
export function fetchOHLCV(pair, timeframe = 'M5', limit = 100) {
  const vol = VOLATILITY[pair] ?? 0.001;
  const candles = [];
  let price = BASE_PRICES[pair] ?? 1.0;
  const now = Date.now();
  const intervalMs = timeframe === 'M1' ? 60000 : timeframe === 'M15' ? 900000 : 300000;
  const dir = getTrend(pair); // +1 o -1 para todo el bloque de señal

  for (let i = limit; i >= 0; i--) {
    let bias;
    let volMultiplier;

    if (i >= 40) {
      // Fase inicial: movimiento opuesto a la señal (construye el RSI en zona extrema)
      bias = -dir * vol * 0.9 + (Math.random() - 0.5) * vol * 0.4;
      volMultiplier = 0.7 + Math.random() * 0.5;
    } else {
      // Fase de señal: tendencia fuerte en la dirección, con volumen spike
      bias = dir * vol * 1.4 + (Math.random() - 0.5) * vol * 0.3;
      volMultiplier = 2.0 + Math.random() * 2.5;
    }

    const open = price;
    const close = open + bias;
    const high = Math.max(open, close) + Math.random() * vol * 0.4;
    const low = Math.min(open, close) - Math.random() * vol * 0.4;
    const volume = 1500 * volMultiplier;
    candles.push([now - i * intervalMs, open, high, low, close, volume]);
    price = close;
  }

  // No mutamos BASE_PRICES: cada llamada parte del precio real base para evitar drift
  return Promise.resolve(candles);
}

export function fetchCurrentPrice(pair) {
  return Promise.resolve(BASE_PRICES[pair] ?? null);
}
