import { useMemo } from 'react';

/**
 * Lógica pura de cálculo de posición. Mismos inputs → mismos outputs, sin side effects.
 *
 * @param {object} params
 * @param {object} params.signal - Señal seleccionada (pair, direction, price)
 * @param {number} params.capital - Capital total de la cuenta (USD)
 * @param {number} params.riskPct - % de riesgo por operación
 * @param {number} params.slPct   - Distancia del SL en % desde la entrada
 * @param {number} params.rr      - Risk/Reward ratio
 * @returns {{ riskAmount, slPrice, tpPrice, positionSize, positionValue, pipsAtRisk, isValid }}
 */
export function usePositionCalc({ signal, capital, riskPct, slPct, rr }) {
  return useMemo(() => {
    const entry = Number(signal?.price);
    const cap = Number(capital);
    const risk = Number(riskPct);
    const sl = Number(slPct);
    const ratio = Number(rr);

    const isValid =
      Number.isFinite(entry) && entry > 0 &&
      Number.isFinite(cap) && cap > 0 &&
      Number.isFinite(risk) && risk > 0 &&
      Number.isFinite(sl) && sl > 0 &&
      Number.isFinite(ratio) && ratio > 0;

    if (!isValid) {
      return {
        riskAmount: 0,
        slPrice: 0,
        tpPrice: 0,
        positionSize: 0,
        positionValue: 0,
        pipsAtRisk: 0,
        isValid: false
      };
    }

    const isLong = signal.direction === 'LONG';
    const riskAmount = cap * (risk / 100);
    const slDistance = entry * (sl / 100);   // distancia de precio entrada→SL
    const tpDistance = slDistance * ratio;

    const slPrice = isLong ? entry - slDistance : entry + slDistance;
    const tpPrice = isLong ? entry + tpDistance : entry - tpDistance;

    const pipsAtRisk = slDistance;                 // diferencia de precio entrada↔SL
    const positionSize = riskAmount / pipsAtRisk;  // unidades del activo
    const positionValue = positionSize * entry;    // valor nominal de la posición

    return {
      riskAmount,
      slPrice,
      tpPrice,
      positionSize,
      positionValue,
      pipsAtRisk,
      isValid: true
    };
  }, [signal?.price, signal?.direction, capital, riskPct, slPct, rr]);
}
