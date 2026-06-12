import { useState, useMemo } from 'react';
import { useScanner } from './hooks/useScanner.js';
import { MetricCards } from './components/MetricCards.jsx';
import { FilterBar } from './components/FilterBar.jsx';
import { SignalTable } from './components/SignalTable.jsx';
import { SessionMonitor } from './components/SessionMonitor.jsx';
import { ConfluencePage } from './pages/ConfluencePage.jsx';

const DEFAULT_FILTERS = {
  market: 'all',
  timeframe: 'all',
  direction: 'all',
  minScore: 50
};

const TABS = [
  { id: 'scanner', label: 'Scanner' },
  { id: 'confluence', label: 'Confluencia' }
];

export default function App() {
  const { signals, connected, lastUpdate } = useScanner();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [tab, setTab] = useState('scanner');
  const [sessionCollapsed, setSessionCollapsed] = useState(false);

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
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">Scanner de Señales</h1>
            <p className="text-xs text-gray-500">Scalping · Cripto · Forex · Futuros</p>
          </div>

          <div className="flex items-center gap-3">
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
        <div className="max-w-7xl mx-auto px-4 flex gap-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-blue-500 text-white'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-5">
        {tab === 'scanner' ? (
          <>
            {connected && signals.length === 0 && (
              <div className="rounded-lg border border-yellow-800/50 bg-yellow-900/20 px-4 py-3 text-sm text-yellow-400">
                Sin señales disponibles — verificar conexión con los feeds de mercado.
              </div>
            )}
            <SessionMonitor
              isCollapsed={sessionCollapsed}
              onToggle={() => setSessionCollapsed(prev => !prev)}
            />
            <MetricCards signals={filtered} />
            <FilterBar filters={filters} onChange={setFilters} />
            <SignalTable signals={filtered} />
          </>
        ) : (
          <ConfluencePage />
        )}
      </main>
    </div>
  );
}
