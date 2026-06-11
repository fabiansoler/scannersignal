// Una tarjeta por timeframe (M1 / M5 / M15): badge de score + 4 filas de indicadores.

const BULL = new Set(['BULL', 'OVERSOLD']);
const BEAR = new Set(['BEAR', 'OVERBOUGHT']);

function indicatorStyle(value) {
  if (BULL.has(value)) return { arrow: '▲', cls: 'text-green-400' };
  if (BEAR.has(value)) return { arrow: '▼', cls: 'text-red-400' };
  if (value === 'HIGH') return { arrow: '●', cls: 'text-blue-400' };
  if (value === 'NORMAL') return { arrow: '○', cls: 'text-gray-600' };
  return { arrow: '—', cls: 'text-gray-600' };
}

function scoreColor(score) {
  if (score > 0) return 'text-green-400';
  if (score < 0) return 'text-red-400';
  return 'text-gray-400';
}

const ROWS = [
  { key: 'ema', label: 'EMA' },
  { key: 'rsi', label: 'RSI' },
  { key: 'macd', label: 'MACD' },
  { key: 'volume', label: 'Vol' }
];

export function TimeframeCard({ label, data, pulseKey }) {
  const tf = data ?? { ema: 'NEUTRAL', rsi: 'NEUTRAL', macd: 'NEUTRAL', volume: 'NORMAL', score: 0 };

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <div key={pulseKey} className="signal-new">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</span>
          <span className={`font-mono text-lg font-bold ${scoreColor(tf.score)}`}>
            {tf.score > 0 ? '+' : ''}{tf.score}
          </span>
        </div>

        <div className="space-y-1.5">
          {ROWS.map(({ key, label: rowLabel }) => {
            const value = tf[key];
            const { arrow, cls } = indicatorStyle(value);
            return (
              <div key={key} className="flex items-center justify-between text-sm">
                <span className="text-gray-500">{rowLabel}</span>
                <span className={`flex items-center gap-1.5 font-mono ${cls}`}>
                  <span>{arrow}</span>
                  <span className="text-xs">{value}</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
