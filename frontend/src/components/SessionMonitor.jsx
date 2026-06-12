import {
  useSessionMonitor,
  SESSIONS,
  utcHourToLocal,
  utcHourToLocalHour
} from '../hooks/useSessionMonitor.js';

// Qué sesiones participan de cada overlap (para el borde dorado)
const OVERLAP_SESSIONS = {
  'Tokyo / London': ['tokyo', 'london'],
  'London / NY': ['london', 'newYork']
};

function SessionPill({ sessionKey, isOpen, inOverlap, small }) {
  const s = SESSIONS[sessionKey];
  const base = small
    ? 'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs'
    : 'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm';

  if (small) {
    return (
      <span className={`${base} ${isOpen ? 'bg-green-500/15 text-green-300' : 'bg-gray-800 text-gray-500'}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${isOpen ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
        {s.label}
      </span>
    );
  }

  return (
    <div className={`${base} ${
      inOverlap
        ? 'border-amber-500/60 bg-amber-500/5'
        : isOpen
        ? 'border-green-600/40 bg-green-500/5'
        : 'border-gray-800 bg-gray-900'
    }`}>
      <span className={`h-2.5 w-2.5 rounded-full ${isOpen ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
      <div className="leading-tight">
        <div className={isOpen ? 'text-gray-100 font-semibold' : 'text-gray-500'}>{s.label}</div>
        <div className="text-xs font-mono text-gray-500">
          {utcHourToLocal(s.open)}–{utcHourToLocal(s.close)}
        </div>
      </div>
    </div>
  );
}

function Heatmap({ volatilityData }) {
  const cells = volatilityData?.volatility ?? Array.from({ length: 24 }, (_, hour) => ({
    hour, score_avg: 0, signal_count: 0, volatility_index: 0
  }));
  const currentUtcHour = new Date().getUTCHours();

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Volatilidad por hora (local)</h4>
        {volatilityData?.source === 'mock' && (
          <span className="text-xs text-gray-600">datos típicos (sin historial aún)</span>
        )}
      </div>
      <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(12, minmax(0, 1fr))' }}>
        {cells.map(c => {
          const alpha = 0.08 + (c.volatility_index / 100) * 0.92;
          const isNow = c.hour === currentUtcHour;
          const localH = String(utcHourToLocalHour(c.hour)).padStart(2, '0');
          return (
            <div
              key={c.hour}
              title={`Hora local ${utcHourToLocal(c.hour)}\nVolatilidad: ${c.volatility_index}/100\nSeñales: ${c.signal_count}`}
              className={`flex items-center justify-center rounded text-xs font-mono py-1.5 ${
                isNow ? 'ring-2 ring-blue-400 text-white' : 'text-gray-300'
              }`}
              style={{ background: `rgba(239,159,39,${alpha})` }}
            >
              {localH}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SessionMonitor({ isCollapsed, onToggle }) {
  const { activeSessions, overlaps, nextEvent, countdown, volatilityData, isHighLiquidity } = useSessionMonitor();

  const overlapSessionKeys = new Set(
    overlaps.flatMap(o => OVERLAP_SESSIONS[o.label] ?? [])
  );

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <h3 className="text-sm font-semibold text-white">Sesiones &amp; Liquidez</h3>
        <button
          onClick={onToggle}
          className="text-gray-500 hover:text-white text-sm px-2"
          aria-label={isCollapsed ? 'Expandir' : 'Colapsar'}
        >
          {isCollapsed ? '▼' : '▲'}
        </button>
      </div>

      {isCollapsed ? (
        /* Resumen colapsado */
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          {Object.keys(SESSIONS).map(key => (
            <SessionPill key={key} sessionKey={key} isOpen={activeSessions.includes(key)} small />
          ))}
          <span className="ml-auto text-xs font-mono text-gray-400">
            {nextEvent.label} <span className="text-gray-200">{countdown}</span>
          </span>
        </div>
      ) : (
        <div className="p-4 space-y-4">
          {/* Banner alta liquidez */}
          {isHighLiquidity && (
            <div className="rounded-lg border border-green-700/40 bg-green-900/20 px-4 py-2 text-sm text-green-300">
              ⚡ Alta liquidez — mejor momento para scalping (overlap London/NY activo)
            </div>
          )}

          {/* Sesiones */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Object.keys(SESSIONS).map(key => (
              <SessionPill
                key={key}
                sessionKey={key}
                isOpen={activeSessions.includes(key)}
                inOverlap={overlapSessionKeys.has(key)}
              />
            ))}
          </div>

          {/* Countdown */}
          <div className="rounded-lg bg-gray-950/50 border border-gray-800 px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-gray-400">{nextEvent.label}</span>
            <span className="font-mono text-xl font-bold text-white">{countdown}</span>
          </div>

          {/* Heatmap */}
          <Heatmap volatilityData={volatilityData} />
        </div>
      )}
    </div>
  );
}
