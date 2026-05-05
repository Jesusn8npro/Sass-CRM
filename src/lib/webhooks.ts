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
  | "contacto_actualizado"
  | "cita_agendada"
  | "cita_modificada"
  | "cita_cancelada"
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

  const motivo = await urlSeguraParaWebhook(webhook.url);
  if (motivo) {
    resultado = `✗ url-bloqueada: ${motivo}`;
  } else {
    try {
      const res = await fetch(webhook.url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(TIMEOUT_MS),
        redirect: "manual",
      });
      ok = res.ok;
      resultado = ok ? `✓ ${res.status} OK` : `✗ HTTP ${res.status}`;
    } catch (err) {
      const det = err instanceof Error ? err.message : String(err);
      resultado = `✗ ${det.slice(0, 200)}`;
    }
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

/**
 * Devuelve null si la URL es segura. En caso contrario, devuelve un
 * motivo legible. Bloquea: protocolos no-http, hosts privados/loopback/
 * link-local/metadata cloud — incluyendo lo que resuelva por DNS a
 * rangos privados (defensa contra DNS rebinding).
 */
async function urlSeguraParaWebhook(rawUrl: string): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return "url-malformada";
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return `protocolo no permitido (${url.protocol})`;
  }
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host === "ip6-localhost" || host === "ip6-loopback") {
    return "host loopback";
  }
  if (host === "metadata.google.internal" || host.endsWith(".internal")) {
    return "host metadata interno";
  }

  // Imports dinámicos: node:dns y node:net son server-only. Se cargan
  // acá adentro para que el bundler del cliente no intente incluirlos.
  const { lookup } = await import("node:dns/promises");
  const { isIP } = await import("node:net");

  const ips: string[] = isIP(host)
    ? [host]
    : (await lookup(host, { all: true, verbatim: true }).catch(() => []))
        .map((r) => r.address);

  if (ips.length === 0) return "host sin resolución DNS";
  for (const ip of ips) {
    if (esIpPrivada(ip, isIP)) return `IP privada/reservada (${ip})`;
  }
  return null;
}

function esIpPrivada(ip: string, isIPFn: (s: string) => number): boolean {
  const v = isIPFn(ip);
  if (v === 4) return esIpv4Privada(ip);
  if (v === 6) return esIpv6Privada(ip);
  return true;
}

function esIpv4Privada(ip: string): boolean {
  const partes = ip.split(".").map((n) => parseInt(n, 10));
  if (partes.length !== 4 || partes.some((n) => Number.isNaN(n))) return true;
  const [a, b] = partes as [number, number, number, number];
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true; // link-local + AWS metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast / reserved
  return false;
}

function esIpv6Privada(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA
  if (lower.startsWith("fe80")) return true; // link-local
  if (lower.startsWith("ff")) return true; // multicast
  // IPv4-mapped (::ffff:a.b.c.d)
  if (lower.startsWith("::ffff:")) return esIpv4Privada(lower.slice(7));
  return false;
}
