// Panel general: score promedio, label de señal y barra gradiente -100/+100.

const SIGNAL_STYLES = {
  'STRONG BUY':  'bg-green-500/20 text-green-300 border-green-500/40',
  'WEAK BUY':    'bg-green-500/10 text-green-400 border-green-600/30',
  'NEUTRAL':     'bg-gray-500/20 text-gray-400 border-gray-500/30',
  'WEAK SELL':   'bg-red-500/10 text-red-400 border-red-600/30',
  'STRONG SELL': 'bg-red-500/20 text-red-300 border-red-500/40'
};

function scoreColor(score) {
  if (score > 0) return 'text-green-400';
  if (score < 0) return 'text-red-400';
  return 'text-gray-400';
}

export function ConfluencePanel({ overallScore = 0, signal = 'NEUTRAL', lastUpdated }) {
  // Posición del marcador en la barra: -100 → 0%, 0 → 50%, +100 → 100%
  const markerPct = Math.min(100, Math.max(0, (overallScore + 100) / 2));
  const signalStyle = SIGNAL_STYLES[signal] ?? SIGNAL_STYLES.NEUTRAL;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Score de confluencia</p>
          <p className={`font-mono text-4xl font-bold ${scoreColor(overallScore)}`}>
            {overallScore > 0 ? '+' : ''}{overallScore}
          </p>
        </div>
        <span className={`rounded-lg border px-4 py-2 text-sm font-bold ${signalStyle}`}>
          {signal}
        </span>
      </div>

      {/* Barra gradiente -100 / +100 */}
      <div className="relative h-3 rounded-full overflow-hidden"
           style={{ background: 'linear-gradient(90deg, #ef4444 0%, #6b7280 50%, #22c55e 100%)' }}>
        <div
          className="absolute top-0 h-3 w-1 -ml-0.5 bg-white rounded-full shadow"
          style={{ left: `${markerPct}%` }}
        />
      </div>
      <div className="flex justify-between mt-1 text-xs font-mono text-gray-600">
        <span>-100</span>
        <span>0</span>
        <span>+100</span>
      </div>

      {lastUpdated && (
        <p className="mt-3 text-xs text-gray-600">
          Actualizado: {lastUpdated.toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
