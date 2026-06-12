import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { WebSocketServer } from 'ws';
import { startScanner, getAllSignals, onSignalChange } from './scanner.js';
import { calculateConfluence, supportedPairs } from './feeds/confluence.js';
import { getSignalsHistory } from './db.js';
import calculatorRouter from './routes/calculator.js';

const CONFLUENCE_INTERVAL_MS = 10_000;

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

app.use('/api/calculator', calculatorRouter);

app.get('/api/signals/history', (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 50), 500);
  try {
    res.json({ data: getSignalsHistory(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/pairs', (_req, res) => {
  res.json({ data: supportedPairs() });
});

app.get('/api/confluence', async (req, res) => {
  const symbol = req.query.symbol;
  if (!symbol) {
    return res.status(400).json({ error: 'Falta el parámetro ?symbol=' });
  }
  try {
    res.json({ data: await calculateConfluence(symbol) });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    clients: wss.clients.size,
    env: IS_PROD ? 'production' : 'development'
  });
});

if (IS_PROD && existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get('*', (req, res) => {
    res.sendFile(path.join(DIST, 'index.html'));
  });
}

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

  // ── Canal de confluencia multi-timeframe (suscripción por cliente) ──
  ws._confluenceInterval = null;

  const pushConfluence = async (symbol) => {
    try {
      const data = await calculateConfluence(symbol);
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'confluence_update', timestamp: Date.now(), ...data }));
      }
    } catch (err) {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'confluence_error', symbol, error: err.message }));
      }
    }
  };

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'confluence_subscribe' && msg.symbol) {
      clearInterval(ws._confluenceInterval);
      pushConfluence(msg.symbol); // primer envío inmediato
      ws._confluenceInterval = setInterval(() => pushConfluence(msg.symbol), CONFLUENCE_INTERVAL_MS);
    } else if (msg.type === 'confluence_unsubscribe') {
      clearInterval(ws._confluenceInterval);
      ws._confluenceInterval = null;
    }
  });

  ws.on('close', () => {
    clearInterval(ws._confluenceInterval);
    clients.delete(ws);
    console.log(`[ws] Desconectado. Total: ${clients.size}`);
  });
  ws.on('error', (err) => {
    clearInterval(ws._confluenceInterval);
    console.error('[ws] Error:', err.message);
    clients.delete(ws);
  });
});

onSignalChange((signals) => {
  broadcast({ type: 'signals_update', timestamp: Date.now(), data: signals });
});

server.listen(PORT, () => {
  console.log(`[server] Puerto ${PORT} | env=${IS_PROD ? 'production' : 'development'}`);
  startScanner();
});
