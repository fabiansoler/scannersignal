import { useState, useEffect } from 'react';
import { useJournal, EXPORT_URL } from '../hooks/useJournal.js';
import { TradeForm } from './journal/TradeForm.jsx';
import { TradeList } from './journal/TradeList.jsx';
import { StatsPanel } from './journal/StatsPanel.jsx';
import { AIAnalysis } from './journal/AIAnalysis.jsx';

const API_BASE = import.meta.env.DEV ? 'http://localhost:3001' : '';
const SUBTABS = [
  { id: 'operaciones', label: 'Operaciones' },
  { id: 'stats', label: 'Estadísticas' },
  { id: 'ai', label: 'Análisis IA' }
];

export function Journal({ prefill, onPrefillConsumed }) {
  const j = useJournal();
  const [pairsByMarket, setPairsByMarket] = useState({ crypto: [], forex: [], futures: [] });
  const [subTab, setSubTab] = useState('operaciones');
  const [showForm, setShowForm] = useState(false);
  const [formPrefill, setFormPrefill] = useState(null);
  const [tradeToClose, setTradeToClose] = useState(null);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/pairs`).then(r => r.json()).then(r => { if (r.data) setPairsByMarket(r.data); }).catch(() => {});
  }, []);

  // Pre-populación desde el scanner
  useEffect(() => {
    if (prefill) {
      setFormPrefill(prefill);
      setShowForm(true);
      setTradeToClose(null);
      setSubTab('operaciones');
      onPrefillConsumed?.();
    }
  }, [prefill, onPrefillConsumed]);

  const handleNew = async (data) => {
    try { await j.addTrade(data); setShowForm(false); setFormPrefill(null); }
    catch (e) { alert(e.message); }
  };
  const handleClose = async (exitData) => {
    await j.closeTrade(tradeToClose.id, exitData);
    setTradeToClose(null);
  };
  const handleFeedback = async (trade) => {
    setFeedback({ pair: trade.pair, text: 'Generando feedback…' });
    const r = await j.generateTradeFeedback(trade.id);
    setFeedback({ pair: trade.pair, text: r.feedback || r.message || 'No disponible' });
  };

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex items-center gap-1 border-b border-gray-800">
        {SUBTABS.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${subTab === t.id ? 'border-blue-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
            {t.label}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          <a href={EXPORT_URL} className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-400 hover:text-white">Exportar CSV</a>
          {subTab === 'operaciones' && (
            <button onClick={() => { setFormPrefill(null); setTradeToClose(null); setShowForm(v => !v); }}
              className="rounded-lg bg-blue-600 hover:bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white">
              {showForm ? 'Cerrar formulario' : '+ Nueva operación'}
            </button>
          )}
        </div>
      </div>

      {/* Feedback IA puntual */}
      {feedback && (
        <div className="rounded-lg border border-blue-800/40 bg-blue-900/20 px-4 py-2 text-sm text-blue-200 flex items-start justify-between gap-3">
          <span><strong>{feedback.pair}:</strong> {feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="text-gray-500 hover:text-white">×</button>
        </div>
      )}

      {subTab === 'operaciones' && (
        <>
          {(showForm || tradeToClose) && (
            <TradeForm
              prefill={formPrefill}
              tradeToClose={tradeToClose}
              pairsByMarket={pairsByMarket}
              onSubmit={tradeToClose ? handleClose : handleNew}
              onClose={() => { setShowForm(false); setTradeToClose(null); setFormPrefill(null); }}
            />
          )}
          <TradeList
            trades={j.trades} total={j.total} filters={j.filters} setFilters={j.setFilters}
            page={j.page} setPage={j.setPage} pageSize={j.pageSize} pairsByMarket={pairsByMarket}
            onCloseTrade={(t) => { setTradeToClose(t); setShowForm(false); }}
            onDelete={(id) => { if (confirm('¿Eliminar esta operación?')) j.deleteTrade(id); }}
            onFeedback={j.groqAvailable ? handleFeedback : null}
          />
        </>
      )}

      {subTab === 'stats' && <StatsPanel stats={j.stats} />}

      {subTab === 'ai' && (
        <AIAnalysis
          analysis={j.analysis} isStreaming={j.isStreaming} error={j.error} groqAvailable={j.groqAvailable}
          tradesCount={j.total} onGenerate={j.generateAnalysis} onGoToTrades={() => setSubTab('operaciones')}
        />
      )}
    </div>
  );
}
