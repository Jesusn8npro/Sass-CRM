import { db, lanzar } from "./cliente";
import { insertarMensaje } from "./mensajes";
import type {
  Conversacion,
  ConversacionConPreview,
  DatosCapturados,
  EstadoLead,
  EtiquetaResumen,
  ModoConversacion,
  RolMensaje,
  TipoMensaje,
} from "./tipos";

export async function obtenerOCrearConversacion(
  cuentaId: string,
  telefono: string,
  nombre?: string | null,
  jidWa?: string | null,
): Promise<Conversacion> {
  const { data: existente, error: errBuscar } = await db()
    .from("conversaciones")
    .select("*")
    .eq("cuenta_id", cuentaId)
    .eq("telefono", telefono)
    .maybeSingle();
  if (errBuscar) lanzar(errBuscar, "obtenerOCrearConversacion.buscar");
  if (existente) {
    const cambios: Record<string, unknown> = {};
    if (nombre && !(existente as Conversacion).nombre) cambios.nombre = nombre;
    if (jidWa && (existente as Conversacion).jid_wa !== jidWa)
      cambios.jid_wa = jidWa;
    if (Object.keys(cambios).length > 0) {
      const { data: actualizada, error: errUpd } = await db()
        .from("conversaciones")
        .update(cambios)
        .eq("id", (existente as Conversacion).id)
        .select()
        .single();
      if (errUpd) lanzar(errUpd, "obtenerOCrearConversacion.update");
      return actualizada as Conversacion;
    }
    return existente as Conversacion;
  }
  const { data: nueva, error: errCrear } = await db()
    .from("conversaciones")
    .insert({
      cuenta_id: cuentaId,
      telefono,
      nombre: nombre ?? null,
      jid_wa: jidWa ?? null,
    })
    .select()
    .single();
  if (errCrear) lanzar(errCrear, "obtenerOCrearConversacion.crear");
  return nueva as Conversacion;
}

export async function obtenerConversacionPorId(
  id: string,
): Promise<Conversacion | null> {
  const { data, error } = await db()
    .from("conversaciones")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) lanzar(error, "obtenerConversacionPorId");
  return (data as Conversacion) ?? null;
}

/**
 * Busca una conversación por su jid_wa exacto (incluyendo @lid). Útil
 * cuando WhatsApp manda un eco con remoteJid @lid y necesitamos
 * mapearlo a la conversación que ya teníamos por teléfono.
 */
export async function obtenerConversacionPorJid(
  cuentaId: string,
  jidWa: string,
): Promise<Conversacion | null> {
  const { data, error } = await db()
    .from("conversaciones")
    .select("*")
    .eq("cuenta_id", cuentaId)
    .eq("jid_wa", jidWa)
    .maybeSingle();
  if (error) lanzar(error, "obtenerConversacionPorJid");
  return (data as Conversacion) ?? null;
}

/**
 * Actualiza jid_wa de una conversación. Lo usamos para grabar el @lid
 * cuando aparece en el eco de un mensaje que mandamos — así, futuros
 * mensajes manuales del cel conectado encuentran la conversación.
 */
export async function actualizarJidWaConversacion(
  conversacionId: string,
  jidWa: string,
): Promise<void> {
  const { error } = await db()
    .from("conversaciones")
    .update({ jid_wa: jidWa })
    .eq("id", conversacionId);
  if (error) lanzar(error, "actualizarJidWaConversacion");
}

