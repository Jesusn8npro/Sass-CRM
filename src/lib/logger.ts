import pino from "pino";

/**
 * Logger único del bot. JSON estructurado siempre — parseable por
 * Datadog/Logtail/Axiom. Reemplazo gradual de console.log.
 *
 * En dev también queda en JSON; si querés output legible localmente,
 * pipeá la salida del proceso con `npm run dev | npx pino-pretty` (no
 * agregamos pino-pretty como dependencia para no inflar el bundle).
 *
 * Uso:
 *   import { log } from "@/lib/logger";
 *   log.info({ idCuenta }, "bot conectado");
 *   log.error({ err, idCuenta }, "fallo al enviar");
 */
export const log = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug"),
  base: { app: "agente-whatsapp" },
  redact: {
    paths: [
      "*.api_key",
      "*.password",
      "*.secret",
      "*.token",
      "*.access_token",
      "headers.authorization",
      "headers.cookie",
    ],
    censor: "[REDACTED]",
  },
});
