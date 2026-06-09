/**
 * Calcula indicadores técnicos sobre una serie de velas OHLCV.
 * Cada función retorna { signal: 'bullish'|'bearish'|'neutral', value, active: boolean }
 */

import {
  RSI,
  EMA,
  MACD as MACDIndicator
} from 'technicalindicators';

/**
 * RSI(14): bullish si < 35, bearish si > 65
 */
export function calcRSI(closes) {
  const values = RSI.calculate({ values: closes, period: 14 });
  if (!values.length) return { signal: 'neutral', value: null, active: false };
  const rsi = values[values.length - 1];
  const signal = rsi < 35 ? 'bullish' : rsi > 65 ? 'bearish' : 'neutral';
  return { signal, value: rsi, active: signal !== 'neutral' };
}

/**
 * EMA(9) vs EMA(21): bullish si EMA9 > EMA21 (tendencia alcista activa),
 * bearish si EMA9 < EMA21 (tendencia bajista activa).
 * Se activa siempre que haya separación significativa (> 0.01% del precio)
 * para evitar señales en mercados laterales con EMAs prácticamente iguales.
 */
export function calcEMA(closes) {
  const ema9 = EMA.calculate({ values: closes, period: 9 });
  const ema21 = EMA.calculate({ values: closes, period: 21 });

  if (!ema9.length || !ema21.length) {
    return { signal: 'neutral', value: null, active: false };
  }

  const cur9 = ema9[ema9.length - 1];
  const cur21 = ema21[ema21.length - 1];
  const midprice = (cur9 + cur21) / 2;

  // Umbral: separación mínima del 0.01% del precio para considerar señal activa
  const threshold = midprice * 0.0001;
  const diff = cur9 - cur21;

  if (Math.abs(diff) < threshold) {
    return { signal: 'neutral', value: { ema9: cur9, ema21: cur21 }, active: false };
  }

  const signal = diff > 0 ? 'bullish' : 'bearish';
  return {
    signal,
    value: { ema9: cur9, ema21: cur21 },
    active: true
  };
}

/**
 * MACD(12,26,9): bullish si histogram positivo y creciendo respecto a la vela anterior.
 */
export function calcMACD(closes) {
  const results = MACDIndicator.calculate({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false
  });

  if (results.length < 2) return { signal: 'neutral', value: null, active: false };

  const cur = results[results.length - 1];
  const prev = results[results.length - 2];

  const curHist = cur.histogram ?? 0;
  const prevHist = prev.histogram ?? 0;

  const bullish = curHist > 0 && curHist > prevHist;
  const bearish = curHist < 0 && curHist < prevHist;

  const signal = bullish ? 'bullish' : bearish ? 'bearish' : 'neutral';
  return { signal, value: { macd: cur.MACD, signal: cur.signal, histogram: curHist }, active: signal !== 'neutral' };
}

/**
 * Volumen relativo: activo si volumen actual > 1.5x el promedio de las últimas 20 velas.
 * No tiene dirección propia; amplifica las otras señales.
 */
export function calcVolume(volumes) {
  if (volumes.length < 21) return { signal: 'neutral', value: null, active: false };
  const recent = volumes.slice(-21, -1); // últimas 20 sin la actual
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const current = volumes[volumes.length - 1];
  const ratio = current / avg;
  return {
    signal: 'neutral', // la dirección la dictan otros indicadores
    value: ratio,
    active: ratio >= 1.5
  };
}

/**
 * Calcula todos los indicadores y retorna un objeto con resultados individuales.
 */
export function calculateIndicators(candles) {
  const closes = candles.map(c => c[4]);
  const volumes = candles.map(c => c[5]);

  return {
    rsi: calcRSI(closes),
    ema: calcEMA(closes),
    macd: calcMACD(closes),
    volume: calcVolume(volumes)
  };
}
