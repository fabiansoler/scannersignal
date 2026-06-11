import { useState, useEffect, useRef } from 'react';
import { useConfluenceWS } from '../hooks/useConfluenceWS.js';
import { TimeframeCard } from '../components/confluence/TimeframeCard.jsx';
import { ConfluencePanel } from '../components/confluence/ConfluencePanel.jsx';
import { SignalHistoryTable } from '../components/confluence/SignalHistoryTable.jsx';

const API_BASE = import.meta.env.DEV ? 'http://localhost:3001' : '';
const MARKET_LABELS = { crypto: 'Cripto', forex: 'Forex', futures: 'Futuros' };
const MAX_HISTORY = 20;

export function ConfluencePage() {
  const [pairs, setPairs] = useState({ crypto: [], forex: [], futures: [] });
  const [symbol, setSymbol] = useState('BTC/USDT');
  const [enabled, setEnabled] = useState(true);
  const [history, setHistory] = useState([]);

  const { data, connected, lastUpdated, error } = useConfluenceWS(symbol, enabled);
  const seenRef = useRef(null);

  // Cargar la lista de pares soportados desde el backend
  useEffect(() => {
    fetch(`${API_BASE}/api/pairs`)
      .then(r => r.json())
      .then(j => { if (j.data) setPairs(j.data); })
      .catch(() => { /* el selector queda con defaults vacíos */ });
  }, []);

  // Reiniciar historial al cambiar de par
  useEffect(() => {
    setHistory([]);
    seenRef.current = null;
  }, [symbol]);

  // Acumular snapshots en el historial (últimos 20)
  useEffect(() => {
    if (!data || data.symbol !== symbol) return;
    if (seenRef.current === data.timestamp) return;
    seenRef.current = data.timestamp;

    const snap = {
      id: data.timestamp,
      time: new Date(data.timestamp).toLocaleTimeString(),
      M1: data.timeframes?.M1?.score ?? 0,
      M5: data.timeframes?.M5?.score ?? 0,
      M15: data.timeframes?.M15?.score ?? 0,
      overallScore: data.overallScore,
      signal: data.signal
    };
    setHistory(prev => [snap, ...prev].slice(0, MAX_HISTORY));
  }, [data, symbol]);

  const pulseKey = lastUpdated ? lastUpdated.getTime() : 0;

  return (
    <div className="space-y-5">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl bg-gray-900 border border-gray-800">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 uppercase">Par</label>
          <select
            value={symbol}
            onChange={e => setSymbol(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm font-mono text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {Object.entries(pairs).map(([market, list]) => (
              list.length > 0 && (
                <optgroup key={market} label={MARKET_LABELS[market] ?? market}>
                  {list.map(p => <option key={p} value={p}>{p}</option>)}
                </optgroup>
              )
            ))}
          </select>
        </div>

        <button
          onClick={() => setEnabled(v => !v)}
          className={`rounded-lg px-4 py-1.5 text-sm font-medium border transition-colors ${
            enabled
              ? 'bg-red-600/80 border-red-500 text-white hover:bg-red-600'
              : 'bg-green-600/80 border-green-500 text-white hover:bg-green-600'
          }`}
        >
          {enabled ? 'Desconectar' : 'Conectar'}
        </button>

        <div className="flex items-center gap-2 ml-auto">
          <span className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`} />
          <span className={`text-sm font-medium ${connected ? 'text-green-400' : 'text-gray-500'}`}>
            {connected ? 'Conectado' : 'Desconectado'}
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-800/50 bg-red-900/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* 3 timeframes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <TimeframeCard label="M1"  data={data?.timeframes?.M1}  pulseKey={`m1-${pulseKey}`} />
        <TimeframeCard label="M5"  data={data?.timeframes?.M5}  pulseKey={`m5-${pulseKey}`} />
        <TimeframeCard label="M15" data={data?.timeframes?.M15} pulseKey={`m15-${pulseKey}`} />
      </div>

      {/* Panel general */}
      <ConfluencePanel
        overallScore={data?.overallScore ?? 0}
        signal={data?.signal ?? 'NEUTRAL'}
        lastUpdated={lastUpdated}
      />

      {/* Historial */}
      <SignalHistoryTable history={history} />
    </div>
  );
}
