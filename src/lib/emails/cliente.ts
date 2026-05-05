/**
 * Wrapper minimal sobre Resend para mandar emails transaccionales.
 *
 * Diseño defensivo:
 *  - Si `RESEND_API_KEY` NO está seteada, NO falla — devuelve
 *    `{ ok: false, motivo: "sin_api_key" }` y solo loguea con pino.
 *    Esto permite trabajar local sin tener Resend configurado.
 *  - Cualquier error de red/API se captura y devuelve como
 *    `{ ok: false, motivo: ... }` — el caller decide qué hacer.
 *  - Para fire-and-forget el caller envuelve la llamada en void+catch.
 */

import { Resend } from "resend";
import { log } from "../logger";

const RESEND_API_KEY = process.env.RESEND_API_KEY?.trim() || null;
const RESEND_FROM =
  process.env.RESEND_FROM?.trim() || "Sass-CRM <hola@sass-crm.com>";

let _cliente: Resend | null = null;

function obtenerCliente(): Resend | null {
  if (!RESEND_API_KEY) return null;
  if (!_cliente) _cliente = new Resend(RESEND_API_KEY);
  return _cliente;
}

export type ResultadoEnvio =
  | { ok: true; id: string }
  | { ok: false; motivo: "sin_api_key" | "error_api"; detalle?: string };

export interface OpcionesEmail {
  to: string;
  subject: string;
  html: string;
  /** Opcional: clave de idempotencia para auditar reenvíos (Resend la
   *  guarda como X-Entity-Ref-ID en headers). */
  idempotencyKey?: string;
}

/**
 * Manda un email vía Resend. Nunca tira excepciones — siempre devuelve
 * un resultado explícito.
 */
export async function enviarEmail(
  opciones: OpcionesEmail,
): Promise<ResultadoEnvio> {
  const cliente = obtenerCliente();
  if (!cliente) {
    log.debug(
      { to: opciones.to, subject: opciones.subject },
      "[emails] RESEND_API_KEY no configurada — skip",
    );
    return { ok: false, motivo: "sin_api_key" };
  }

  try {
    const headers: Record<string, string> = {};
    if (opciones.idempotencyKey) {
      headers["X-Entity-Ref-ID"] = opciones.idempotencyKey;
    }
    const { data, error } = await cliente.emails.send({
      from: RESEND_FROM,
      to: opciones.to,
      subject: opciones.subject,
      html: opciones.html,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    });

    if (error) {
      log.warn(
        { to: opciones.to, subject: opciones.subject, error: error.message },
        "[emails] Resend devolvió error",
      );
      return { ok: false, motivo: "error_api", detalle: error.message };
    }

    return { ok: true, id: data?.id ?? "" };
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    log.error(
      { to: opciones.to, subject: opciones.subject, err: detalle },
      "[emails] excepción mandando email",
    );
    return { ok: false, motivo: "error_api", detalle };
  }
}

/** URL base del panel para CTAs. Default localhost en dev. */
export function urlApp(): string {
  return (
    process.env.APP_URL?.trim() ||
    process.env.PUBLIC_URL?.trim() ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}
