// Últimos 20 snapshots de confluencia: Hora | M1 | M5 | M15 | Score | Señal.

const HEADERS = ['Hora', 'M1', 'M5', 'M15', 'Score', 'Señal'];

function scoreColor(score) {
  if (score > 0) return 'text-green-400';
  if (score < 0) return 'text-red-400';
  return 'text-gray-500';
}

const SIGNAL_COLOR = {
  'STRONG BUY':  'text-green-300',
  'WEAK BUY':    'text-green-400',
  'NEUTRAL':     'text-gray-400',
  'WEAK SELL':   'text-red-400',
  'STRONG SELL': 'text-red-300'
};

function fmt(score) {
  return `${score > 0 ? '+' : ''}${score}`;
}

export function SignalHistoryTable({ history }) {
  return (
    <div className="rounded-xl border border-gray-800 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800 bg-gray-900/80">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Historial de señales
        </h3>
      </div>

      {history.length === 0 ? (
        <div className="py-12 text-center text-gray-600 text-sm">
          Esperando datos…
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/50">
                {HEADERS.map(h => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map((snap) => (
                <tr key={snap.id} className="border-b border-gray-800/60 hover:bg-gray-900/40">
                  <td className="px-4 py-2 font-mono text-xs text-gray-500">{snap.time}</td>
                  <td className={`px-4 py-2 font-mono ${scoreColor(snap.M1)}`}>{fmt(snap.M1)}</td>
                  <td className={`px-4 py-2 font-mono ${scoreColor(snap.M5)}`}>{fmt(snap.M5)}</td>
                  <td className={`px-4 py-2 font-mono ${scoreColor(snap.M15)}`}>{fmt(snap.M15)}</td>
                  <td className={`px-4 py-2 font-mono font-bold ${scoreColor(snap.overallScore)}`}>
                    {fmt(snap.overallScore)}
                  </td>
                  <td className={`px-4 py-2 text-xs font-semibold ${SIGNAL_COLOR[snap.signal] ?? 'text-gray-400'}`}>
                    {snap.signal}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
