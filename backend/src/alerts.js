/**
 * Módulo de alertas: Telegram + logs de consola.
 * Respeta un cooldown de 5 minutos por par para evitar spam.
 */

import TelegramBot from 'node-telegram-bot-api';

let bot;
// cooldown: Map<pair, lastAlertTimestamp>
const cooldowns = new Map();
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutos

function getBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  if (!bot) {
    bot = new TelegramBot(token, { polling: false });
  }
  return bot;
}

function formatMessage(signal) {
  const dirEmoji = signal.direction === 'LONG' ? '🟢' : signal.direction === 'SHORT' ? '🔴' : '⚪';
  const price = signal.price != null ? signal.price.toLocaleString('en-US', { maximumFractionDigits: 6 }) : 'N/A';
  return (
    `${dirEmoji} *${signal.pair}* — ${signal.direction}\n` +
    `📊 Score: *${signal.score}/100*\n` +
    `📐 Setup: ${signal.setup}\n` +
    `💰 Precio: ${price}\n` +
    `⏱ Timeframe: ${signal.timeframe}`
  );
}

/**
 * Envía alerta a Telegram si el score supera el umbral y no está en cooldown.
 */
export async function sendAlert(signal) {
  const minScore = Number(process.env.MIN_SCORE_ALERT ?? 80);
  if (signal.score < minScore) return;

  const now = Date.now();
  const lastAlert = cooldowns.get(signal.pair) ?? 0;
  if (now - lastAlert < COOLDOWN_MS) {
    console.log(`[alerts] Cooldown activo para ${signal.pair}, omitiendo alerta`);
    return;
  }

  cooldowns.set(signal.pair, now);
  console.log(`[alerts] ⚡ Nueva señal: ${signal.pair} ${signal.direction} score=${signal.score}`);

  const tgBot = getBot();
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!tgBot || !chatId) return;

  try {
    await tgBot.sendMessage(chatId, formatMessage(signal), { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('[alerts] Error enviando a Telegram:', err.message);
  }
}
