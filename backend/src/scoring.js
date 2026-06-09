/**
 * Motor de scoring de confluencia (0–100).
 *
 * Pesos:
 *   RSI:             25 pts
 *   EMA Cross:       30 pts
 *   MACD:            25 pts
 *   Volumen relativo: 20 pts
 *
 * Dirección: LONG si mayoría de señales activas son bullish, SHORT si bearish, NEUTRAL si empate.
 * Solo se publican señales con score >= MIN_SCORE_PUBLISH (default 50).
 */

const WEIGHTS = {
  rsi: 25,
  ema: 30,
  macd: 25,
  volume: 20
};

/**
 * Construye el texto descriptivo del setup a partir de los indicadores activos.
 */
function buildSetupLabel(indicators, direction) {
  const active = [];
  if (indicators.rsi.active) {
    active.push(direction === 'LONG' ? 'RSI oversold' : 'RSI overbought');
  }
  if (indicators.ema.active) {
    active.push('EMA Cross');
  }
  if (indicators.macd.active) {
    active.push('MACD histogram');
  }
  if (indicators.volume.active) {
    active.push('Vol spike');
  }
  return active.length ? active.join(' + ') : 'Sin confluencia';
}

/**
 * Calcula el score de confluencia y determina la dirección de la señal.
 *
 * @param {object} indicators - Resultado de calculateIndicators()
 * @returns {{ score: number, direction: 'LONG'|'SHORT'|'NEUTRAL', setup: string, indicatorFlags: object }}
 */
export function calcScore(indicators) {
  let score = 0;
  let bullishPoints = 0;
  let bearishPoints = 0;

  const indicatorFlags = {};

  // RSI
  if (indicators.rsi.active) {
    if (indicators.rsi.signal === 'bullish') {
      bullishPoints += WEIGHTS.rsi;
    } else {
      bearishPoints += WEIGHTS.rsi;
    }
    score += WEIGHTS.rsi;
    indicatorFlags.rsi = true;
  } else {
    indicatorFlags.rsi = false;
  }

  // EMA Cross
  if (indicators.ema.active) {
    if (indicators.ema.signal === 'bullish') {
      bullishPoints += WEIGHTS.ema;
    } else {
      bearishPoints += WEIGHTS.ema;
    }
    score += WEIGHTS.ema;
    indicatorFlags.ema = true;
  } else {
    indicatorFlags.ema = false;
  }

  // MACD
  if (indicators.macd.active) {
    if (indicators.macd.signal === 'bullish') {
      bullishPoints += WEIGHTS.macd;
    } else {
      bearishPoints += WEIGHTS.macd;
    }
    score += WEIGHTS.macd;
    indicatorFlags.macd = true;
  } else {
    indicatorFlags.macd = false;
  }

  // Volumen (amplificador: suma puntos al bando dominante pero no determina dirección)
  indicatorFlags.volume = indicators.volume.active;
  if (indicators.volume.active) {
    score += WEIGHTS.volume;
    if (bullishPoints > bearishPoints) {
      bullishPoints += WEIGHTS.volume;
    } else if (bearishPoints > bullishPoints) {
      bearishPoints += WEIGHTS.volume;
    }
    // empate: puntos se reparten (no cambia la dirección)
  }

  const direction =
    bullishPoints > bearishPoints
      ? 'LONG'
      : bearishPoints > bullishPoints
      ? 'SHORT'
      : 'NEUTRAL';

  const setup = buildSetupLabel(indicators, direction);

  return { score, direction, setup, indicatorFlags };
}
