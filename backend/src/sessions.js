/**
 * Lógica pura de sesiones de mercado (horarios en UTC).
 * Usada por routes/sessions.js (API + WS) y por scanner.js (is_high_liquidity).
 */

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

// Maneja sesiones que cruzan medianoche (ej. Sydney 21→6)
function sessionOpen(s, m) {
  const o = s.open * 60;
  const c = s.close * 60;
  return o < c ? (m >= o && m < c) : (m >= o || m < c);
}

export function getActiveSessions(date = new Date()) {
  const m = minutesUtc(date);
  return Object.entries(SESSIONS)
    .filter(([, s]) => sessionOpen(s, m))
    .map(([key]) => key);
}

export function getActiveOverlaps(date = new Date()) {
  const m = minutesUtc(date);
  return OVERLAPS
    .filter(o => m >= o.start * 60 && m < o.end * 60)
    .map(o => ({
      label: o.label,
      importance: o.importance,
      ends_in_minutes: o.end * 60 - m
    }));
}

/** True si el overlap London/NY (alta liquidez) está activo. */
export function isHighLiquidity(date = new Date()) {
  const m = minutesUtc(date);
  const ln = OVERLAPS[1];
  return m >= ln.start * 60 && m < ln.end * 60;
}

export function getCurrentState(date = new Date()) {
  return {
    timestamp: date.getTime(),
    utc_hour: date.getUTCHours(),
    active_sessions: getActiveSessions(date),
    active_overlaps: getActiveOverlaps(date),
    is_high_liquidity: isHighLiquidity(date)
  };
}