export async function listarConversaciones(
  cuentaId: string,
): Promise<ConversacionConPreview[]> {
  const { data: convs, error: errC } = await db()
    .from("conversaciones")
    .select("*")
    .eq("cuenta_id", cuentaId)
    .order("ultimo_mensaje_en", { ascending: false, nullsFirst: false });
  if (errC) lanzar(errC, "listarConversaciones");
  if (!convs || convs.length === 0) return [];

  const convIds = convs.map((c) => (c as Conversacion).id);

  const ultimoVistoMap = new Map<string, number>();
  for (const cv of convs as Conversacion[]) {
    if (cv.ultimo_visto_operador_en) {
      ultimoVistoMap.set(cv.id, new Date(cv.ultimo_visto_operador_en).getTime());
    }
  }

  // Vistas previas + rol del último mensaje + contador "nuevos".
  // Limitamos a los últimos 5000 msgs para no traer la DB completa en
  // cuentas con mucho histórico.
  const previews = new Map<string, string>();
  const previewRol = new Map<string, RolMensaje>();
  const nuevos = new Map<string, number>();
  const { data: msgs } = await db()
    .from("mensajes")
    .select("conversacion_id, contenido, creado_en, rol, tipo")
    .in("conversacion_id", convIds)
    .order("creado_en", { ascending: false })
    .limit(5000);
  if (msgs) {
    type FilaMsg = {
      conversacion_id: string;
      contenido: string;
      creado_en: string;
      rol: RolMensaje;
      tipo: TipoMensaje;
    };
    for (const m of msgs as FilaMsg[]) {
      if (!previews.has(m.conversacion_id)) {
        let preview = m.contenido;
        if (m.tipo === "imagen" && !preview?.trim()) preview = "📷 Imagen";
        else if (m.tipo === "audio" && !preview?.trim()) preview = "🎤 Audio";
        else if (m.tipo === "video" && !preview?.trim()) preview = "🎬 Video";
        else if (m.tipo === "documento" && !preview?.trim())
          preview = "📎 Documento";
        previews.set(m.conversacion_id, preview ?? "");
        previewRol.set(m.conversacion_id, m.rol);
      }
      if (m.rol === "usuario") {
        const visto = ultimoVistoMap.get(m.conversacion_id);
        const tsMsg = new Date(m.creado_en).getTime();
        if (visto === undefined || tsMsg > visto) {
          nuevos.set(
            m.conversacion_id,
            (nuevos.get(m.conversacion_id) ?? 0) + 1,
          );
        }
      }
    }
  }

  // Etiquetas asignadas por conversación
  const etiquetasMap = new Map<string, EtiquetaResumen[]>();
  const { data: ce } = await db()
    .from("conversacion_etiquetas")
    .select("conversacion_id, etiquetas (id, nombre, color, orden)")
    .in("conversacion_id", convIds);
  if (ce) {
    type FilaCE = {
      conversacion_id: string;
      etiquetas:
        | { id: string; nombre: string; color: string; orden: number }
        | Array<{ id: string; nombre: string; color: string; orden: number }>
        | null;
    };
    for (const row of ce as unknown as FilaCE[]) {
      if (!row.etiquetas) continue;
      const lista = Array.isArray(row.etiquetas) ? row.etiquetas : [row.etiquetas];
      const arr = etiquetasMap.get(row.conversacion_id) ?? [];
      for (const et of lista) {
        arr.push({ id: et.id, nombre: et.nombre, color: et.color });
      }
      etiquetasMap.set(row.conversacion_id, arr);
    }
  }

  return (convs as Conversacion[]).map((c) => ({
    ...c,
    vista_previa_ultimo_mensaje: previews.get(c.id) ?? null,
    vista_previa_rol: previewRol.get(c.id) ?? null,
    mensajes_nuevos: nuevos.get(c.id) ?? 0,
    etiquetas: etiquetasMap.get(c.id) ?? [],
  }));
}

/** Marca la conversación como leída. Resetea el badge de "mensajes
 * nuevos". Se llama desde el panel cuando el operador hace click. */
export async function marcarConversacionComoLeida(
  conversacionId: string,
): Promise<void> {
  const { error } = await db()
    .from("conversaciones")
    .update({ ultimo_visto_operador_en: new Date().toISOString() })
    .eq("id", conversacionId);
  if (error) lanzar(error, "marcarConversacionComoLeida");
}

