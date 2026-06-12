import { useState, useEffect, useRef, useCallback } from 'react';

const API_BASE = import.meta.env.DEV ? 'http://localhost:3001' : '';
const WS_URL = import.meta.env.DEV
  ? 'ws://localhost:3001'
  : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;

async function fetchSession() {
  try {
    const r = await fetch(`${API_BASE}/api/sessions/current`);
    const j = await r.json();
    if (j.is_high_liquidity) return 'london_ny_overlap';
    if (j.active_sessions?.length) return j.active_sessions.join('_');
    return 'off_session';
  } catch {
    return 'unknown';
  }
}

/**
 * Maneja el briefing IA de contexto de mercado.
 * @param {{ pairs: string[], timeframe: string }} params
 */
export function useMarketContext({ pairs, timeframe }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [groqAvailable, setGroqAvailable] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [stale, setStale] = useState(false);
  const [sessionChanged, setSessionChanged] = useState(false);

  const runningRef = useRef(false);
  const pairsRef = useRef(pairs);
  const tfRef = useRef(timeframe);
  pairsRef.current = pairs;
  tfRef.current = timeframe;

  const runAnalyze = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setIsStreaming(true);
    setError(null);
    setStreamingText('');

    try {
      const session = await fetchSession();
      const resp = await fetch(`${API_BASE}/api/market-context/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pairs: pairsRef.current?.length ? pairsRef.current : ['BTC/USDT'],
          timeframe: tfRef.current || 'M5',
          session
        })
      });

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
          const frame = buf.slice(0, idx).trim();
          buf = buf.slice(idx + 2);
          if (!frame.startsWith('data:')) continue;

          let msg;
          try { msg = JSON.parse(frame.slice(5).trim()); } catch { continue; }

          if (msg.type === 'chunk') {
            setStreamingText(prev => prev + msg.content);
          } else if (msg.type === 'done') {
            setAnalysis(msg.analysis);
            setStale(false);
            setSessionChanged(false);
          } else if (msg.type === 'error') {
            setError(msg);
            if (msg.error === 'groq_unavailable') setGroqAvailable(false);
          }
        }
      }
    } catch (err) {
      setError({ error: 'groq_unavailable', message: err.message });
      setGroqAvailable(false);
    } finally {
      setIsStreaming(false);
      setLoading(false);
      runningRef.current = false;
    }
  }, []);

  // Carga inicial: estado de Groq + último análisis
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const st = await fetch(`${API_BASE}/api/market-context/status`).then(r => r.json());
        if (!cancelled) setGroqAvailable(!!st.available);
      } catch {
        if (!cancelled) setGroqAvailable(false);
      }

      try {
        const j = await fetch(`${API_BASE}/api/market-context/latest`).then(r => r.json());
        if (cancelled) return;
        if (j.analysis) {
          setAnalysis(j.analysis);
          setStale(!!j.stale);
          setLoading(false);
        } else {
          // No hay ningún análisis guardado → generar uno (si Groq está disponible)
          setLoading(false);
          runAnalyze();
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [runAnalyze]);

  // Aviso de cambio de sesión (no auto-actualiza, para no gastar tokens)
  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    ws.onmessage = (e) => {
      try {
        const m = JSON.parse(e.data);
        if (m.type === 'session_change') setSessionChanged(true);
      } catch { /* ignora */ }
    };
    ws.onerror = () => ws.close();
    return () => ws.close();
  }, []);

  const refresh = useCallback(() => runAnalyze(), [runAnalyze]);
  const dismissSessionChange = useCallback(() => setSessionChanged(false), []);

  return {
    analysis, loading, error, groqAvailable, isStreaming, streamingText,
    stale, sessionChanged, refresh, dismissSessionChange
  };
}
