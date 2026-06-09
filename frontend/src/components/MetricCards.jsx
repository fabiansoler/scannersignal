export function MetricCards({ signals }) {
  const active = signals.length;
  const longs = signals.filter(s => s.direction === 'LONG').length;
  const shorts = signals.filter(s => s.direction === 'SHORT').length;
  const avgScore = active
    ? Math.round(signals.reduce((acc, s) => acc + s.score, 0) / active)
    : 0;

  const cards = [
    { label: 'Señales activas', value: active, color: 'text-blue-400' },
    { label: 'Longs', value: longs, color: 'text-green-400' },
    { label: 'Shorts', value: shorts, color: 'text-red-400' },
    { label: 'Score promedio', value: avgScore, color: 'text-yellow-400' }
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map(card => (
        <div key={card.label} className="rounded-xl bg-gray-900 border border-gray-800 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{card.label}</p>
          <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
        </div>
      ))}
    </div>
  );
}
