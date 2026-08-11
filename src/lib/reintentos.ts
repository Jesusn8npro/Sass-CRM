/**
 * Helper genérico de reintentos con backoff exponencial + jitter para
 * llamadas a APIs externas (OpenAI, ElevenLabs, Whisper, Vapi, Gemini).
 *
 * Antes de esto, un 5xx transitorio o un timeout de OpenAI hacía que
 * el cliente NUNCA recibiera respuesta del bot. Acá reintentamos
 * silenciosamente y solo escalamos si fallan todos los intentos.
 */

interface OpcionesReintento {
  /** Máximo de intentos totales (incluyendo el primero). Default 3. */
  maxIntentos?: number;
  /** Backoff base en ms (se duplica cada intento + jitter). Default 600ms. */
  baseMs?: number;
  /** Tag para logs. */
  contexto?: string;
}

/**
 * 429 que NO se arreglan esperando: la cuenta del proveedor está sin
 * billing, sin cuota o desactivada. Reintentarlos es tiempo tirado —
 * con backoff exponencial son ~3.4s por llamada, y como el agente
 * encadena hasta 5 llamadas por mensaje, el cliente esperaba casi 20
 * segundos de más antes de que entrara el respaldo.
 */
function es429Permanente(msg: string): boolean {
  return (
    /billing_not_active|insufficient_quota|account_deactivated/i.test(msg) ||
    /account is not active/i.test(msg) ||
    /exceeded your current quota/i.test(msg) ||
    /check your billing details/i.test(msg)
  );
}

/**
 * Errores que SÍ vale la pena reintentar (transitorios).
 * Los 4xx (excepto 429) no se reintentan — son errores de programación
 * o validación que no se arreglan esperando.
 */
function esTransitorio(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  // Un 429 por rate limit se reintenta; uno por cuenta caída, no.
  if (es429Permanente(msg)) return false;
  return (
    msg.includes("ECONNRESET") ||
    msg.includes("ETIMEDOUT") ||
    msg.includes("ENOTFOUND") ||
    msg.includes("Connection Closed") ||
    msg.includes("socket hang up") ||
    msg.includes("fetch failed") ||
    msg.includes("Timed Out") ||
    msg.includes("timeout") ||
    // Los SDK arrancan el mensaje con el código ("429 Rate limit…"), así que
    // buscar " 429" con espacio delante no casaba nunca y NINGÚN 5xx se
    // reintentaba. \b cubre el código esté al principio o en medio.
    /\b(429|500|502|503|504)\b/.test(msg)
  );
}

export async function conReintentos<T>(
  fn: () => Promise<T>,
  opciones: OpcionesReintento = {},
): Promise<T> {
  const max = opciones.maxIntentos ?? 3;
  const base = opciones.baseMs ?? 600;
  const tag = opciones.contexto ?? "fn";

  let ultimoError: unknown;
  for (let intento = 1; intento <= max; intento++) {
    try {
      return await fn();
    } catch (err) {
      ultimoError = err;
      if (intento === max || !esTransitorio(err)) {
        throw err;
      }
      // Backoff exponencial con jitter ±25%
      const delay = base * Math.pow(2, intento - 1);
      const jitter = delay * 0.25 * (Math.random() * 2 - 1);
      const espera = Math.max(50, Math.floor(delay + jitter));
      const detalle = err instanceof Error ? err.message.slice(0, 100) : String(err).slice(0, 100);
      console.warn(
        `[reintentos:${tag}] intento ${intento}/${max} falló (${detalle}) — reintentando en ${espera}ms`,
      );
      await new Promise((r) => setTimeout(r, espera));
    }
  }
  throw ultimoError;
}
