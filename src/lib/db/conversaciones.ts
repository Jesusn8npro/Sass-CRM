import { db, lanzar } from "./cliente";
import { insertarMensaje } from "./mensajes";
import { enviarPushHandoff } from "@/lib/push/enviarPush";
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
  opciones?: { limite?: number; offset?: number },
): Promise<ConversacionConPreview[]> {
  let query = db()
    .from("conversaciones")
    .select("*")
    .eq("cuenta_id", cuentaId)
    .order("ultimo_mensaje_en", { ascending: false, nullsFirst: false });

  const limite = opciones?.limite ?? 200;
  const offset = opciones?.offset ?? 0;
  query = query.range(offset, offset + limite - 1);

  const { data: convs, error: errC } = await query;
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
    const cuentaId = (conv as { cuenta_id: string }).cuenta_id;
    await insertarMensaje(
      cuentaId,
      conversacionId,
      "sistema",
      `[Handoff a humano] ${razon}`,
      { tipo: "sistema" },
    );
    void enviarPushHandoff(cuentaId, conversacionId, "Cliente");
  }
}

/**
 * Lista conversaciones para export CSV — sin previews ni etiquetas.
 * Adjunta total_mensajes contado en una sola query agregada en memoria.
 * Tope `limite` aplicado al universo de conversaciones devueltas.
 */
export interface ConversacionParaExport extends Conversacion {
  total_mensajes: number;
}

export async function listarConversacionesParaExport(
  cuentaId: string,
  limite: number,
): Promise<ConversacionParaExport[]> {
  const { data: convs, error } = await db()
    .from("conversaciones")
    .select("*")
    .eq("cuenta_id", cuentaId)
    .order("ultimo_mensaje_en", { ascending: false, nullsFirst: false })
    .limit(limite);
  if (error) lanzar(error, "listarConversacionesParaExport");
  if (!convs || convs.length === 0) return [];

  const convIds = convs.map((c) => (c as Conversacion).id);
  const conteo = new Map<string, number>();
  // Una sola query agrupando en memoria. Tope 200k mensajes para no
  // explotar — para conteos exactos en cuentas mas grandes habria que
  // mover esto a una RPC con count() agrupado.
  const { data: msgs } = await db()
    .from("mensajes")
    .select("conversacion_id")
    .in("conversacion_id", convIds)
    .limit(200000);
  if (msgs) {
    for (const m of msgs as { conversacion_id: string }[]) {
      conteo.set(m.conversacion_id, (conteo.get(m.conversacion_id) ?? 0) + 1);
    }
  }
  return (convs as Conversacion[]).map((c) => ({
    ...c,
    total_mensajes: conteo.get(c.id) ?? 0,
  }));
}

export async function borrarConversacion(id: string): Promise<void> {
  // Cascada via FK ON DELETE CASCADE (mensajes, bandeja, etiquetas)
  const { error } = await db().from("conversaciones").delete().eq("id", id);
  if (error) lanzar(error, "borrarConversacion");
}

/**
 * Borrado masivo. Filtra por cuenta_id como guard de seguridad — aunque
 * el caller ya valida la pertenencia, esto evita borrar accidentalmente
 * conversaciones de otra cuenta si pasaron IDs mezclados.
 */
export async function borrarConversaciones(
  cuentaId: string,
  ids: string[],
): Promise<number> {
  if (ids.length === 0) return 0;
  const { error, count } = await db()
    .from("conversaciones")
    .delete({ count: "exact" })
    .eq("cuenta_id", cuentaId)
    .in("id", ids);
  if (error) lanzar(error, "borrarConversaciones");
  return count ?? 0;
}

/**
 * Persiste la memoria a largo plazo de una conversación. El caller
 * (src/lib/memoria.ts) ya generó el texto resumido con el LLM y nos
 * pasa el timestamp del último mensaje incorporado.
 */
export async function actualizarResumenContexto(
  conversacionId: string,
  resumen: string,
  resumidoHastaEn: string,
): Promise<void> {
  const { error } = await db()
    .from("conversaciones")
    .update({
      resumen_contexto: resumen,
      resumido_hasta_en: resumidoHastaEn,
    })
    .eq("id", conversacionId);
  if (error) lanzar(error, "actualizarResumenContexto");
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

function scoreAEstadoLead(score: number): EstadoLead {
  if (score >= 100) return "cerrado";
  if (score >= 80) return "negociacion";
  if (score >= 60) return "interesado";
  if (score >= 40) return "calificado";
  if (score >= 25) return "contactado";
  return "nuevo";
}

/**
 * Actualiza lead tracking. Recibe parches parciales — solo se aplican
 * los campos provistos. Para `datos_capturados` hace MERGE con lo
 * existente (no reemplaza). Cuando solo se actualiza `lead_score`,
 * el estado_lead se deriva automáticamente (excepto si ya es cerrado/perdido).
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

  const SCORE_POR_ESTADO: Record<string, number> = {
    nuevo: 10, contactado: 25, calificado: 40,
    interesado: 60, negociacion: 80, cerrado: 100, perdido: 5,
  };

  if (cambios.lead_score !== undefined) {
    const score = Math.max(0, Math.min(100, Math.round(cambios.lead_score)));
    upd.lead_score = score;
    // Auto-deriva estado_lead del score cuando no se especifica uno explícito.
    // Lee el estado actual para no pisar estados terminales (cerrado/perdido).
    if (cambios.estado_lead === undefined) {
      const actual = await obtenerConversacionPorId(conversacionId);
      const estadoActual = actual?.estado_lead ?? "nuevo";
      if (estadoActual !== "cerrado" && estadoActual !== "perdido") {
        upd.estado_lead = scoreAEstadoLead(score);
      }
    }
  } else if (cambios.estado_lead !== undefined) {
    const autoScore = SCORE_POR_ESTADO[cambios.estado_lead];
    if (autoScore !== undefined) upd.lead_score = autoScore;
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
