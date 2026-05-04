import pino from "pino";

/**
 * Logger único del bot. En dev imprime "pretty"; en prod JSON estructurado
 * (parseable por Datadog/Logtail/Axiom). Reemplazo gradual de console.log.
 *
 * Uso:
 *   import { log } from "@/lib/logger";
 *   log.info({ idCuenta }, "bot conectado");
 *   log.error({ err, idCuenta }, "fallo al enviar");
 */
const enDesarrollo = process.env.NODE_ENV !== "production";

export const log = pino({
  level: process.env.LOG_LEVEL ?? (enDesarrollo ? "debug" : "info"),
  ...(enDesarrollo
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" },
        },
      }
    : {}),
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
