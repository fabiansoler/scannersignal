import { useState, useMemo } from 'react';
import { useScanner } from './hooks/useScanner.js';
import { MetricCards } from './components/MetricCards.jsx';
import { FilterBar } from './components/FilterBar.jsx';
import { SignalTable } from './components/SignalTable.jsx';

const DEFAULT_FILTERS = {
  market: 'all',
  timeframe: 'all',
  direction: 'all',
  minScore: 50
};

export default function App() {
  const { signals, connected, lastUpdate, cryptoSource } = useScanner();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  const filtered = useMemo(() => {
    return signals.filter(s => {
      if (filters.market !== 'all' && s.market !== filters.market) return false;
      if (filters.timeframe !== 'all' && s.timeframe !== filters.timeframe) return false;
      if (filters.direction !== 'all' && s.direction !== filters.direction) return false;
      if (s.score < filters.minScore) return false;
      return true;
    });
  }, [signals, filters]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">Scanner de Señales</h1>
            <p className="text-xs text-gray-500">Scalping · Cripto · Forex · Futuros</p>
          </div>

          {/* Indicador de conexión + fuente crypto */}
          <div className="flex items-center gap-3">
            {cryptoSource && (
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                cryptoSource === 'binance'
                  ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                  : 'bg-gray-700/50 text-gray-400 border-gray-600/40'
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${cryptoSource === 'binance' ? 'bg-yellow-400' : 'bg-gray-500'}`} />
                Crypto: {cryptoSource === 'binance' ? 'Binance' : 'Mock'}
              </span>
            )}
            {connected ? (
              <>
                <span className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm text-green-400 font-medium">En vivo</span>
                {lastUpdate && (
                  <span className="text-xs text-gray-600">
                    {lastUpdate.toLocaleTimeString()}
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                <span className="text-sm text-red-400 font-medium">Desconectado — reconectando…</span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-5">
        <MetricCards signals={filtered} />
        <FilterBar filters={filters} onChange={setFilters} />
        <SignalTable signals={filtered} />
      </main>
    </div>
  );
}
