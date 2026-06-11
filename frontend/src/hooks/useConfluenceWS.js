import { useState, useEffect, useRef } from 'react';

// Reutiliza la misma derivación de URL que useScanner.js (el proyecto no usa VITE_WS_URL).
const WS_URL = import.meta.env.DEV
  ? 'ws://localhost:3001'
  : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;

/**
 * Suscribe al canal de confluencia multi-timeframe para un par.
 * Abre una conexión WS dedicada mientras `enabled` sea true; al desmontar o
 * desactivar envía confluence_unsubscribe y cierra el socket.
 *
 * @param {string} symbol - Par a observar (ej. 'BTC/USDT')
 * @param {boolean} enabled - Si está conectado/suscrito
 * @returns {{ data, connected, lastUpdated, error }}
 */
export function useConfluenceWS(symbol, enabled) {
  const [data, setData] = useState(null);
  const [connected, setConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);

  const wsRef = useRef(null);

  useEffect(() => {
    if (!enabled || !symbol) {
      setConnected(false);
      return undefined;
    }

    let closed = false;
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      if (closed) { ws.close(); return; }
      setConnected(true);
      setError(null);
      ws.send(JSON.stringify({ type: 'confluence_subscribe', symbol }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'confluence_update' && msg.symbol === symbol) {
          setData(msg);
          setLastUpdated(new Date());
          setError(null);
        } else if (msg.type === 'confluence_error') {
          setError(msg.error);
        }
      } catch {
        /* ignora mensajes mal formados */
      }
    };

    ws.onclose = () => { if (!closed) setConnected(false); };
    ws.onerror = () => { ws.close(); };

    return () => {
      closed = true;
      try {
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({ type: 'confluence_unsubscribe' }));
        }
      } catch {
        /* socket ya cerrado */
      }
      ws.close();
      setConnected(false);
    };
  }, [symbol, enabled]);

  return { data, connected, lastUpdated, error };
}
