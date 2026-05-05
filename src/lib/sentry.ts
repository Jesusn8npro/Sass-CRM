/**
 * Wrapper único de Sentry. Si `SENTRY_DSN` no está configurado, las
 * funciones son no-op (silenciosas). Esto permite dev local sin Sentry
 * y producción sin secretos hardcodeados.
 *
 * Uso:
 *   import { capturarError } from "@/lib/sentry";
 *   try { ... } catch (err) { capturarError(err, { idCuenta }); throw err; }
 */
import * as Sentry from "@sentry/nextjs";

let inicializado = false;

function inicializarSiHaceFalta() {
  if (inicializado) return;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
    enabled: true,
  });
  inicializado = true;
}

/**
 * Captura una excepción con tags opcionales. Best-effort: si Sentry
 * falla por algún motivo, no rompe el flujo del caller.
 */
export function capturarError(
  err: unknown,
  tags?: Record<string, string | undefined>,
): void {
  if (!process.env.SENTRY_DSN) return;
  try {
    inicializarSiHaceFalta();
    Sentry.withScope((scope) => {
      if (tags) {
        for (const [k, v] of Object.entries(tags)) {
          if (v) scope.setTag(k, v);
        }
      }
      Sentry.captureException(err);
    });
  } catch {
    // ignorar — no queremos que Sentry rompa nada
  }
}

/**
 * Mensaje de info/warning (no es excepción).
 */
export function capturarMensaje(
  msg: string,
  nivel: "info" | "warning" | "error" = "info",
  tags?: Record<string, string>,
): void {
  if (!process.env.SENTRY_DSN) return;
  try {
    inicializarSiHaceFalta();
    Sentry.withScope((scope) => {
      if (tags) {
        for (const [k, v] of Object.entries(tags)) scope.setTag(k, v);
      }
      Sentry.captureMessage(msg, nivel);
    });
  } catch {
    /* ignorar */
  }
}
