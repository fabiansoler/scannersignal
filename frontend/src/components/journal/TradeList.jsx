const RESULT_STYLES = {
  WIN: 'text-green-400', LOSS: 'text-red-400', BREAKEVEN: 'text-gray-400', OPEN: 'text-blue-400'
};

function fmt(n, d = 2) {
  return Number.isFinite(n) ? n.toFixed(d) : '—';
}
function fmtDate(ts) {
  return ts ? new Date(ts).toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
}

export function TradeList({
  trades, total, filters, setFilters, page, setPage, pageSize,
  pairsByMarket, onCloseTrade, onDelete, onFeedback
}) {
  const allPairs = Object.values(pairsByMarket).flat();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const inputCls = 'bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500';

  return (
    <div className="space-y-3">
      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center p-3 rounded-xl bg-gray-900 border border-gray-800">
        <select value={filters.pair} onChange={e => setFilters({ ...filters, pair: e.target.value })} className={inputCls}>
          <option value="">Todos los pares</option>
          {allPairs.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filters.result} onChange={e => setFilters({ ...filters, result: e.target.value })} className={inputCls}>
          <option value="">Todos</option>
          {['WIN', 'LOSS', 'BREAKEVEN', 'OPEN'].map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <input type="date" value={filters.dateFrom} onChange={e => setFilters({ ...filters, dateFrom: e.target.value })} className={inputCls} />
        <input type="date" value={filters.dateTo} onChange={e => setFilters({ ...filters, dateTo: e.target.value })} className={inputCls} />
        <span className="ml-auto text-xs text-gray-500">{total} operaciones</span>
      </div>

      {/* Tabla */}
      <div className="rounded-xl border border-gray-800 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-900/80 text-xs text-gray-500 uppercase">
              {['Fecha', 'Par', 'Dir', 'Setup', 'Resultado', 'PnL', 'RR', 'Score', 'Emoción', ''].map((h, i) => (
                <th key={i} className="px-3 py-2 text-left whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {trades.length === 0 ? (
              <tr><td colSpan={10} className="py-10 text-center text-gray-600">Sin operaciones registradas</td></tr>
            ) : trades.map(t => (
              <tr key={t.id} className={`border-b border-gray-800/60 ${t.result === 'OPEN' ? 'bg-blue-950/20' : 'hover:bg-gray-900/40'}`}>
                <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{fmtDate(t.entry_time)}</td>
                <td className="px-3 py-2 font-semibold text-gray-200 whitespace-nowrap">
                  {t.pair}
                  {!t.followed_plan && <span title="No siguió el plan" className="ml-1 text-amber-400">⚠</span>}
                </td>
                <td className={`px-3 py-2 font-semibold ${t.direction === 'LONG' ? 'text-green-400' : 'text-red-400'}`}>{t.direction}</td>
                <td className="px-3 py-2 text-gray-400 text-xs max-w-[160px] truncate" title={t.setup}>{t.setup}</td>
                <td className={`px-3 py-2 font-semibold ${RESULT_STYLES[t.result] ?? 'text-gray-400'}`}>{t.result}</td>
                <td className={`px-3 py-2 font-mono ${t.pnl > 0 ? 'text-green-400' : t.pnl < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                  {t.pnl == null ? '—' : `$${fmt(t.pnl)}`}
                </td>
                <td className="px-3 py-2 font-mono text-gray-300">{t.rr_actual == null ? '—' : fmt(t.rr_actual)}</td>
                <td className="px-3 py-2 font-mono text-gray-500">{t.signal_score ?? '—'}</td>
                <td className="px-3 py-2 text-xs text-gray-500">{t.emotion ?? '—'}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <div className="flex gap-1.5">
                    {t.result === 'OPEN' && (
                      <button onClick={() => onCloseTrade(t)} className="rounded border border-blue-500/40 bg-blue-500/10 px-2 py-0.5 text-xs text-blue-300 hover:bg-blue-500/20">Cerrar</button>
                    )}
                    {onFeedback && (
                      <button onClick={() => onFeedback(t)} title="Feedback IA" className="rounded border border-gray-700 px-2 py-0.5 text-xs text-gray-400 hover:text-white">IA</button>
                    )}
                    <button onClick={() => onDelete(t.id)} className="rounded border border-gray-700 px-2 py-0.5 text-xs text-gray-500 hover:text-red-400">×</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded px-3 py-1 border border-gray-700 text-gray-400 disabled:opacity-40 hover:text-white">←</button>
          <span className="text-gray-500">{page + 1} / {totalPages}</span>
          <button disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)} className="rounded px-3 py-1 border border-gray-700 text-gray-400 disabled:opacity-40 hover:text-white">→</button>
        </div>
      )}
    </div>
  );
}
