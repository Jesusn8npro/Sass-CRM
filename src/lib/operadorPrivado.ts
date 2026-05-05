/**
 * "Operador privado": el dueño del SaaS recibe alertas urgentes y un
 * resumen diario en SU número de WhatsApp (separado del agente IA).
 *
 * Mecánica:
 *  - `cuenta.telefono_operador_privado` define el número destino.
 *  - Las alertas se encolan en `bandeja_salida` igual que cualquier
 *    mensaje saliente normal — el bot Baileys las despacha por el
 *    socket de la cuenta cuando le tocan.
 *  - Para no ensuciar la lista de conversaciones del cliente, todas
 *    las alertas viven dentro de UNA "conversación virtual" creada
 *    bajo el teléfono del operador (etiqueta: "Operador (alertas privadas)").
 *
 * Toggles:
 *  - `operador_privado_alertas`     → tiempo real (score>=80, handoff,
 *                                     cuenta caída).
 *  - `operador_privado_resumen_diario` → mensaje cada mañana 9am.
 *
 * Las funciones son fire-and-forget: si fallan, log y seguir. Nunca
 * deben tirar al caller del bot.
 */

import { db } from "./db/cliente";
import {
  encolarBandejaSalida,
  obtenerOCrearConversacion,
  type Cuenta,
} from "./baseDatos";
import { urlApp } from "./emails/cliente";

/** Encola una alerta de texto al teléfono del operador privado.
 *
 * Devuelve true si se encoló, false si no (toggle off, sin teléfono,
 * o error en la DB). NUNCA tira excepción.
 */
export async function enviarAlertaOperador(
  cuenta: Cuenta,
  mensaje: string,
): Promise<boolean> {
  try {
    const tel = (cuenta.telefono_operador_privado ?? "").trim();
    if (!tel) return false;
    if (!cuenta.operador_privado_alertas) return false;
    const texto = mensaje.trim();
    if (!texto) return false;

    const conv = await obtenerOCrearConversacion(
      cuenta.id,
      tel,
      "Operador (alertas privadas)",
    );
    await encolarBandejaSalida(cuenta.id, conv.id, tel, texto);
    return true;
  } catch (err) {
    console.error("[operadorPrivado] error enviando alerta:", err);
    return false;
  }
}

/** Variante que NO chequea el toggle — para el botón "Enviar test ahora"
 *  desde la UI. Igual requiere teléfono configurado. */
export async function enviarMensajeOperadorBypass(
  cuenta: Cuenta,
  mensaje: string,
): Promise<{ ok: boolean; motivo?: string }> {
  try {
    const tel = (cuenta.telefono_operador_privado ?? "").trim();
    if (!tel) return { ok: false, motivo: "sin_telefono" };
    const texto = mensaje.trim();
    if (!texto) return { ok: false, motivo: "sin_contenido" };
    if (cuenta.estado !== "conectado") {
      return { ok: false, motivo: "cuenta_desconectada" };
    }
    const conv = await obtenerOCrearConversacion(
      cuenta.id,
      tel,
      "Operador (alertas privadas)",
    );
    await encolarBandejaSalida(cuenta.id, conv.id, tel, texto);
    return { ok: true };
  } catch (err) {
    console.error("[operadorPrivado] error en test:", err);
    return { ok: false, motivo: "excepcion" };
  }
}

/**
 * Genera el texto del resumen diario para el operador. Cubre el día
 * de AYER (00:00 a 24:00 hora local del servidor).
 *
 * Métricas:
 *  - Mensajes recibidos del cliente ayer.
 *  - Leads nuevos (conversaciones creadas ayer).
 *  - Citas agendadas para HOY (fecha_hora dentro del día actual).
 *  - Top 3 productos con interés ayer (registrar_interes).
 *  - Cuenta desconectada? leads sin contestar > 24h?
 */
