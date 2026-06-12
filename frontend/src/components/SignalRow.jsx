import { AlertBadge } from './AlertBadge.jsx';

const DIR_STYLES = {
  LONG: 'bg-green-500/20 text-green-400 border-green-500/30',
  SHORT: 'bg-red-500/20 text-red-400 border-red-500/30',
  NEUTRAL: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
};

const IND_LABELS = { rsi: 'RSI', ema: 'EMA', macd: 'MACD', volume: 'Vol' };

function RowBg({ score }) {
  if (score >= 80) return 'bg-green-950/40 hover:bg-green-950/60 border-green-900/40';
  if (score >= 65) return 'bg-yellow-950/30 hover:bg-yellow-950/50 border-yellow-900/30';
  return 'bg-gray-900/60 hover:bg-gray-800/60 border-gray-800';
}

function formatPrice(price) {
  if (price == null) return '—';
  if (price >= 1000) return price.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (price >= 1) return price.toFixed(4);
  return price.toFixed(6);
}

export function SignalRow({ signal, onSelect }) {
  const dirStyle = DIR_STYLES[signal.direction] ?? DIR_STYLES.NEUTRAL;
  const rowBg = RowBg({ score: signal.score });

  return (
    <tr className={`border-b transition-colors signal-new ${rowBg}`}>
      {/* Par + mercado */}
      <td className="px-4 py-3">
        <div className="font-semibold text-gray-100">{signal.pair}</div>
        <div className="text-xs text-gray-500 uppercase">{signal.market}</div>
      </td>

      {/* Dirección */}
      <td className="px-4 py-3">
        <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-bold ${dirStyle}`}>
          {signal.direction}
        </span>
      </td>

      {/* Setup */}
      <td className="px-4 py-3 text-sm text-gray-300 max-w-xs">
        <div>{signal.setup}</div>
        <AlertBadge score={signal.score} />
      </td>

      {/* Score con barra visual */}
      <td className="px-4 py-3 w-36">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 rounded-full bg-gray-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                signal.score >= 80
                  ? 'bg-green-500'
                  : signal.score >= 65
                  ? 'bg-yellow-500'
                  : 'bg-blue-500'
              }`}
              style={{ width: `${signal.score}%` }}
            />
          </div>
          <span className="text-sm font-bold text-gray-200 w-8 text-right">{signal.score}</span>
        </div>
      </td>

      {/* Indicadores — dots */}
      <td className="px-4 py-3">
        <div className="flex gap-1.5 flex-wrap">
          {Object.entries(signal.indicators ?? {}).map(([key, active]) => (
            <span
              key={key}
              title={IND_LABELS[key]}
              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${
                active
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  : 'bg-gray-800 text-gray-600 border border-gray-700'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-blue-400' : 'bg-gray-600'}`} />
              {IND_LABELS[key]}
            </span>
          ))}
        </div>
      </td>

      {/* Precio */}
      <td className="px-4 py-3 text-sm font-mono text-gray-300">
        {formatPrice(signal.price)}
      </td>

      {/* Timeframe */}
      <td className="px-4 py-3 text-xs text-gray-500">
        {signal.timeframe}
      </td>

      {/* Acción */}
      <td className="px-4 py-3">
        <button
          onClick={() => onSelect?.(signal)}
          className="rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-300 hover:bg-blue-500/20 transition-colors whitespace-nowrap"
        >
          Calcular
        </button>
      </td>
    </tr>
  );
}
