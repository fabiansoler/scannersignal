import { useState } from 'react';
import { SignalRow } from './SignalRow.jsx';
import { PositionCalculator } from './PositionCalculator.jsx';

const HEADERS = ['Par', 'Dirección', 'Setup', 'Score', 'Indicadores', 'Precio', 'TF', ''];

export function SignalTable({ signals, onRegisterTrade }) {
  const sorted = [...signals].sort((a, b) => b.score - a.score);
  const [selectedSignal, setSelectedSignal] = useState(null);

  return (
    <div className="rounded-xl border border-gray-800 overflow-hidden">
      {sorted.length === 0 ? (
        <div className="py-16 text-center text-gray-600 text-sm">
          Sin señales activas con los filtros actuales
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/80">
                {HEADERS.map((h, i) => (
                  <th key={h || `col-${i}`} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(s => (
                <SignalRow key={`${s.pair}:${s.timeframe}`} signal={s} onSelect={setSelectedSignal} onRegisterTrade={onRegisterTrade} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedSignal && (
        <PositionCalculator signal={selectedSignal} onClose={() => setSelectedSignal(null)} />
      )}
    </div>
  );
}
