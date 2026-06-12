import { useState, useEffect } from 'react';

const VERDICT_STYLES = {
  keep: 'text-green-400', avoid: 'text-red-400', improve: 'text-amber-400'
};

function disciplineColor(n) {
  if (n >= 75) return 'text-green-400';
  if (n >= 50) return 'text-amber-400';
  return 'text-red-400';
}

function Skeleton({ className }) {
  return <div className={`animate-pulse rounded bg-gray-800 ${className}`} />;
}

export function AIAnalysis({ analysis, isStreaming, error, groqAvailable, tradesCount, onGenerate, onGoToTrades }) {
  const canGenerate = tradesCount >= 5 && groqAvailable && !isStreaming;

  // Typewriter del summary
  const [typed, setTyped] = useState('');
  useEffect(() => {
    const full = analysis?.summary ?? '';
    setTyped('');
    if (!full) return;
    let i = 0;
    const id = setInterval(() => { i += 2; setTyped(full.slice(0, i)); if (i >= full.length) clearInterval(id); }, 15);
    return () => clearInterval(id);
  }, [analysis?.summary]);

  const emotionalPatterns = (analysis?.emotional_patterns ?? []).filter(p => ['FOMO', 'REVENGE'].includes(p.emotion));

  return (
    <div className="space-y-4">
      {/* Header / generar */}
      <div className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-900 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1 text-xs ${groqAvailable ? 'text-green-400' : 'text-red-400'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${groqAvailable ? 'bg-green-400' : 'bg-red-500'}`} />
            {groqAvailable ? 'IA conectada' : 'IA no disponible'}
          </span>
        </div>
        <button onClick={onGenerate} disabled={!canGenerate}
          className={`rounded-lg px-4 py-1.5 text-sm font-medium border ${canGenerate ? 'border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20' : 'border-gray-800 text-gray-600 cursor-not-allowed'}`}>
          {isStreaming ? 'Analizando…' : 'Generar análisis'}
        </button>
      </div>

      {tradesCount < 5 && (
        <div className="rounded-lg border border-amber-700/40 bg-amber-900/20 px-4 py-3 text-sm text-amber-300">
          Registrá al menos 5 operaciones para activar el análisis IA. ({tradesCount}/5)
        </div>
      )}

      {!groqAvailable && (
        <div className="rounded-lg border border-red-700/50 bg-red-900/20 px-4 py-3">
          <div className="flex items-center gap-2 text-red-300 font-semibold mb-1">⚠️ Asistente IA no disponible</div>
          <p className="text-sm text-red-200/80">No se pudo conectar con Groq. Verificá que <code className="text-red-300">GROQ_API_KEY</code> esté configurada en el servidor.</p>
        </div>
      )}

      {error?.error === 'parse_error' && (
        <div className="rounded-lg border border-amber-700/50 bg-amber-900/20 px-4 py-3">
          <p className="text-sm text-amber-300 mb-2">La IA devolvió un JSON inválido. Respuesta cruda:</p>
          <textarea readOnly value={error.raw ?? ''} className="w-full h-32 bg-gray-950 border border-gray-800 rounded p-2 text-xs font-mono text-gray-400" />
        </div>
      )}

      {isStreaming && !analysis && (
        <div className="space-y-3">
          <Skeleton className="h-16 w-32" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {analysis && (
        <>
          {/* Nota de disciplina */}
          {analysis.discipline_score != null && (
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Nota de disciplina</p>
              <p className={`text-5xl font-bold font-mono ${disciplineColor(analysis.discipline_score)}`}>{analysis.discipline_score}</p>
            </div>
          )}

          {/* Errores recurrentes */}
          {analysis.recurring_errors?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Errores recurrentes</h4>
              <div className="space-y-2">
                {analysis.recurring_errors.map((e, i) => (
                  <div key={i} className="rounded-lg border border-red-900/40 bg-red-950/20 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-red-300">{e.error}</span>
                      <span className="text-xs text-gray-500">{e.frequency}</span>
                    </div>
                    <p className="text-sm text-gray-400 mt-1">{e.recommendation}</p>
                    {e.example_trade_ids?.length > 0 && onGoToTrades && (
                      <button onClick={() => onGoToTrades(e.example_trade_ids)} className="mt-2 text-xs text-blue-400 hover:underline">
                        Ver trades ({e.example_trade_ids.join(', ')})
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fortalezas */}
          {analysis.strengths?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Fortalezas</h4>
              <div className="grid sm:grid-cols-2 gap-2">
                {analysis.strengths.map((s, i) => (
                  <div key={i} className="rounded-lg border border-green-900/40 bg-green-950/20 p-3">
                    <div className="font-semibold text-green-300">{s.strength}</div>
                    <p className="text-sm text-gray-400 mt-1">{s.evidence}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Patrones emocionales (solo FOMO/REVENGE) */}
          {emotionalPatterns.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Patrones emocionales</h4>
              <div className="space-y-2">
                {emotionalPatterns.map((p, i) => (
                  <div key={i} className="rounded-lg border border-amber-900/40 bg-amber-950/20 p-3 text-sm">
                    <span className="font-semibold text-amber-300">{p.emotion}</span>
                    <span className="text-gray-500"> · {p.trades_affected} trades</span>
                    <p className="text-gray-400 mt-1">{p.impact}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Setup analysis */}
          {analysis.setup_analysis?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Análisis de setups</h4>
              <div className="rounded-lg border border-gray-800 overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-900/60 text-xs text-gray-500 uppercase"><th className="text-left px-3 py-2">Setup</th><th className="text-left px-3 py-2">Veredicto</th><th className="text-left px-3 py-2">Razón</th></tr></thead>
                  <tbody>
                    {analysis.setup_analysis.map((s, i) => (
                      <tr key={i} className="border-t border-gray-800/60">
                        <td className="px-3 py-2 text-gray-200">{s.setup}</td>
                        <td className={`px-3 py-2 font-semibold uppercase text-xs ${VERDICT_STYLES[s.verdict] ?? 'text-gray-400'}`}>{s.verdict}</td>
                        <td className="px-3 py-2 text-gray-400 text-xs">{s.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Recomendaciones */}
          {analysis.recommendations?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Recomendaciones</h4>
              <ol className="space-y-1.5">
                {[...analysis.recommendations].sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99)).map((r, i) => (
                  <li key={i} className="flex gap-2 text-sm text-gray-300">
                    <span className="text-blue-400 font-mono shrink-0">{r.priority ?? i + 1}.</span>
                    <span>{r.action}{r.expected_impact && <span className="text-gray-500"> — {r.expected_impact}</span>}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Resumen typewriter */}
          {analysis.summary && (
            <div className="rounded-xl border border-gray-800 bg-gray-950/50 p-4">
              <p className="text-sm text-gray-300 leading-relaxed">{typed}<span className="animate-pulse">{typed.length < analysis.summary.length ? '▌' : ''}</span></p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
