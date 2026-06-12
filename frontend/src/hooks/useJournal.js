import { useState, useEffect, useCallback, useRef } from 'react';

const API_BASE = import.meta.env.DEV ? 'http://localhost:3001' : '';
const PAGE_SIZE = 20;

export const EXPORT_URL = `${API_BASE}/api/journal/trades/export`;

export function useJournal() {
  const [trades, setTrades] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [filters, setFilters] = useState({ pair: '', result: '', dateFrom: '', dateTo: '' });
  const [page, setPage] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [groqAvailable, setGroqAvailable] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');

  const runningRef = useRef(false);

  const fetchTrades = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ limit: PAGE_SIZE, offset: page * PAGE_SIZE });
      if (filters.pair) qs.set('pair', filters.pair);
      if (filters.result) qs.set('result', filters.result);
      if (filters.dateFrom) qs.set('dateFrom', new Date(filters.dateFrom).getTime());
      if (filters.dateTo) qs.set('dateTo', new Date(filters.dateTo).getTime() + 86400000);
      const j = await fetch(`${API_BASE}/api/journal/trades?${qs}`).then(r => r.json());
      setTrades(j.rows ?? []);
      setTotal(j.total ?? 0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  const fetchStats = useCallback(async () => {
    try {
      setStats(await fetch(`${API_BASE}/api/journal/stats`).then(r => r.json()));
    } catch { /* stats opcional */ }
  }, []);

  useEffect(() => { fetchTrades(); }, [fetchTrades]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Estado de Groq + último análisis guardado
  useEffect(() => {
    fetch(`${API_BASE}/api/journal/ai-status`).then(r => r.json())
      .then(s => setGroqAvailable(!!s.available)).catch(() => setGroqAvailable(false));
    fetch(`${API_BASE}/api/journal/analysis/latest`).then(r => r.json())
      .then(j => { if (j.analysis) setAnalysis(j.analysis); }).catch(() => {});
  }, []);

  const refresh = useCallback(() => { fetchTrades(); fetchStats(); }, [fetchTrades, fetchStats]);

  const addTrade = useCallback(async (data) => {
    const r = await fetch(`${API_BASE}/api/journal/trades`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Error al guardar');
    refresh();
    return j.trade;
  }, [refresh]);

  const closeTrade = useCallback(async (id, exitData) => {
    const r = await fetch(`${API_BASE}/api/journal/trades/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(exitData)
    });
    const j = await r.json();
    refresh();
    return j;
  }, [refresh]);

  const deleteTrade = useCallback(async (id) => {
    await fetch(`${API_BASE}/api/journal/trades/${id}`, { method: 'DELETE' });
    refresh();
  }, [refresh]);

  const generateAnalysis = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setIsStreaming(true);
    setError(null);
    setStreamingText('');
    try {
      const resp = await fetch(`${API_BASE}/api/journal/analyze`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`);
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf('\n\n')) >= 0) {
          const frame = buf.slice(0, idx).trim(); buf = buf.slice(idx + 2);
          if (!frame.startsWith('data:')) continue;
          let msg; try { msg = JSON.parse(frame.slice(5).trim()); } catch { continue; }
          if (msg.type === 'chunk') setStreamingText(p => p + msg.content);
          else if (msg.type === 'done') setAnalysis(msg.analysis);
          else if (msg.type === 'error') {
            setError(msg);
            if (msg.error === 'groq_unavailable') setGroqAvailable(false);
          }
        }
      }
    } catch (e) {
      setError({ error: 'groq_unavailable', message: e.message });
      setGroqAvailable(false);
    } finally {
      setIsStreaming(false);
      runningRef.current = false;
    }
  }, []);

  const generateTradeFeedback = useCallback(async (tradeId) => {
    const r = await fetch(`${API_BASE}/api/journal/trades/${tradeId}/feedback`, { method: 'POST' });
    const j = await r.json();
    refresh();
    return j;
  }, [refresh]);

  return {
    trades, total, stats, analysis, filters, page, loading, error, groqAvailable, isStreaming, streamingText,
    pageSize: PAGE_SIZE,
    setFilters: (f) => { setPage(0); setFilters(f); },
    setPage,
    addTrade, closeTrade, deleteTrade, generateAnalysis, generateTradeFeedback, refresh
  };
}
