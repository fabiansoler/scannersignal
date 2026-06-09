import 'dotenv/config';
import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import { startScanner, getAllSignals, onSignalChange } from './scanner.js';
import { getSignalsHistory } from './db.js';

const PORT = Number(process.env.PORT ?? 3001);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());

// CORS simple para desarrollo
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// REST: historial de señales
app.get('/api/signals/history', (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 50), 500);
  try {
    const history = getSignalsHistory(limit);
    res.json({ data: history, total: history.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', clients: wss.clients.size });
});

// WebSocket
const clients = new Set();

function broadcast(payload) {
  const msg = JSON.stringify(payload);
  for (const ws of clients) {
    if (ws.readyState === 1 /* OPEN */) {
      ws.send(msg);
    }
  }
}

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`[ws] Cliente conectado. Total: ${clients.size}`);

  // Enviar estado actual al cliente recién conectado
  const current = getAllSignals();
  if (current.length) {
    ws.send(JSON.stringify({
      type: 'signals_update',
      timestamp: Date.now(),
      data: current
    }));
  }

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`[ws] Cliente desconectado. Total: ${clients.size}`);
  });

  ws.on('error', (err) => {
    console.error('[ws] Error de cliente:', err.message);
    clients.delete(ws);
  });
});

// Escuchar cambios del scanner y pushear a clientes
onSignalChange((signals) => {
  broadcast({
    type: 'signals_update',
    timestamp: Date.now(),
    data: signals
  });
});

server.listen(PORT, () => {
  console.log(`[server] HTTP + WS escuchando en puerto ${PORT}`);
  startScanner();
});
