import { useState } from 'react';

const SETUPS = [
  'EMA Cross + RSI oversold', 'EMA Cross', 'RSI oversold', 'MACD histogram',
  'Pullback a EMA 21', 'Vol spike', 'Otro'
];
const EMOTIONS = ['DISCIPLINED', 'CONFIDENT', 'UNCERTAIN', 'FOMO', 'REVENGE'];

const inputCls = 'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500';
const labelCls = 'block text-xs text-gray-500 uppercase tracking-wide mb-1';

function marketOf(pair, pairsByMarket) {
  for (const [market, list] of Object.entries(pairsByMarket)) {
    if (list.includes(pair)) return market;
  }
  return 'crypto';
}

export function TradeForm({ prefill, tradeToClose, pairsByMarket, onSubmit, onClose }) {
  // ── Modo cierre ──
  if (tradeToClose) {
    return <CloseForm trade={tradeToClose} onSubmit={onSubmit} onClose={onClose} />;
  }

  // ── Modo nueva operación ──
  const allPairs = Object.values(pairsByMarket).flat();
  const [form, setForm] = useState({
    pair: prefill?.pair ?? allPairs[0] ?? 'BTC/USDT',
    direction: prefill?.direction === 'SHORT' ? 'SHORT' : 'LONG',
    setup: prefill?.setup && SETUPS.includes(prefill.setup) ? prefill.setup : (prefill?.setup ? 'Otro' : SETUPS[0]),
    setupOther: prefill?.setup && !SETUPS.includes(prefill.setup) ? prefill.setup : '',
    timeframe: prefill?.timeframe ?? 'M5',
    entry_price: prefill?.entry_price ?? '',
    sl_price: prefill?.sl_price ?? '',
    tp_price: prefill?.tp_price ?? '',
    position_size: prefill?.position_size ?? '',
    risk_pct: prefill?.risk_pct ?? 1,
    risk_amount: prefill?.risk_amount ?? '',
    emotion: 'DISCIPLINED',
    followed_plan: 1,
    notes: '',
    signal_score: prefill?.signal_score ?? null
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = (e) => {
    e.preventDefault();
    const setup = form.setup === 'Otro' ? (form.setupOther || 'Otro') : form.setup;
    onSubmit({
      pair: form.pair,
      market: marketOf(form.pair, pairsByMarket),
      direction: form.direction,
      setup,
      timeframe: form.timeframe,
      entry_price: Number(form.entry_price),
      sl_price: form.sl_price === '' ? null : Number(form.sl_price),
      tp_price: form.tp_price === '' ? null : Number(form.tp_price),
      position_size: form.position_size === '' ? null : Number(form.position_size),
      risk_pct: form.risk_pct === '' ? null : Number(form.risk_pct),
      risk_amount: form.risk_amount === '' ? null : Number(form.risk_amount),
      emotion: form.emotion,
      followed_plan: form.followed_plan,
      notes: form.notes || null,
      signal_score: form.signal_score
    });
  };

  return (
    <form onSubmit={submit} className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Registrar operación</h3>
        {onClose && <button type="button" onClick={onClose} className="text-gray-500 hover:text-white text-lg leading-none">×</button>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Par</label>
          <select value={form.pair} onChange={e => set('pair', e.target.value)} className={inputCls}>
            {Object.entries(pairsByMarket).map(([m, list]) => (
              <optgroup key={m} label={m}>{list.map(p => <option key={p} value={p}>{p}</option>)}</optgroup>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Dirección</label>
          <div className="flex gap-2">
            {['LONG', 'SHORT'].map(d => (
              <button key={d} type="button" onClick={() => set('direction', d)}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold border ${
                  form.direction === d
                    ? d === 'LONG' ? 'bg-green-600 border-green-500 text-white' : 'bg-red-600 border-red-500 text-white'
                    : 'bg-transparent border-gray-700 text-gray-400'
                }`}>{d}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Setup</label>
          <select value={form.setup} onChange={e => set('setup', e.target.value)} className={inputCls}>
            {SETUPS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Timeframe</label>
          <select value={form.timeframe} onChange={e => set('timeframe', e.target.value)} className={inputCls}>
            {['M1', 'M5', 'M15'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {form.setup === 'Otro' && (
        <input placeholder="Nombre del setup" value={form.setupOther} onChange={e => set('setupOther', e.target.value)} className={inputCls} />
      )}

      <div className="grid grid-cols-3 gap-3">
        <div><label className={labelCls}>Entrada</label><input type="number" step="any" required value={form.entry_price} onChange={e => set('entry_price', e.target.value)} className={inputCls} /></div>
        <div><label className={labelCls}>SL</label><input type="number" step="any" value={form.sl_price} onChange={e => set('sl_price', e.target.value)} className={inputCls} /></div>
        <div><label className={labelCls}>TP</label><input type="number" step="any" value={form.tp_price} onChange={e => set('tp_price', e.target.value)} className={inputCls} /></div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div><label className={labelCls}>Tamaño posición</label><input type="number" step="any" value={form.position_size} onChange={e => set('position_size', e.target.value)} className={inputCls} /></div>
        <div><label className={labelCls}>% Riesgo</label><input type="number" step="any" value={form.risk_pct} onChange={e => set('risk_pct', e.target.value)} className={inputCls} /></div>
      </div>

      <div>
        <label className={labelCls}>Emoción al entrar</label>
        <div className="flex flex-wrap gap-1.5">
          {EMOTIONS.map(em => (
            <button key={em} type="button" onClick={() => set('emotion', em)}
              className={`rounded-full px-2.5 py-1 text-xs border ${form.emotion === em ? 'bg-blue-600 border-blue-500 text-white' : 'border-gray-700 text-gray-400'}`}>{em}</button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className={labelCls.replace('block ', '')}>¿Seguiste tu plan?</span>
        <div className="flex gap-2">
          {[[1, 'Sí'], [0, 'No']].map(([v, lbl]) => (
            <button key={v} type="button" onClick={() => set('followed_plan', v)}
              className={`rounded-lg px-3 py-1 text-xs border ${form.followed_plan === v ? (v ? 'bg-green-600 border-green-500 text-white' : 'bg-red-600 border-red-500 text-white') : 'border-gray-700 text-gray-400'}`}>{lbl}</button>
          ))}
        </div>
      </div>

      <textarea placeholder="Notas (opcional)" value={form.notes} onChange={e => set('notes', e.target.value)} className={`${inputCls} h-20 resize-none`} />

      <button type="submit" className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white">
        Guardar operación
      </button>
    </form>
  );
}

function CloseForm({ trade, onSubmit, onClose }) {
  const [exitPrice, setExitPrice] = useState('');
  const [notes, setNotes] = useState(trade.notes ?? '');

  const submit = (e) => {
    e.preventDefault();
    onSubmit({ exit_price: Number(exitPrice), notes: notes || null });
  };

  return (
    <form onSubmit={submit} className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Cerrar {trade.pair} · {trade.direction}</h3>
        {onClose && <button type="button" onClick={onClose} className="text-gray-500 hover:text-white text-lg leading-none">×</button>}
      </div>
      <p className="text-xs text-gray-500">Entrada: <span className="font-mono text-gray-300">{trade.entry_price}</span></p>
      <div>
        <label className={labelCls}>Precio de salida</label>
        <input type="number" step="any" required autoFocus value={exitPrice} onChange={e => setExitPrice(e.target.value)} className={inputCls} />
      </div>
      <textarea placeholder="Notas de cierre" value={notes} onChange={e => setNotes(e.target.value)} className={`${inputCls} h-20 resize-none`} />
      <button type="submit" className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white">Cerrar operación</button>
    </form>
  );
}
