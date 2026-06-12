import Groq from 'groq-sdk';

const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const TIMEOUT_MS = Number(process.env.GROQ_TIMEOUT_MS ?? 30000);

let client;

/** Error tipado: el router lo traduce a { error: 'groq_unavailable' }. */
class GroqUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.code = 'groq_unavailable';
  }
}

function getClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new GroqUnavailableError('GROQ_API_KEY not configured');
  if (!client) client = new Groq({ apiKey, timeout: TIMEOUT_MS });
  return client;
}

function buildPrompt({ session, timeframe, pairs, utc_time, signals_summary }) {
  return `Sos un analista de trading profesional especializado en scalping intradía.
Analizá el contexto de mercado actual y generá un briefing para la sesión de trading.

DATOS ACTUALES:
- Sesión activa: ${session}
- Timeframe de trabajo: ${timeframe}
- Pares a operar: ${pairs.join(', ')}
- Hora UTC actual: ${utc_time}
- Señales generadas en las últimas 4 horas: ${signals_summary}

INSTRUCCIONES:
1. Determiná el bias general del mercado (BULLISH / BEARISH / LATERAL) con un nivel de confianza del 0 al 100
2. Identificá los niveles de soporte y resistencia más relevantes para cada par
3. Mencioná eventos económicos clave del día si los conocés (NFP, CPI, reuniones de bancos centrales, etc.)
4. Dá 3 consejos específicos para scalping en las condiciones actuales
5. Escribí todo en español, de forma concisa y orientada a la acción

Respondé ÚNICAMENTE con un JSON válido con esta estructura exacta (sin texto adicional, sin markdown):
{
  "bias": { "overall": "BULLISH|BEARISH|LATERAL", "confidence": 0-100, "reasoning": "texto corto" },
  "key_levels": [ { "pair": "BTC/USDT", "type": "resistance|support", "price": 0, "strength": "strong|medium|weak" } ],
  "context_summary": "párrafo de 3-4 oraciones",
  "key_events": [ { "time": "14:30 UTC", "event": "CPI USA", "impact": "high|medium|low", "direction_bias": "texto" } ],
  "scalping_tips": [ "tip 1", "tip 2", "tip 3" ]
}`;
}

/**
 * Llama a Groq con streaming. Invoca onChunk(text) por cada fragmento.
 * @returns {Promise<{ analysis: object|null, raw: string }>}
 *   analysis = JSON parseado, o null si vino malformado (raw queda con el texto crudo)
 */
export async function analyzeMarketContext(payload, onChunk) {
  const groq = getClient();
  let raw = '';

  try {
    const stream = await groq.chat.completions.create({
      model: MODEL,
      stream: true,
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: buildPrompt(payload) }]
    });

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content ?? '';
      if (delta) {
        raw += delta;
        if (onChunk) onChunk(delta);
      }
    }
  } catch (err) {
    // timeout, api key inválida, rate limit, red caída → todos a groq_unavailable
    throw new GroqUnavailableError(err?.message || 'Fallo al llamar a Groq');
  }

  let analysis = null;
  try {
    analysis = JSON.parse(raw);
  } catch {
    analysis = null; // JSON malformado: el caller decide qué hacer con `raw`
  }

  return { analysis, raw };
}

/**
 * Streaming genérico de un prompt que debe devolver JSON. Reutilizable por
 * cualquier módulo (journal, etc.). Invoca onChunk(text) por fragmento.
 * @returns {Promise<{ analysis: object|null, raw: string }>}
 */
export async function streamJSONCompletion(prompt, onChunk) {
  const groq = getClient();
  let raw = '';

  try {
    const stream = await groq.chat.completions.create({
      model: MODEL,
      stream: true,
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }]
    });

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content ?? '';
      if (delta) {
        raw += delta;
        if (onChunk) onChunk(delta);
      }
    }
  } catch (err) {
    throw new GroqUnavailableError(err?.message || 'Fallo al llamar a Groq');
  }

  let analysis = null;
  try { analysis = JSON.parse(raw); } catch { analysis = null; }
  return { analysis, raw };
}

/** Verifica disponibilidad de Groq con un ping mínimo. */
export async function checkGroqStatus() {
  if (!process.env.GROQ_API_KEY) {
    return { available: false, reason: 'GROQ_API_KEY not configured' };
  }
  try {
    const groq = getClient();
    const t0 = Date.now();
    await groq.chat.completions.create({
      model: MODEL,
      max_tokens: 1,
      messages: [{ role: 'user', content: 'ping' }]
    });
    return { available: true, model: MODEL, latency_ms: Date.now() - t0 };
  } catch (err) {
    return { available: false, reason: err?.message || 'Fallo al conectar con Groq' };
  }
}

export { MODEL as GROQ_MODEL };
