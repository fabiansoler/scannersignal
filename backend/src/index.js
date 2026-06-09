import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { WebSocketServer } from 'ws';
import { startScanner, getAllSignals, onSignalChange } from './scanner.js';
import { getSignalsHistory } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3001);
const IS_PROD = process.env.NODE_ENV === 'production';
const DIST = path.join(__dirname, '..', '..', 'frontend', 'dist');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// API routes
app.get('/api/signals/history', (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 50), 500);
  try {
    res.json({ data: getSignalsHistory(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', clients: wss.clients.size, env: IS_PROD ? 'production' : 'development' });
});

// Servir frontend en producción (Railway: un solo servicio)
if (IS_PROD && existsSync(DIST)) {
  app.use(express.static(DIST));
  // SPA fallback: todas las rutas no-API devuelven index.html
  app.get('*', (req, res) => {
    res.sendFile(path.join(DIST, 'index.html'));
  });
}

// WebSocket
const clients = new Set();

function broadcast(payload) {
  const msg = JSON.stringify(payload);
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`[ws] Cliente conectado. Total: ${clients.size}`);

  const current = getAllSignals();
  if (current.length) {
    ws.send(JSON.stringify({ type: 'signals_update', timestamp: Date.now(), data: current }));
  }

  ws.on('close', () => { clients.delete(ws); console.log(`[ws] Desconectado. Total: ${clients.size}`); });
  ws.on('error', (err) => { console.error('[ws] Error:', err.message); clients.delete(ws); });
});

onSignalChange((signals) => {
  broadcast({ type: 'signals_update', timestamp: Date.now(), data: signals });
});

server.listen(PORT, () => {
  console.log(`[server] Puerto ${PORT} | env=${IS_PROD ? 'production' : 'development'}`);
  startScanner();
});