export async function generarResumenDiario(cuenta: Cuenta): Promise<string> {
  const ahora = new Date();
  const finAyer = new Date(ahora);
  finAyer.setHours(0, 0, 0, 0);
  const inicioAyer = new Date(finAyer);
  inicioAyer.setDate(inicioAyer.getDate() - 1);
  const finHoy = new Date(finAyer);
  finHoy.setDate(finHoy.getDate() + 1);

  const inicioAyerIso = inicioAyer.toISOString();
  const finAyerIso = finAyer.toISOString();
  const inicioHoyIso = finAyer.toISOString();
  const finHoyIso = finHoy.toISOString();

  // 1. Mensajes recibidos ayer (rol=usuario)
  let mensajesAyer = 0;
  try {
    const r = await db()
      .from("mensajes")
      .select("id", { count: "exact", head: true })
      .eq("cuenta_id", cuenta.id)
      .eq("rol", "usuario")
      .gte("creado_en", inicioAyerIso)
      .lt("creado_en", finAyerIso);
    mensajesAyer = r.count ?? 0;
  } catch {
    /* ignorar */
  }

  // 2. Leads nuevos (conversaciones creadas ayer)
  let leadsNuevos = 0;
  try {
    const r = await db()
      .from("conversaciones")
      .select("id", { count: "exact", head: true })
      .eq("cuenta_id", cuenta.id)
      .gte("creada_en", inicioAyerIso)
      .lt("creada_en", finAyerIso);
    leadsNuevos = r.count ?? 0;
  } catch {
    /* ignorar */
  }

  // 3. Citas agendadas para HOY (fecha_hora hoy + estado activo)
  let citasHoy = 0;
  try {
    const r = await db()
      .from("citas")
      .select("id", { count: "exact", head: true })
      .eq("cuenta_id", cuenta.id)
      .in("estado", ["agendada", "confirmada"])
      .gte("fecha_hora", inicioHoyIso)
      .lt("fecha_hora", finHoyIso);
    citasHoy = r.count ?? 0;
  } catch {
    /* ignorar */
  }

  // 4. Top 3 productos con interés ayer
  // Tabla: conversacion_productos_interes (cuenta_id, producto_id, ultimo_interes_en).
  // Si la tabla no existe, lo capturamos en el catch.
  const topProductos: { nombre: string; cuenta: number }[] = [];
  try {
    const { data: rows } = await db()
      .from("conversacion_productos_interes")
      .select("producto_id")
      .eq("cuenta_id", cuenta.id)
      .gte("ultimo_interes_en", inicioAyerIso)
      .lt("ultimo_interes_en", finAyerIso);
    if (rows && rows.length > 0) {
      const conteo = new Map<string, number>();
      for (const fila of rows as { producto_id: string }[]) {
        conteo.set(
          fila.producto_id,
          (conteo.get(fila.producto_id) ?? 0) + 1,
        );
      }
      const ordenados = [...conteo.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);
      const ids = ordenados.map(([id]) => id);
      if (ids.length > 0) {
        const { data: prods } = await db()
          .from("productos")
          .select("id, nombre")
          .in("id", ids);
        const nombrePorId = new Map<string, string>();
        for (const p of (prods ?? []) as { id: string; nombre: string }[]) {
          nombrePorId.set(p.id, p.nombre);
        }
        for (const [id, c] of ordenados) {
          topProductos.push({
            nombre: nombrePorId.get(id) ?? `(producto ${id.slice(0, 6)})`,
            cuenta: c,
          });
        }
      }
    }
  } catch {
    /* tabla puede no existir aún — silencioso */
  }

  // 5. Alertas: leads sin contestar > 24h
  let leadsSinContestar = 0;
  try {
    const hace24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const r = await db()
      .from("conversaciones")
      .select("id", { count: "exact", head: true })
      .eq("cuenta_id", cuenta.id)
      .eq("necesita_humano", true)
      .lt("ultimo_mensaje_en", hace24h);
    leadsSinContestar = r.count ?? 0;
  } catch {
    /* ignorar */
  }

  const cuentaCaida = cuenta.estado !== "conectado";

  const lineas: string[] = [];
  lineas.push(`📊 Resumen diario — ${cuenta.etiqueta}`);
  lineas.push("");
  lineas.push(`💬 Mensajes recibidos ayer: ${mensajesAyer}`);
  lineas.push(`🆕 Leads nuevos: ${leadsNuevos}`);
  lineas.push(`📅 Citas para hoy: ${citasHoy}`);

  if (topProductos.length > 0) {
    lineas.push("");
    lineas.push("🛍 Top productos con interés:");
    for (const p of topProductos) {
      lineas.push(`  • ${p.nombre} (${p.cuenta})`);
    }
  }

  const alertas: string[] = [];
  if (cuentaCaida) {
    alertas.push(`• WhatsApp desconectado (${cuenta.estado})`);
  }
  if (leadsSinContestar > 0) {
    alertas.push(`• ${leadsSinContestar} lead(s) esperan respuesta humana > 24h`);
  }
  if (alertas.length > 0) {
    lineas.push("");
    lineas.push("⚠ Alertas:");
    for (const a of alertas) lineas.push(a);
  }

  lineas.push("");
  lineas.push(`Ver: ${urlApp()}/app/cuentas/${cuenta.id}`);
  return lineas.join("\n");
}
