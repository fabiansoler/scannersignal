import { useState, useEffect, useMemo } from 'react';

const API_BASE = import.meta.env.DEV ? 'http://localhost:3001' : '';

// Horarios en UTC (espejo de backend/src/sessions.js)
export const SESSIONS = {
  sydney:  { open: 21, close: 6,  label: 'Sydney',   color: '#5DCAA5' },
  tokyo:   { open: 0,  close: 9,  label: 'Tokyo',    color: '#378ADD' },
  london:  { open: 7,  close: 16, label: 'London',   color: '#7F77DD' },
  newYork: { open: 12, close: 21, label: 'New York', color: '#EF9F27' },
};

export const OVERLAPS = [
  { label: 'Tokyo / London', start: 7,  end: 9,  importance: 'medium' },
  { label: 'London / NY',    start: 12, end: 16, importance: 'high' },
];

function minutesUtc(date) {
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}
function sessionOpen(s, m) {
  const o = s.open * 60, c = s.close * 60;
  return o < c ? (m >= o && m < c) : (m >= o || m < c);
}
function nextUtcHour(now, h) {
  const t = new Date(now);
  t.setUTCHours(h, 0, 0, 0);
  if (t.getTime() <= now.getTime()) t.setUTCDate(t.getUTCDate() + 1);
  return t;
}

/** Convierte una hora UTC entera a "HH:MM" en la timezone local del browser. */
export function utcHourToLocal(h) {
  const d = new Date();
  d.setUTCHours(h, 0, 0, 0);
  return new Intl.DateTimeFormat([], { hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
}
/** Hora local (0–23) correspondiente a una hora UTC entera. */
export function utcHourToLocalHour(h) {
  const d = new Date();
  d.setUTCHours(h, 0, 0, 0);
  return d.getHours();
}

function formatCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(total / 3600)).padStart(2, '0');
  const mm = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function computeNextEvent(now) {
  const m = minutesUtc(now);
  const lnActive = m >= 12 * 60 && m < 16 * 60;
  const anySession = Object.values(SESSIONS).some(s => sessionOpen(s, m));

  if (lnActive) return { label: 'Overlap London/NY termina en', target: nextUtcHour(now, 16) };
  if (!anySession) return { label: 'Londres abre en', target: nextUtcHour(now, 7) };
  return { label: 'Próximo overlap London/NY en', target: nextUtcHour(now, 12) };
}

export function useSessionMonitor() {
  const [now, setNow] = useState(() => new Date());
  const [volatilityData, setVolatilityData] = useState(null);

  // Reloj de 1s — dirige sesiones activas y countdown
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Fetch de volatilidad (una vez); ante fallo, queda null y la UI usa su fallback
  useEffect(() => {
    fetch(`${API_BASE}/api/sessions/volatility`)
      .then(r => r.json())
      .then(j => setVolatilityData(j))
      .catch(() => setVolatilityData(null));
  }, []);

  return useMemo(() => {
    const m = minutesUtc(now);

    const activeSessions = Object.entries(SESSIONS)
      .filter(([, s]) => sessionOpen(s, m))
      .map(([key]) => key);

    const overlaps = OVERLAPS
      .filter(o => m >= o.start * 60 && m < o.end * 60)
      .map(o => ({ ...o, ends_in_minutes: o.end * 60 - m }));

    const isHighLiquidity = overlaps.some(o => o.label === 'London / NY');

    const nextEvent = computeNextEvent(now);
    const countdown = formatCountdown(nextEvent.target.getTime() - now.getTime());

    return { activeSessions, overlaps, nextEvent, countdown, volatilityData, isHighLiquidity };
  }, [now, volatilityData]);
}
