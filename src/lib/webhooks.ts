/**
 * Emisor central de webhooks salientes.
 *
 * Cuando ocurre un evento relevante en el bot (mensaje recibido,
 * contacto nuevo, etc), se llama `dispararWebhook(cuentaId, evento, payload)`
 * fire-and-forget. El módulo busca todos los webhooks activos de esa
 * cuenta que se suscribieron al evento, y dispara POST a cada uno
 * en paralelo con un timeout corto.
 *
 * No bloquea el flujo del bot — los errores se loggean y se cuentan
 * en `webhooks_salientes.total_fallos` pero no fallan al caller.
 */

import { crearClienteAdmin } from "./supabase/cliente-servidor";

export type EventoWebhook =
  | "mensaje_recibido"
  | "mensaje_enviado"
  | "contacto_nuevo"
  | "cita_agendada"
  | "llamada_terminada"
  | "handoff_humano";

interface FilaWebhook {
  id: string;
  url: string;
  secret: string | null;
  eventos: string[];
  total_disparos: number;
  total_fallos: number;
}

const TIMEOUT_MS = 8000;

/**
 * Dispara un evento a todos los webhooks suscriptos de una cuenta.
 * Fire-and-forget — no espera a que terminen los POST individuales.
 */
export function dispararWebhook(
  cuentaId: string,
  evento: EventoWebhook,
  datos: Record<string, unknown>,
): void {
  // Toda la lógica corre async en background — no bloquea al caller.
  void (async () => {
    try {
      const supabase = crearClienteAdmin();
      const { data, error } = await supabase
        .from("webhooks_salientes")
        .select("id, url, secret, eventos, total_disparos, total_fallos")
        .eq("cuenta_id", cuentaId)
        .eq("esta_activo", true);
      if (error || !data || data.length === 0) return;

      // Filtrar webhooks que se suscribieron a este evento.
      // Si su array `eventos` está vacío, recibe TODOS los eventos.
      const aplicables = (data as FilaWebhook[]).filter((w) => {
        return w.eventos.length === 0 || w.eventos.includes(evento);
      });
      if (aplicables.length === 0) return;

      const payload = {
        evento,
        cuenta_id: cuentaId,
        timestamp: new Date().toISOString(),
        datos,
      };

      // Disparamos en paralelo
      await Promise.all(
        aplicables.map((w) => disparar1(supabase, w, payload)),
      );
    } catch (err) {
      console.error("[webhooks] error general en dispararWebhook:", err);
    }
  })();
}

async function disparar1(
  supabase: ReturnType<typeof crearClienteAdmin>,
  webhook: FilaWebhook,
  payload: Record<string, unknown>,
): Promise<void> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "Sass-CRM-Webhook/1.0",
  };
  if (webhook.secret) headers["x-webhook-secret"] = webhook.secret;

  let resultado: string;
  let ok = false;
  try {
    const res = await fetch(webhook.url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    ok = res.ok;
    resultado = ok
      ? `✓ ${res.status} OK`
      : `✗ HTTP ${res.status}`;
  } catch (err) {
    const det = err instanceof Error ? err.message : String(err);
    resultado = `✗ ${det.slice(0, 200)}`;
  }

  // Actualizar stats — best effort, no bloquea si falla
  try {
    await supabase
      .from("webhooks_salientes")
      .update({
        ultimo_disparo_en: new Date().toISOString(),
        ultimo_resultado: resultado,
        total_disparos: webhook.total_disparos + 1,
        total_fallos: webhook.total_fallos + (ok ? 0 : 1),
      })
      .eq("id", webhook.id);
  } catch {
    /* ignorar */
  }
}
