/**
 * Circuit breaker para OpenAI.
 *
 * Cuando la cuenta de OpenAI está caída (billing inactivo, sin cuota), CADA
 * llamada paga el mismo peaje: armar la request, mandarla, esperar el 429 y
 * recién ahí ir al respaldo. Con transcripción + respuesta + los round-trips
 * de consultar_datos son varias llamadas por mensaje, y el cliente siente
 * segundos de demora por un error que ya sabíamos que iba a pasar.
 *
 * Acá recordamos ese fallo por unos minutos: mientras el circuito está
 * abierto, quien llame se saltea OpenAI y va derecho al respaldo. Se cierra
 * solo al vencer la ventana, así que en cuanto arreglen el billing el
 * sistema vuelve a OpenAI sin que nadie toque nada.
 */
import { log } from "./logger";

/** Cuánto ignoramos a OpenAI tras un fallo permanente. */
const MS_APERTURA = 5 * 60_000;

let abiertoHasta = 0;
let motivo = "";

/** true si conviene saltear OpenAI e ir directo al respaldo. */
export function circuitoOpenaiAbierto(): boolean {
  if (abiertoHasta === 0) return false;
  if (Date.now() >= abiertoHasta) {
    // Venció la ventana: dejamos pasar la próxima llamada para tantear si
    // la cuenta ya se recuperó.
    abiertoHasta = 0;
    log.info("[circuito:openai] ventana vencida — se reintenta OpenAI");
    return false;
  }
  return true;
}

/**
 * Marca que OpenAI falló de forma permanente. Solo abre el circuito para
 * errores de cuenta: un 500 o un timeout son transitorios y no deben
 * desviar el tráfico.
 */
export function registrarFalloOpenai(err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  const esPermanente =
    /billing_not_active|insufficient_quota|account_deactivated/i.test(msg) ||
    /account is not active/i.test(msg) ||
    /exceeded your current quota/i.test(msg) ||
    /check your billing details/i.test(msg) ||
    /\b401\b/.test(msg);
  if (!esPermanente) return;

  const yaEstaba = circuitoOpenaiAbierto();
  abiertoHasta = Date.now() + MS_APERTURA;
  motivo = msg.slice(0, 120);
  if (!yaEstaba) {
    log.warn(
      { motivo, minutos: MS_APERTURA / 60_000 },
      "[circuito:openai] abierto — se usa el respaldo sin intentar OpenAI",
    );
  }
}

/** Para diagnóstico desde el panel o los logs. */
export function estadoCircuitoOpenai(): {
  abierto: boolean;
  segundosRestantes: number;
  motivo: string;
} {
  const abierto = circuitoOpenaiAbierto();
  return {
    abierto,
    segundosRestantes: abierto ? Math.ceil((abiertoHasta - Date.now()) / 1000) : 0,
    motivo: abierto ? motivo : "",
  };
}
