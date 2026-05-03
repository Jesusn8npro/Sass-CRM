/**
 * Wrapper del SDK oficial apify-client. Centraliza:
 *  - lanzar runs en modo async (para jobs largos)
 *  - leer datasets paginados
 *  - verificar firma HMAC de webhooks salientes
 *
 * Configuración:
 *   APIFY_TOKEN — token personal del operador del SaaS (vos pagás).
 *   APIFY_WEBHOOK_SECRET — secret HMAC que usás al crear el webhook.
 *   PUBLIC_URL — URL pública del Next.js (https://app.tudominio.com).
 */
import crypto from "node:crypto";
import { ApifyClient } from "apify-client";

let _cliente: ApifyClient | null = null;
function cliente(): ApifyClient {
  if (!_cliente) {
    const token = process.env.APIFY_TOKEN;
    if (!token) {
      throw new Error(
        "APIFY_TOKEN no está seteada. Conseguíla en https://console.apify.com/account/integrations",
      );
    }
    _cliente = new ApifyClient({ token });
  }
  return _cliente;
}

export interface RunIniciado {
  apifyRunId: string;
  apifyDatasetId: string | null;
}

/**
 * Inicia un run async + registra un webhook que nos pegue cuando
 * termine. El payload llega a /api/apify/webhook con jobId interno.
 */
export async function iniciarRunAsync(input: {
  apifyActorId: string;
  inputActor: Record<string, unknown>;
  /** ID interno de runs_apify (para correlacionar al recibir webhook). */
  jobIdInterno: string;
  /** memoryMbytes opcional (default actor) */
  memoryMbytes?: number;
}): Promise<RunIniciado> {
  const publicUrl = process.env.PUBLIC_URL;
  if (!publicUrl) {
    throw new Error(
      "PUBLIC_URL no está seteada. Necesaria para que Apify nos avise cuando termine.",
    );
  }
  const secret = process.env.APIFY_WEBHOOK_SECRET ?? "cambiar_en_env";

  const run = await cliente()
    .actor(input.apifyActorId)
    .start(input.inputActor, {
      memory: input.memoryMbytes,
      webhooks: [
        {
          eventTypes: [
            "ACTOR.RUN.SUCCEEDED",
            "ACTOR.RUN.FAILED",
            "ACTOR.RUN.ABORTED",
          ],
          requestUrl: `${publicUrl}/api/apify/webhook`,
          payloadTemplate: JSON.stringify({
            jobIdInterno: input.jobIdInterno,
            apifyRunId: "{{resource.id}}",
            apifyDatasetId: "{{resource.defaultDatasetId}}",
            estado: "{{resource.status}}",
            secret,
          }),
        },
      ],
    });

  return {
    apifyRunId: run.id,
    apifyDatasetId: run.defaultDatasetId ?? null,
  };
}

/**
 * Lee items del dataset asociado a un run. `clean=true` elimina
 * campos meta y devuelve solo data útil.
 */
export async function leerDataset<T = unknown>(
  apifyDatasetId: string,
  limite = 1000,
): Promise<T[]> {
  const { items } = await cliente().dataset(apifyDatasetId).listItems({
    clean: true,
    limit: limite,
  });
  return items as T[];
}

/**
 * Verifica la firma HMAC del webhook entrante de Apify.
 * Header: `Apify-Webhook-Signature` (hex SHA-256).
 *
 * Apify firma body+secret. Si la firma no coincide o no hay secret
 * configurado, devuelve false y el handler debe rechazar 401.
 */
export function verificarFirmaWebhook(
  rawBody: string,
  firmaHex: string | null | undefined,
): boolean {
  const secret = process.env.APIFY_WEBHOOK_SECRET;
  if (!secret) return false;
  if (!firmaHex) return false;
  const esperado = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  // timing-safe
  const a = Buffer.from(esperado, "utf8");
  const b = Buffer.from(firmaHex, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Cancela un run en curso (botón "abortar" del panel).
 */
export async function abortarRun(apifyRunId: string): Promise<void> {
  await cliente().run(apifyRunId).abort();
}
