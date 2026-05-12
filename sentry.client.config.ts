/**
 * Inicialización de Sentry en el navegador — lazy.
 *
 * Cambio vs versión anterior: el import del SDK ahora es dinámico
 * dentro de un microtask. Así, si no hay DSN configurado, el SDK
 * de @sentry/nextjs (~50KB gzipped) NO entra al bundle inicial del
 * cliente — Next/Turbopack lo code-splittea automáticamente.
 *
 * Cuando SÍ hay DSN, lo cargamos después del first paint (no
 * bloquea LCP).
 *
 * Si `NEXT_PUBLIC_SENTRY_DSN`/`SENTRY_DSN` no está, esto es no-op
 * total — el bundle no incluye Sentry.
 */

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN;

if (dsn && typeof window !== "undefined") {
  // requestIdleCallback con fallback a setTimeout: arranca Sentry
  // cuando el browser tiene tiempo libre, sin pelear con el render
  // de la página crítica.
  const cargar = () =>
    import("@sentry/nextjs").then((Sentry) => {
      Sentry.init({
        dsn,
        environment: process.env.NODE_ENV ?? "development",
        tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
        replaysOnErrorSampleRate: 0,
        replaysSessionSampleRate: 0,
        enabled: true,
      });
    });
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(() => void cargar());
  } else {
    setTimeout(() => void cargar(), 1500);
  }
}
