# Scanner de Señales — Trading en tiempo real

Plataforma web de scanner de señales para scalping. Detecta setups automáticamente en cripto (Binance), forex y futuros, mostrando un score de confluencia 0–100 con actualizaciones vía WebSocket.

## Instalación rápida

```bash
# Desde la raíz del monorepo
npm install            # instala concurrently raíz
npm run install:all    # instala dependencias de backend y frontend
```

## Configuración

```bash
cp backend/.env.example backend/.env
```

Editar `backend/.env`:

| Variable | Descripción | Default |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Token del bot de Telegram | vacío (alertas desactivadas) |
| `TELEGRAM_CHAT_ID` | Chat ID destino de alertas | vacío |
| `BINANCE_API_KEY` / `BINANCE_SECRET` | Claves Binance (opcionales, datos públicos no las requieren) | vacío |
| `SCAN_INTERVAL_MS` | Intervalo de escaneo en ms | `10000` |
| `MIN_SCORE_ALERT` | Score mínimo para alerta Telegram | `80` |
| `MIN_SCORE_PUBLISH` | Score mínimo para publicar señal | `50` |
| `DEFAULT_TIMEFRAME` | Timeframe por defecto (`M1`, `M5`, `M15`) | `M5` |
| `PORT` | Puerto HTTP/WS del backend | `3001` |

## Arrancar en desarrollo

```bash
npm run dev
```

Levanta backend (`http://localhost:3001`) y frontend (`http://localhost:5173`) en paralelo.

## Arquitectura

```
backend/
  src/
    index.js        — Express + WebSocket server
    scanner.js      — Motor de escaneo (corre cada SCAN_INTERVAL_MS)
    indicators.js   — RSI, EMA, MACD, Volumen relativo
    scoring.js      — Score de confluencia 0-100
    alerts.js       — Alertas Telegram con cooldown de 5 min
    db.js           — SQLite: historial de señales
    feeds/
      crypto.js     — Datos OHLCV vía ccxt (Binance)
      forex.js      — Datos mock; preparado para OANDA/Tradovate

frontend/
  src/
    hooks/
      useScanner.js   — WebSocket con reconexión exponencial
    components/
      SignalTable.jsx — Tabla de señales ordenada por score
      SignalRow.jsx   — Fila individual con barra de score
      FilterBar.jsx   — Filtros: mercado, timeframe, dirección, score mínimo
      MetricCards.jsx — Contadores reactivos
      AlertBadge.jsx  — Badge "Alta confluencia" para score >= 80
```

## API REST

| Endpoint | Descripción |
|---|---|
| `GET /api/signals/history?limit=50` | Historial de señales guardadas en SQLite |
| `GET /api/health` | Estado del servidor y número de clientes WS |

## Agregar nuevos pares

Editar `backend/src/scanner.js`, sección `PAIRS`:

```js
export const PAIRS = {
  crypto:  ['BTC/USDT', 'ETH/USDT', /* ... nuevo par */],
  forex:   ['EUR/USD', /* ... */],
  futures: ['NQ1!',   /* ... */]
};
```

## Agregar nuevos indicadores

1. Implementar la función en `backend/src/indicators.js` siguiendo la firma:
   `{ signal: 'bullish'|'bearish'|'neutral', value: any, active: boolean }`
2. Agregarla al objeto retornado en `calculateIndicators()`.
3. Asignarle peso en el objeto `WEIGHTS` de `scoring.js` y actualizar la lógica de `calcScore()`.

## Conectar datos reales de Forex/Futuros

Reemplazar las funciones en `backend/src/feeds/forex.js`:
- **OANDA:** usar la REST API `https://api-fxtrade.oanda.com/v3/instruments/{pair}/candles`
- **Tradovate:** usar su API WebSocket de cotizaciones en tiempo real
