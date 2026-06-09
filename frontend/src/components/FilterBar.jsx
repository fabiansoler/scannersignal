export function FilterBar({ filters, onChange }) {
  const { market, timeframe, direction, minScore } = filters;

  const toggle = (key, value) => {
    onChange({ ...filters, [key]: filters[key] === value ? 'all' : value });
  };

  return (
    <div className="flex flex-wrap gap-3 items-center p-4 rounded-xl bg-gray-900 border border-gray-800">
      {/* Mercado */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500 uppercase">Mercado</label>
        <select
          value={market}
          onChange={e => onChange({ ...filters, market: e.target.value })}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="all">Todos</option>
          <option value="crypto">Cripto</option>
          <option value="forex">Forex</option>
          <option value="futures">Futuros</option>
        </select>
      </div>

      {/* Timeframe */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500 uppercase">Timeframe</label>
        <select
          value={timeframe}
          onChange={e => onChange({ ...filters, timeframe: e.target.value })}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="all">Todos</option>
          <option value="M1">M1</option>
          <option value="M5">M5</option>
          <option value="M15">M15</option>
        </select>
      </div>

      {/* Dirección — chips toggle */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500 uppercase">Dirección</label>
        {['LONG', 'SHORT', 'NEUTRAL'].map(dir => (
          <button
            key={dir}
            onClick={() => toggle('direction', dir)}
            className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
              direction === dir
                ? dir === 'LONG'
                  ? 'bg-green-600 border-green-500 text-white'
                  : dir === 'SHORT'
                  ? 'bg-red-600 border-red-500 text-white'
                  : 'bg-gray-600 border-gray-500 text-white'
                : 'bg-transparent border-gray-700 text-gray-400 hover:border-gray-500'
            }`}
          >
            {dir}
          </button>
        ))}
      </div>

      {/* Score mínimo */}
      <div className="flex items-center gap-3 ml-auto">
        <label className="text-xs text-gray-500 uppercase whitespace-nowrap">
          Score mín: <span className="text-gray-200 font-semibold">{minScore}</span>
        </label>
        <input
          type="range"
          min={0}
          max={100}
          value={minScore}
          onChange={e => onChange({ ...filters, minScore: Number(e.target.value) })}
          className="w-28 accent-blue-500"
        />
      </div>
    </div>
  );
}