export async function cambiarModo(
  conversacionId: string,
  modo: ModoConversacion,
): Promise<void> {
  const cambios: Record<string, unknown> = { modo };
  if (modo === "IA") cambios.necesita_humano = false;
  const { error } = await db()
    .from("conversaciones")
    .update(cambios)
    .eq("id", conversacionId);
  if (error) lanzar(error, "cambiarModo");
}

export async function marcarConversacionNecesitaHumano(
  conversacionId: string,
  razon: string,
): Promise<void> {
  const { error: errUpd } = await db()
    .from("conversaciones")
    .update({ necesita_humano: true, modo: "HUMANO" })
    .eq("id", conversacionId);
  if (errUpd) lanzar(errUpd, "marcarConversacionNecesitaHumano");

  const { data: conv } = await db()
    .from("conversaciones")
    .select("cuenta_id")
    .eq("id", conversacionId)
    .single();
  if (conv) {
    await insertarMensaje(
      (conv as { cuenta_id: string }).cuenta_id,
      conversacionId,
      "sistema",
      `[Handoff a humano] ${razon}`,
      { tipo: "sistema" },
    );
  }
}

export async function borrarConversacion(id: string): Promise<void> {
  // Cascada via FK ON DELETE CASCADE (mensajes, bandeja, etiquetas)
  const { error } = await db().from("conversaciones").delete().eq("id", id);
  if (error) lanzar(error, "borrarConversacion");
}

export async function cambiarEtapaConversacion(
  conversacionId: string,
  etapaId: string | null,
): Promise<void> {
  const { error } = await db()
    .from("conversaciones")
    .update({ etapa_id: etapaId })
    .eq("id", conversacionId);
  if (error) lanzar(error, "cambiarEtapaConversacion");
}

/**
 * Actualiza lead tracking. Recibe parches parciales — solo se aplican
 * los campos provistos. Para `datos_capturados` hace MERGE con lo
 * existente (no reemplaza).
 */
export async function actualizarLead(
  conversacionId: string,
  cambios: {
    nombre?: string | null;
    lead_score?: number;
    estado_lead?: EstadoLead;
    paso_actual?: string;
    datos_capturados_merge?: Partial<DatosCapturados>;
  },
): Promise<Conversacion | null> {
  const upd: Record<string, unknown> = {};
  if (cambios.nombre !== undefined) upd.nombre = cambios.nombre;
  if (cambios.lead_score !== undefined) {
    upd.lead_score = Math.max(0, Math.min(100, Math.round(cambios.lead_score)));
  }
  if (cambios.estado_lead !== undefined) upd.estado_lead = cambios.estado_lead;
  if (cambios.paso_actual !== undefined) upd.paso_actual = cambios.paso_actual;

  if (cambios.datos_capturados_merge) {
    const actual = await obtenerConversacionPorId(conversacionId);
    if (!actual) return null;
    const merged: DatosCapturados = { ...actual.datos_capturados };
    for (const [k, v] of Object.entries(cambios.datos_capturados_merge)) {
      if (v === undefined) continue;
      if (k === "otros") {
        merged.otros = {
          ...(merged.otros ?? {}),
          ...((v as Record<string, string>) ?? {}),
        };
      } else if (v === null || v === "") {
        // null/string-vacío → no pisamos. La IA a veces manda strings
        // vacíos cuando no tiene info nueva.
        continue;
      } else {
        (merged as Record<string, unknown>)[k] = v;
      }
    }
    upd.datos_capturados = merged;
  }

  if (Object.keys(upd).length === 0) {
    return await obtenerConversacionPorId(conversacionId);
  }

  const { data, error } = await db()
    .from("conversaciones")
    .update(upd)
    .eq("id", conversacionId)
    .select()
    .single();
  if (error) lanzar(error, "actualizarLead");
  return data as Conversacion;
}
