/**
 * Confluencia multi-timeframe (M1 / M5 / M15) para un único par.
 *
 * Reutiliza los feeds reales de Yahoo Finance (crypto.js / forex.js) y los
 * indicadores existentes (indicators.js) — no duplica lógica. Produce un score
 * FIRMADO de -100 a +100 por timeframe (positivo = alcista, negativo = bajista),
 * con los mismos pesos que scoring.js (EMA 30 · RSI 25 · MACD 25 · Vol 20).
 */

import * as cryptoFeed from './crypto.js';
import * as forexFeed from './forex.js';
import { calculateIndicators } from '../indicators.js';
import { PAIRS } from '../scanner.js';

const WEIGHTS = { ema: 30, rsi: 25, macd: 25, volume: 20 };
const TIMEFRAMES = ['M1', 'M5', 'M15'];

const ALL_PAIRS = [...PAIRS.crypto, ...PAIRS.forex, ...PAIRS.futures];

function getMarket(pair) {
  if (PAIRS.crypto.includes(pair)) return 'crypto';
  if (PAIRS.forex.includes(pair)) return 'forex';
  if (PAIRS.futures.includes(pair)) return 'futures';
  return null;
}

function getFeed(market) {
  return market === 'crypto' ? cryptoFeed : forexFeed;
}

/**
 * Normaliza un símbolo de entrada a un par interno soportado.
 * Acepta: 'BTC/USDT', 'BTCUSDT', 'BTC-USD', 'btc/usdt', 'NQ1!', etc.
 */
export function resolvePair(input) {
  if (!input) return null;
  const raw = String(input).trim().toUpperCase();

  if (ALL_PAIRS.includes(raw)) return raw;

  const norm = raw.replace(/[\/\-\s!]/g, '');
  for (const p of ALL_PAIRS) {
    if (p.replace(/[\/\-\s!]/g, '') === norm) return p;
  }
  // Cripto: aceptar 'BTCUSD' / 'BTCUSDT' apuntando a 'BTC/USDT'
  for (const p of PAIRS.crypto) {
    const base = p.replace('/USDT', '');
    if (norm === `${base}USDT` || norm === `${base}USD`) return p;
  }
  return null;
}

function labelFromIndicator(ind) {
  // EMA / MACD → BULL | BEAR | NEUTRAL ; RSI → OVERSOLD | OVERBOUGHT | NEUTRAL
  const trend = (i) => (!i.active ? 'NEUTRAL' : i.signal === 'bullish' ? 'BULL' : 'BEAR');
  return {
    ema: trend(ind.ema),
    rsi: !ind.rsi.active ? 'NEUTRAL' : ind.rsi.signal === 'bullish' ? 'OVERSOLD' : 'OVERBOUGHT',
    macd: trend(ind.macd),
    volume: ind.volume.active ? 'HIGH' : 'NORMAL'
  };
}

function signedScore(ind) {
  let s = 0;
  if (ind.ema.active)  s += ind.ema.signal  === 'bullish' ?  WEIGHTS.ema  : -WEIGHTS.ema;
  if (ind.rsi.active)  s += ind.rsi.signal  === 'bullish' ?  WEIGHTS.rsi  : -WEIGHTS.rsi;
  if (ind.macd.active) s += ind.macd.signal === 'bullish' ?  WEIGHTS.macd : -WEIGHTS.macd;
  // Volumen amplifica el bando dominante; no aporta dirección propia.
  if (ind.volume.active) {
    if (s > 0) s += WEIGHTS.volume;
    else if (s < 0) s -= WEIGHTS.volume;
  }
  return s;
}

function emptyTimeframe() {
  return { ema: 'NEUTRAL', rsi: 'NEUTRAL', macd: 'NEUTRAL', volume: 'NORMAL', score: 0 };
}

function signalLabel(score) {
  if (score >= 70)  return 'STRONG BUY';
  if (score >= 40)  return 'WEAK BUY';
  if (score <= -70) return 'STRONG SELL';
  if (score <= -40) return 'WEAK SELL';
  return 'NEUTRAL';
}

/**
 * Calcula la confluencia multi-timeframe de un par.
 * @param {string} input - Par interno o símbolo aceptado por resolvePair()
 * @returns {Promise<{symbol,market,timeframes,overallScore,signal}>}
 */
export async function calculateConfluence(input) {
  const pair = resolvePair(input);
  if (!pair) throw new Error(`Par no soportado: ${input}`);

  const market = getMarket(pair);
  const feed = getFeed(market);

  const timeframes = {};
  let sum = 0;
  let counted = 0;

  for (const tf of TIMEFRAMES) {
    try {
      const candles = await feed.fetchOHLCV(pair, tf, 100);
      if (!candles || candles.length < 30) {
        timeframes[tf] = emptyTimeframe();
        continue;
      }
      const ind = calculateIndicators(candles);
      const score = signedScore(ind);
      timeframes[tf] = { ...labelFromIndicator(ind), score };
      sum += score;
      counted += 1;
    } catch (err) {
      console.error(`[confluence] ${pair} ${tf}: ${err.message}`);
      timeframes[tf] = emptyTimeframe();
    }
  }

  const overallScore = counted ? Math.round(sum / counted) : 0;

  return {
    symbol: pair,
    market,
    timeframes,
    overallScore,
    signal: signalLabel(overallScore)
  };
}

/** Lista de pares soportados, agrupada por mercado (para el selector del frontend). */
export function supportedPairs() {
  return { crypto: PAIRS.crypto, forex: PAIRS.forex, futures: PAIRS.futures };
}
