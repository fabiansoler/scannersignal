import { useState, useEffect } from 'react';
import { usePositionCalc } from '../hooks/usePositionCalc.js';

const API_BASE = import.meta.env.DEV ? 'http://localhost:3001' : '';

// SL default por mercado (% desde la entrada)
const DEFAULT_SL = { crypto: 1.5, forex: 0.3, futures: 0.5 };

const LS_CAPITAL = 'posCalc.capital';
const LS_RISK = 'posCalc.riskPct';

function fmtPrice(p) {
  if (p == null || !Number.isFinite(p)) return '—';
  if (p >= 1000) return p.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (p >= 1) return p.toFixed(4);
  return p.toFixed(6);
}
function fmtUsd(n) {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtSize(n) {
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(4);
}
function unitLabel(signal) {
  if (!signal) return '';
  if (signal.market === 'crypto') return signal.pair.split('/')[0];
  if (signal.market === 'futures') return 'contratos';
  return 'unidades';
}

export function PositionCalculator({ signal, onClose }) {
  const [capital, setCapital] = useState(() => Number(localStorage.getItem(LS_CAPITAL)) || 10000);
  const [riskPct, setRiskPct] = useState(() => Number(localStorage.getItem(LS_RISK)) || 1);
  const [slPct, setSlPct] = useState(DEFAULT_SL.crypto);
  const [rr, setRr] = useState(2);
  const [copied, setCopied] = useState(false);

  // Al cambiar de señal: reset del SL al default del mercado
  useEffect(() => {
    if (signal) setSlPct(DEFAULT_SL[signal.market] ?? 1);
    setCopied(false);
  }, [signal?.pair, signal?.market]);

  // Persistir capital y % riesgo
  useEffect(() => { localStorage.setItem(LS_CAPITAL, String(capital)); }, [capital]);
  useEffect(() => { localStorage.setItem(LS_RISK, String(riskPct)); }, [riskPct]);

  const calc = usePositionCalc({ signal, capital, riskPct, slPct, rr });

  if (!signal) return null;

  const isLong = signal.direction === 'LONG';
  const dirColor = isLong ? 'text-green-400' : 'text-red-400';
  const dirBadge = isLong
    ? 'bg-green-500/20 text-green-400 border-green-500/30'
    : 'bg-red-500/20 text-red-400 border-red-500/30';
  const unit = unitLabel(signal);

  const slSignPct = isLong ? `-${slPct}%` : `+${slPct}%`;
  const tpSignPct = isLong ? `+${(slPct * rr).toFixed(2)}%` : `-${(slPct * rr).toFixed(2)}%`;

  const buildSummary = () => (
    `Par: ${signal.pair} | ${signal.direction}\n` +
    `Entrada: ${fmtPrice(signal.price)}\n` +
    `SL: ${fmtPrice(calc.slPrice)} (${slSignPct})\n` +
    `TP: ${fmtPrice(calc.tpPrice)} (${tpSignPct})\n` +
    `Tamaño: ${fmtSize(calc.positionSize)} ${unit}\n` +
    `Riesgo: $${fmtUsd(calc.riskAmount)} (${riskPct}% de $${fmtUsd(capital)})\n` +
    `RR: 1:${rr}`
  );

  const handleCopy = async () => {
    if (!calc.isValid) return;
    const text = buildSummary();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard no disponible */
    }
    // Guardar el cálculo (no en cada cambio de input, solo al copiar)
    try {
      await fetch(`${API_BASE}/api/calculator/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pair: signal.pair,
          direction: signal.direction,
          entry: signal.price,
          sl: calc.slPrice,
          tp: calc.tpPrice,
          positionSize: calc.positionSize,
          riskAmount: calc.riskAmount,
          riskPct,
          capital,
          rr,
          timestamp: Date.now()
        })
      });
    } catch {
      /* el backend puede estar caído; no bloquea la copia */
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Panel — sidebar derecho en desktop, bottom sheet en mobile */}
      <div className="relative w-full sm:w-[380px] sm:h-full max-h-[88vh] sm:max-h-none self-end sm:self-stretch
                      bg-gray-900 border-t sm:border-t-0 sm:border-l border-gray-800
                      rounded-t-2xl sm:rounded-none overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-gray-900 border-b border-gray-800 px-5 py-4 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-white">{signal.pair}</span>
              <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-bold ${dirBadge}`}>
                {signal.direction}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Entrada: <span className="font-mono text-gray-300">{fmtPrice(signal.price)}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white text-xl leading-none px-1"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Inputs */}
          <div className="space-y-3">
            <Field label="Capital total (USD)">
              <input
                type="number" min={0} step={100} value={capital}
                onChange={e => setCapital(Number(e.target.value))}
                className={inputCls}
              />
            </Field>

            <Field label={`% Riesgo por operación`}>
              <input
                type="number" min={0.1} max={5} step={0.1} value={riskPct}
                onChange={e => setRiskPct(Number(e.target.value))}
                className={inputCls}
              />
            </Field>

            <Field label="Distancia SL (% desde entrada)">
              <input
                type="number" min={0.1} step={0.1} value={slPct}
                onChange={e => setSlPct(Number(e.target.value))}
                className={inputCls}
              />
            </Field>

            <Field label="Risk / Reward (RR)">
              <input
                type="number" min={1} max={5} step={0.5} value={rr}
                onChange={e => setRr(Number(e.target.value))}
                className={inputCls}
              />
            </Field>
          </div>

          {/* Outputs */}
          {calc.isValid ? (
            <div className="rounded-xl border border-gray-800 bg-gray-950/50 divide-y divide-gray-800">
              <Output label="Monto en riesgo" value={`$${fmtUsd(calc.riskAmount)}`} accent="text-yellow-400" />
              <Output label="Precio SL" value={fmtPrice(calc.slPrice)} accent="text-red-400" sub={slSignPct} />
              <Output label="Precio TP" value={fmtPrice(calc.tpPrice)} accent="text-green-400" sub={tpSignPct} />
              <Output label="Tamaño de posición" value={`${fmtSize(calc.positionSize)} ${unit}`} accent={dirColor} />
              <Output label="Valor de la posición" value={`$${fmtUsd(calc.positionValue)}`} accent="text-gray-200" />
              <Output label="Distancia al SL (precio)" value={fmtPrice(calc.pipsAtRisk)} accent="text-gray-200" />
            </div>
          ) : (
            <div className="rounded-lg border border-yellow-800/50 bg-yellow-900/20 px-4 py-3 text-sm text-yellow-400">
              Completá capital y % de riesgo (mayores a 0) para ver los cálculos.
            </div>
          )}

          {/* Copiar resumen */}
          <button
            onClick={handleCopy}
            disabled={!calc.isValid}
            className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
              calc.isValid
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-gray-800 text-gray-600 cursor-not-allowed'
            }`}
          >
            {copied ? '✓ Copiado al portapapeles' : 'Copiar resumen'}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono text-gray-200 ' +
  'focus:outline-none focus:ring-1 focus:ring-blue-500';

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</span>
      {children}
    </label>
  );
}

function Output({ label, value, accent, sub }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`font-mono font-semibold ${accent}`}>
        {value}
        {sub && <span className="ml-1.5 text-xs text-gray-600">{sub}</span>}
      </span>
    </div>
  );
}
