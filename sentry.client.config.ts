/**
 * Inicialización de Sentry en el navegador.
 * Si SENTRY_DSN no está configurado, no inicializa nada (no-op silencioso).
 *
 * Next.js 15/16 detecta este archivo automáticamente cuando @sentry/nextjs
 * está instalado y lo carga al arranque del bundle del cliente.
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
    replaysOnErrorSampleRate: 0,
    replaysSessionSampleRate: 0,
    enabled: true,
  });
}
