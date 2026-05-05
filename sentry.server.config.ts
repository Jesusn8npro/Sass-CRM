/**
 * Inicialización de Sentry en el server (Node runtime).
 * Si SENTRY_DSN no está, no inicializa nada (no-op silencioso).
 *
 * Captura automáticamente:
 *  - errores no manejados en route handlers
 *  - rejections de promesas en background jobs
 *  - excepciones en server components
 *
 * Los `capturarError(...)` explícitos del wrapper en src/lib/sentry.ts
 * siguen funcionando en paralelo y agregan tags custom.
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
    enabled: true,
    // Filtrar errores ruidosos del bot Baileys (reconexiones normales)
    // que NO son bugs reales — son conflictos de instancia esperables.
    beforeSend(event, hint) {
      const err = hint.originalException;
      const msg = err instanceof Error ? err.message : String(err ?? "");
      if (
        msg.includes("Connection Closed") ||
        msg.includes("Timed Out") ||
        msg.includes("Precondition Required") ||
        msg.includes("connectionReplaced") ||
        msg.includes("code=440")
      ) {
        return null;
      }
      return event;
    },
  });
}
