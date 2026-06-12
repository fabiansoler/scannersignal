import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid
} from 'recharts';

const EMOTION_COLORS = {
  DISCIPLINED: '#22c55e', CONFIDENT: '#3b82f6', UNCERTAIN: '#eab308',
  FOMO: '#f97316', REVENGE: '#ef4444'
};

function Card({ label, value, color = 'text-gray-100', sub }) {
  return (
    <div className="rounded-xl bg-gray-900 border border-gray-800 p-3">
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-xl font-bold font-mono ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
    </div>
  );
}

const tooltipStyle = { background: '#111827', border: '1px solid #1f2937', borderRadius: 8, fontSize: 12 };

export function StatsPanel({ stats }) {
  if (!stats || stats.total_trades === 0) {
    return <div className="rounded-xl border border-gray-800 bg-gray-900 py-12 text-center text-gray-600 text-sm">Sin datos suficientes — registrá operaciones para ver estadísticas.</div>;
  }

  const streak = stats.current_streak ?? {};
  const emotionData = Object.entries(stats.emotion_breakdown ?? {}).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-5">
      {/* Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card label="Win rate" value={`${stats.win_rate}%`} color={stats.win_rate >= 50 ? 'text-green-400' : 'text-red-400'} />
        <Card label="PnL total" value={`$${stats.total_pnl}`} color={stats.total_pnl >= 0 ? 'text-green-400' : 'text-red-400'} />
        <Card label="RR promedio real" value={stats.avg_rr_actual ?? '—'} sub={`planificado ${stats.avg_rr_planned ?? '—'}`} />
        <Card label="Racha actual" value={streak.count ? `${streak.count} ${streak.type === 'WIN' ? 'W' : 'L'}` : '—'} color={streak.type === 'WIN' ? 'text-green-400' : streak.type === 'LOSS' ? 'text-red-400' : 'text-gray-400'} />
        <Card label="Siguió el plan" value={`${stats.followed_plan_rate}%`} color={stats.followed_plan_rate >= 70 ? 'text-green-400' : 'text-amber-400'} />
        <Card label="Score win / loss" value={`${stats.avg_score_winning} / ${stats.avg_score_losing}`} />
      </div>

      {/* Equity curve */}
      {stats.equity_curve?.length > 0 && (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Curva de equity (PnL acumulado)</h4>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={stats.equity_curve}>
              <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke="#6b7280" fontSize={11} />
              <YAxis stroke="#6b7280" fontSize={11} />
              <Tooltip contentStyle={tooltipStyle} />
              <ReferenceLine y={0} stroke="#4b5563" />
              <Line type="monotone" dataKey="cumulative_pnl" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Win rate por setup */}
        {stats.by_setup?.length > 0 && (
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Win rate por setup</h4>
            <ResponsiveContainer width="100%" height={Math.max(160, stats.by_setup.length * 38)}>
              <BarChart data={stats.by_setup} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" domain={[0, 100]} stroke="#6b7280" fontSize={11} />
                <YAxis type="category" dataKey="setup" stroke="#6b7280" fontSize={10} width={110} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="win_rate" radius={[0, 4, 4, 0]}>
                  {stats.by_setup.map((s, i) => <Cell key={i} fill={s.win_rate >= 50 ? '#22c55e' : '#ef4444'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Win rate por sesión */}
        {stats.by_session?.length > 0 && (
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Win rate por sesión</h4>
            <ResponsiveContainer width="100%" height={Math.max(160, stats.by_session.length * 38)}>
              <BarChart data={stats.by_session} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" domain={[0, 100]} stroke="#6b7280" fontSize={11} />
                <YAxis type="category" dataKey="session" stroke="#6b7280" fontSize={10} width={110} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="win_rate" radius={[0, 4, 4, 0]}>
                  {stats.by_session.map((s, i) => <Cell key={i} fill={s.win_rate >= 50 ? '#22c55e' : '#ef4444'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Breakdown emocional */}
      {emotionData.length > 0 && (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Breakdown emocional</h4>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={emotionData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e) => `${e.name} (${e.value})`} labelLine={false} fontSize={11}>
                {emotionData.map((e, i) => <Cell key={i} fill={EMOTION_COLORS[e.name] ?? '#6b7280'} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
