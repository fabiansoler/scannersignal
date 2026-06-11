// Feed de datos para Forex y Futuros.
// Pendiente de conectar con proveedor real (OANDA, Tradovate, etc.)

export async function fetchOHLCV(pair) {
  throw new Error(`Forex/Futuros feed no configurado (${pair})`);
}

export async function fetchCurrentPrice(pair) {
  throw new Error(`Forex/Futuros feed no configurado (${pair})`);
}
