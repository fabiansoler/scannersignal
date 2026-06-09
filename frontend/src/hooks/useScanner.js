import { useState, useEffect, useRef, useCallback } from 'react';

// En dev apunta directo al backend; en prod deriva host y protocolo del browser (wss en HTTPS)
const WS_URL = import.meta.env.DEV
  ? 'ws://localhost:3001'
  : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;
const MAX_BACKOFF = 30000;

/**
 * Hook que gestiona la conexión WebSocket al backend del scanner.
 * Reconexión automática con backoff exponencial: 1s, 2s, 4s, … máx 30s.
 */
export function useScanner() {
  const [signals, setSignals] = useState([]);
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  const wsRef = useRef(null);
  const retryRef = useRef(1000);
  const timeoutRef = useRef(null);
  const unmountedRef = useRef(false);

  const mergeSignals = useCallback((incoming) => {
    setSignals(prev => {
      const map = new Map(prev.map(s => [`${s.pair}:${s.timeframe}`, s]));
      for (const s of incoming) {
        map.set(`${s.pair}:${s.timeframe}`, { ...s, _new: true });
      }
      return Array.from(map.values());
    });
    setLastUpdate(new Date());
  }, []);

  const connect = useCallback(() => {
    if (unmountedRef.current) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      if (unmountedRef.current) { ws.close(); return; }
      setConnected(true);
      retryRef.current = 1000; // reset backoff
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'signals_update' && Array.isArray(msg.data)) {
          mergeSignals(msg.data);
        }
      } catch (e) {
        console.error('[useScanner] Parse error:', e);
      }
    };

    ws.onclose = () => {
      if (unmountedRef.current) return;
      setConnected(false);
      const delay = retryRef.current;
      retryRef.current = Math.min(delay * 2, MAX_BACKOFF);
      timeoutRef.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [mergeSignals]);

  useEffect(() => {
    unmountedRef.current = false;
    connect();
    return () => {
      unmountedRef.current = true;
      clearTimeout(timeoutRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { signals, connected, lastUpdate };
}
