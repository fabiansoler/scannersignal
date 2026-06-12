import { useState, useEffect, useMemo } from 'react';
import { useMarketContext } from '../hooks/useMarketContext.js';

const BIAS_STYLES = {
  BULLISH: { label: 'ALCISTA', cls: 'bg-green-500/20 text-green-300 border-green-500/40', bar: 'bg-green-500' },
  BEARISH: { label: 'BAJISTA', cls: 'bg-red-500/20 text-red-300 border-red-500/40', bar: 'bg-red-500' },
  LATERAL: { label: 'LATERAL', cls: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40', bar: 'bg-yellow-500' }
};

const IMPACT_COLOR = { high: 'text-red-400', medium: 'text-yellow-400', low: 'text-gray-500' };

function eventLocalTime(timeStr) {
  // "14:30 UTC" → hora local; si no matchea, devuelve el string original
  const m = /^(\d{1,2}):(\d{2})\s*UTC$/i.exec((timeStr || '').trim());
  if (!m) return timeStr;
  const d = new Date();
  d.setUTCHours(Number(m[1]), Number(m[2]), 0, 0);
  return new Intl.DateTimeFormat([], { hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
}

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded bg-gray-800 ${className}`} />;
}

export function MarketContext({ pairs = [], timeframe = 'M5', isCollapsed, onToggle }) {
  const {
    analysis, loading, error, groqAvailable, isStreaming, streamingText,
    stale, sessionChanged, refresh, dismissSessionChange
  } = useMarketContext({ pairs, timeframe });

  // Typewriter del context_summary
  const [typed, setTyped] = useState('');
  useEffect(() => {
    const full = analysis?.context_summary ?? '';
    setTyped('');
    if (!full) return;
    let i = 0;
    const id = setInterval(() => {
      i += 2;
      setTyped(full.slice(0, i));
      if (i >= full.length) clearInterval(id);
    }, 15);
    return () => clearInterval(id);
  }, [analysis?.context_summary]);

  const activeSet = useMemo(() => new Set(pairs), [pairs]);
  const visibleLevels = useMemo(() => {
    const levels = analysis?.key_levels ?? [];
    return activeSet.size ? levels.filter(l => activeSet.has(l.pair)) : levels;
  }, [analysis, activeSet]);

  const bias = analysis?.bias?.overall ? (BIAS_STYLES[analysis.bias.overall] ?? BIAS_STYLES.LATERAL) : null;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <h3 className="text-sm font-semibold text-white whitespace-nowrap">Briefing de sesión</h3>
          {analysis?.generated_at && (
            <span className="text-xs text-gray-600 whitespace-nowrap">
              {new Date(analysis.generated_at).toLocaleTimeString()}
            </span>
          )}
          {analysis?.session && (
            <span className="hidden sm:inline rounded-full bg-blue-500/15 text-blue-300 px-2 py-0.5 text-xs whitespace-nowrap">
              {analysis.session}
            </span>
          )}
          {stale && (
            <span className="rounded-full bg-amber-500/15 text-amber-300 px-2 py-0.5 text-xs whitespace-nowrap">Desactualizado</span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className={`flex items-center gap-1 text-xs ${groqAvailable ? 'text-green-400' : 'text-red-400'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${groqAvailable ? 'bg-green-400' : 'bg-red-500'}`} />
            <span className="hidden sm:inline">{groqAvailable ? 'IA conectada' : 'IA no disponible'}</span>
          </span>
          <button
            onClick={refresh}
            disabled={isStreaming || !groqAvailable}
            className={`rounded-lg px-3 py-1 text-xs font-medium border transition-colors ${
              isStreaming || !groqAvailable
                ? 'border-gray-800 text-gray-600 cursor-not-allowed'
                : 'border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20'
            }`}
          >
            {isStreaming ? 'Analizando…' : 'Actualizar análisis'}
          </button>
          <button onClick={onToggle} className="text-gray-500 hover:text-white text-sm px-1" aria-label={isCollapsed ? 'Expandir' : 'Colapsar'}>
            {isCollapsed ? '▼' : '▲'}
          </button>
        </div>
      </div>

      {isCollapsed ? (
        <div className="flex items-center gap-3 px-4 py-2.5">
          {bias ? (
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${bias.cls}`}>{bias.label}</span>
          ) : (
            <span className="text-xs text-gray-600">Sin briefing</span>
          )}
          <span className="text-xs text-gray-500 truncate">{analysis?.context_summary}</span>
        </div>
      ) : (
        <div className="p-4 space-y-4">
          {/* Aviso de cambio de sesión */}
          {sessionChanged && (
            <div className="flex items-center justify-between rounded-lg border border-blue-700/40 bg-blue-900/20 px-4 py-2 text-sm text-blue-300">
              <span>Nueva sesión iniciada — ¿actualizar briefing?</span>
              <div className="flex gap-2">
                <button onClick={refresh} className="rounded bg-blue-600 px-2.5 py-1 text-xs text-white hover:bg-blue-500">Actualizar</button>
                <button onClick={dismissSessionChange} className="rounded border border-gray-700 px-2.5 py-1 text-xs text-gray-400 hover:text-white">Ignorar</button>
              </div>
            </div>
          )}

          {/* Estado de error de Groq */}
          {!groqAvailable && error?.error === 'groq_unavailable' && (
            <div className="rounded-lg border border-red-700/50 bg-red-900/20 px-4 py-3">
              <div className="flex items-center gap-2 text-red-300 font-semibold mb-1">⚠️ Asistente IA no disponible</div>
              <p className="text-sm text-red-200/80 mb-2">
                No se pudo conectar con Groq. Verificá que <code className="text-red-300">GROQ_API_KEY</code> esté configurada en el servidor.
              </p>
              <button onClick={refresh} className="rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-500">Reintentar</button>
            </div>
          )}

          {/* JSON malformado → debug */}
          {error?.error === 'parse_error' && (
            <div className="rounded-lg border border-amber-700/50 bg-amber-900/20 px-4 py-3">
              <p className="text-sm text-amber-300 mb-2">La IA devolvió un JSON inválido. Respuesta cruda:</p>
              <textarea readOnly value={error.raw ?? ''} className="w-full h-32 bg-gray-950 border border-gray-800 rounded p-2 text-xs font-mono text-gray-400" />
            </div>
          )}

          {/* Streaming skeleton */}
          {isStreaming && !analysis && (
            <div className="space-y-3">
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-20 w-full" />
            </div>
          )}

          {/* Contenido del análisis */}
          {analysis && (
            <>
              {/* Bias */}
              {bias && (
                <div className="rounded-xl border border-gray-800 bg-gray-950/50 p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`rounded-lg border px-3 py-1.5 text-sm font-bold ${bias.cls}`}>{bias.label}</span>
                    <span className="text-sm text-gray-500">Confianza: <span className="font-mono text-gray-200">{analysis.bias.confidence}%</span></span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-800 overflow-hidden mb-2">
                    <div className={`h-full ${bias.bar}`} style={{ width: `${analysis.bias.confidence}%` }} />
                  </div>
                  <p className="text-sm text-gray-400">{analysis.bias.reasoning}</p>
                </div>
              )}

              {/* Niveles S/R */}
              {visibleLevels.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Niveles clave S/R</h4>
                  <div className="rounded-lg border border-gray-800 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-900/60 text-xs text-gray-500 uppercase">
                          <th className="text-left px-3 py-2">Par</th>
                          <th className="text-left px-3 py-2">Tipo</th>
                          <th className="text-right px-3 py-2">Precio</th>
                          <th className="text-left px-3 py-2">Fuerza</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleLevels.map((l, i) => (
                          <tr key={i} className="border-t border-gray-800/60">
                            <td className="px-3 py-2 font-semibold text-gray-200">{l.pair}</td>
                            <td className={`px-3 py-2 ${l.type === 'resistance' ? 'text-red-400' : 'text-green-400'}`}>
                              {l.type === 'resistance' ? 'Resistencia' : 'Soporte'}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-gray-200">{l.price}</td>
                            <td className="px-3 py-2 text-xs text-gray-500">{l.strength}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Contexto */}
              {analysis.context_summary && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Contexto del día</h4>
                  <p className="text-sm text-gray-300 leading-relaxed">{typed}<span className="animate-pulse">{typed.length < analysis.context_summary.length ? '▌' : ''}</span></p>
                </div>
              )}

              {/* Eventos */}
              {analysis.key_events?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Eventos del día</h4>
                  <div className="space-y-1.5">
                    {analysis.key_events.map((ev, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm">
                        <span className="font-mono text-xs text-gray-500 w-14">{eventLocalTime(ev.time)}</span>
                        <span className="text-gray-300 flex-1">{ev.event}</span>
                        <span className={`text-xs font-semibold uppercase ${IMPACT_COLOR[ev.impact] ?? 'text-gray-500'}`}>{ev.impact}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tips */}
              {analysis.scalping_tips?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Tips de scalping</h4>
                  <ul className="space-y-1.5">
                    {analysis.scalping_tips.map((tip, i) => (
                      <li key={i} className="flex gap-2 text-sm text-gray-300">
                        <span className="text-amber-400 shrink-0">⚠</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {/* Vacío (sin análisis, sin streaming, sin error) */}
          {!analysis && !isStreaming && !loading && groqAvailable && !error && (
            <p className="text-sm text-gray-600 text-center py-4">
              Sin briefing aún — tocá "Actualizar análisis" para generar uno.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
