import { db, lanzar } from "./cliente";
import type { Mensaje, RolMensaje, TipoMensaje } from "./tipos";

export async function insertarMensaje(
  cuentaId: string,
  conversacionId: string,
  rol: RolMensaje,
  contenido: string,
  opciones?: {
    tipo?: TipoMensaje;
    media_path?: string | null;
    wa_msg_id?: string | null;
    /** ISO string para mensajes históricos importados con su ts original. */
    creado_en?: string;
    /** Si true, no actualiza ultimo_mensaje_en (mensajes históricos). */
    es_historico?: boolean;
  },
): Promise<Mensaje | null> {
  const fila: Record<string, unknown> = {
    cuenta_id: cuentaId,
    conversacion_id: conversacionId,
    rol,
    tipo: opciones?.tipo ?? "texto",
    contenido,
    media_path: opciones?.media_path ?? null,
    wa_msg_id: opciones?.wa_msg_id ?? null,
  };
  if (opciones?.creado_en) fila.creado_en = opciones.creado_en;

  // Si trae wa_msg_id usamos upsert para idempotencia. Si no, insert plano.
  let res;
  if (opciones?.wa_msg_id) {
    res = await db()
      .from("mensajes")
      .upsert(fila, {
        onConflict: "cuenta_id,wa_msg_id",
        ignoreDuplicates: true,
      })
      .select()
      .maybeSingle();
  } else {
    res = await db().from("mensajes").insert(fila).select().single();
  }
  if (res.error) lanzar(res.error, "insertarMensaje");
  // Si fue duplicado (upsert con ignoreDuplicates) data viene null — es OK.
  if (!res.data) return null;

  if (!opciones?.es_historico) {
    await db()
      .from("conversaciones")
      .update({ ultimo_mensaje_en: new Date().toISOString() })
      .eq("id", conversacionId);
  }

  // Webhook saliente "mensaje_enviado" — solo para mensajes que SALIERON
  // por WhatsApp (asistente/humano), no para entrantes ni sistema ni
  // históricos. Import dinámico para evitar ciclo con webhooks.
  if (!opciones?.es_historico && (rol === "asistente" || rol === "humano")) {
    void (async () => {
      try {
        const { dispararWebhook } = await import("../webhooks");
        const m = res.data as Mensaje;
        dispararWebhook(cuentaId, "mensaje_enviado", {
          mensaje_id: m.id,
          conversacion_id: conversacionId,
          rol,
          tipo: m.tipo,
          contenido: m.contenido,
          media_path: m.media_path,
          wa_msg_id: m.wa_msg_id,
        });
      } catch {
        /* ignorar */
      }
    })();
  }

  return res.data as Mensaje;
}

/**
 * Intenta vincular un eco de WhatsApp (fromMe=true) a un mensaje humano
 * que insertamos en DB hace pocos segundos sin wa_msg_id (típico flujo:
 * operador subió audio desde panel → guardamos sin wa_msg_id → bandeja
 * envía por Baileys → echo llega antes de que recordáramos el msgId).
 *
 * Si encuentra un candidato (rol='humano', wa_msg_id IS NULL, mismo
 * media_path o mismo contenido, creado hace <30s), lo UPDATEa con el
 * wa_msg_id real y devuelve true. Si no encuentra nada, devuelve false
 * y el caller inserta una fila nueva.
 */
export async function vincularEcoHumanoReciente(
  cuentaId: string,
  conversacionId: string,
  waMsgId: string,
  contenido: string,
  mediaPath: string | null,
): Promise<boolean> {
  const haceTreintaSeg = new Date(Date.now() - 30_000).toISOString();
  let q = db()
    .from("mensajes")
    .select("id")
    .eq("cuenta_id", cuentaId)
    .eq("conversacion_id", conversacionId)
    .eq("rol", "humano")
    .is("wa_msg_id", null)
    .gte("creado_en", haceTreintaSeg);
  if (mediaPath) {
    q = q.eq("media_path", mediaPath);
  } else {
    q = q.eq("contenido", contenido);
  }
  const { data, error } = await q
    .order("creado_en", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return false;
  const { error: errUpd } = await db()
    .from("mensajes")
    .update({ wa_msg_id: waMsgId })
    .eq("id", (data as { id: string }).id);
  if (errUpd) return false;
  return true;
}

/** Devuelve el mensaje más viejo de la conversación con wa_msg_id,
 * útil para pedir más historial via fetchMessageHistory. */
export async function obtenerMensajeMasViejoConWaId(
  conversacionId: string,
): Promise<Mensaje | null> {
  const { data, error } = await db()
    .from("mensajes")
    .select("*")
    .eq("conversacion_id", conversacionId)
    .not("wa_msg_id", "is", null)
    .order("creado_en", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) lanzar(error, "obtenerMensajeMasViejoConWaId");
  return (data as Mensaje) ?? null;
}

/** Cuenta cuántos mensajes tiene una conversación. Usado para detectar
 * conversaciones recién creadas (fetch on-demand). */
export async function contarMensajesDeConversacion(
  conversacionId: string,
): Promise<number> {
  const { count, error } = await db()
    .from("mensajes")
    .select("id", { count: "exact", head: true })
    .eq("conversacion_id", conversacionId);
  if (error) lanzar(error, "contarMensajesDeConversacion");
  return count ?? 0;
}

export async function obtenerMensajes(
  conversacionId: string,
  limite = 200,
): Promise<Mensaje[]> {
  const { data, error } = await db()
    .from("mensajes")
    .select("*")
    .eq("conversacion_id", conversacionId)
    .order("creado_en", { ascending: true })
    .limit(limite);
  if (error) lanzar(error, "obtenerMensajes");
  return (data ?? []) as Mensaje[];
}

export async function obtenerHistorialReciente(
  conversacionId: string,
  limite = 20,
): Promise<Mensaje[]> {
  const { data, error } = await db()
    .from("mensajes")
    .select("*")
    .eq("conversacion_id", conversacionId)
    .order("creado_en", { ascending: false })
    .limit(limite);
  if (error) lanzar(error, "obtenerHistorialReciente");
  return ((data ?? []) as Mensaje[]).reverse();
}
