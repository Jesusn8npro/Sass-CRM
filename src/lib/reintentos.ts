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
 * Errores que SÍ vale la pena reintentar (transitorios).
 * Los 4xx (excepto 429) no se reintentan — son errores de programación
 * o validación que no se arreglan esperando.
 */
function esTransitorio(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("ECONNRESET") ||
    msg.includes("ETIMEDOUT") ||
    msg.includes("ENOTFOUND") ||
    msg.includes("Connection Closed") ||
    msg.includes("socket hang up") ||
    msg.includes("fetch failed") ||
    msg.includes("Timed Out") ||
    msg.includes("timeout") ||
    msg.includes(" 429") ||
    msg.includes(" 500") ||
    msg.includes(" 502") ||
    msg.includes(" 503") ||
    msg.includes(" 504")
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
