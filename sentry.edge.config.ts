/**
 * Inicialización de Sentry en Edge runtime (middleware).
 * Si SENTRY_DSN no está, no inicializa nada.
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: 0,
    enabled: true,
  });
}
