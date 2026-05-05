/**
 * Procesadores periódicos del bot — disparados por intervals desde
 * cicloVida.ts. Cada uno revisa la DB y agenda trabajo cuando algo
 * está "due".
 */
import {
  actualizarCita,
  cancelarSeguimiento,
  contarMensajesEnviadosHoyCuenta,
  contarMensajesUsuarioPosteriores,
  encolarBandejaSalida,
  insertarMensaje,
  listarCitasParaRecordar,
  listarCuentas,
  listarLlamadasProgramadasDue,
  listarSeguimientosPendientesDue,
  marcarLlamadaProgramadaEjecutada,
  marcarLlamadaProgramadaFallida,
  marcarSeguimientoEnviado,
  marcarSeguimientoFallido,
  obtenerAssistantLocal,
  obtenerConversacionPorId,
  obtenerCuenta,
} from "@/lib/baseDatos";
import { iniciarLlamadaConContexto } from "@/lib/llamadas";
import { db } from "@/lib/db/cliente";
import {
  enviarAlertaOperador,
  generarResumenDiario,
} from "@/lib/operadorPrivado";
import { urlApp } from "@/lib/emails/cliente";

// Reglas anti-ban WhatsApp:
//  - Solo a clientes que escribieron antes (al menos 1 msg user en la conv)
//  - Si los últimos 2 msgs son del bot/humano sin respuesta → no enviar
//  - Max N mensajes por cuenta por día (default 80)
//  - Solo enviar entre 8am y 10pm (zona del server)
const LIMITE_DIARIO_POR_CUENTA = 80;
const HORA_INICIO = 8;
const HORA_FIN = 22;

export function dentroHorarioHumano(): boolean {
  const h = new Date().getHours();
  return h >= HORA_INICIO && h < HORA_FIN;
}

export async function procesarSeguimientosPendientes(): Promise<void> {
  if (!dentroHorarioHumano()) return;

  let pendientes;
  try {
    pendientes = await listarSeguimientosPendientesDue();
  } catch (err) {
    console.error("[bot] error listando seguimientos:", err);
    return;
  }
  if (pendientes.length === 0) return;

  // Cache rápido por cuenta para no consultar mil veces el mismo conteo
  const cuentaActiva = new Map<string, boolean>();
  const enviadosHoyPorCuenta = new Map<string, number>();

  for (const s of pendientes) {
    try {
      // 1. Cuenta activa (no archivada, conectada)
      if (!cuentaActiva.has(s.cuenta_id)) {
        const c = await obtenerCuenta(s.cuenta_id);
        cuentaActiva.set(
          s.cuenta_id,
          !!c && !c.esta_archivada && c.estado === "conectado",
        );
      }
      if (!cuentaActiva.get(s.cuenta_id)) {
        await marcarSeguimientoFallido(s.id, "cuenta inactiva o desconectada");
        continue;
      }

      // 1.bis Si el destinatario es el OPERADOR PRIVADO, cancelamos
      // — el dueño no debe recibir auto-seguimientos genéricos. Cubre
      // seguimientos legacy creados antes del filtro upstream.
      const cuentaParaCheck = await obtenerCuenta(s.cuenta_id);
      const convParaCheck = await obtenerConversacionPorId(s.conversacion_id);
      const telOperadorN = (
        cuentaParaCheck?.telefono_operador_privado ?? ""
      ).replace(/[^0-9]/g, "");
      const telConvN = (convParaCheck?.telefono ?? "").replace(/[^0-9]/g, "");
      if (
        telOperadorN.length >= 8 &&
        telConvN.length >= 8 &&
        (telConvN === telOperadorN ||
          telConvN.endsWith(telOperadorN) ||
          telOperadorN.endsWith(telConvN))
      ) {
        await cancelarSeguimiento(s.id, "destinatario es operador privado");
        continue;
      }

      // 2. Si el cliente respondió desde que se programó → cancelar
      const respuestasNuevas = await contarMensajesUsuarioPosteriores(
        s.conversacion_id,
        s.creado_en,
      );
      if (respuestasNuevas > 0) {
        await cancelarSeguimiento(
          s.id,
          "el cliente respondió, no necesita seguimiento",
        );
        console.log(
          `[bot] ⏭ seguimiento ${s.id} cancelado (cliente respondió)`,
        );
        continue;
      }

      // 3. Conversación válida + cliente que ya escribió antes
      const conv = await obtenerConversacionPorId(s.conversacion_id);
      if (!conv) {
        await marcarSeguimientoFallido(s.id, "conversación borrada");
        continue;
      }

      // 4. Rate limit diario por cuenta
      if (!enviadosHoyPorCuenta.has(s.cuenta_id)) {
        enviadosHoyPorCuenta.set(
          s.cuenta_id,
          await contarMensajesEnviadosHoyCuenta(s.cuenta_id),
        );
      }
      const enviadosHoy = enviadosHoyPorCuenta.get(s.cuenta_id)!;
      if (enviadosHoy >= LIMITE_DIARIO_POR_CUENTA) {
        // No marcamos fallido — lo dejamos pendiente para mañana
        continue;
      }
      enviadosHoyPorCuenta.set(s.cuenta_id, enviadosHoy + 1);

      // 5. Encolar en bandeja_salida (la encoladora ya tiene jitter implícito
      //    por el procesamiento cada 2s — para varios seguimientos
      //    consecutivos el efecto es escalonado).
      try {
        await encolarBandejaSalida(
          s.cuenta_id,
          s.conversacion_id,
          conv.telefono,
          s.contenido,
        );
        // Insertar como mensaje rol=humano (asistente) para que aparezca
        // en el panel inmediatamente. La bandeja la enviará por Baileys.
        await insertarMensaje(
          s.cuenta_id,
          s.conversacion_id,
          "asistente",
          s.contenido,
        );
        await marcarSeguimientoEnviado(s.id);
        console.log(
          `[bot] ⏰→ seguimiento ${s.id} enviado a +${conv.telefono} (origen ${s.origen})`,
        );
      } catch (err) {
        console.error(`[bot] error encolando seguimiento ${s.id}:`, err);
        await marcarSeguimientoFallido(s.id, "error al encolar");
      }
    } catch (err) {
      console.error(`[bot] error procesando seguimiento ${s.id}:`, err);
    }
  }
}

/**
 * Manda recordatorios automáticos 1h antes de cada cita.
 * Marca recordatorio_enviado=true para no duplicar.
 */
export async function procesarRecordatoriosCitas(): Promise<void> {
  const ahoraIso = new Date().toISOString();
  const en1hIso = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  let citas;
  try {
    citas = await listarCitasParaRecordar(ahoraIso, en1hIso);
  } catch (err) {
    console.error("[bot] error listando citas a recordar:", err);
    return;
  }
  if (citas.length === 0) return;

  for (const cita of citas) {
    try {
      const cuenta = await obtenerCuenta(cita.cuenta_id);
      if (!cuenta || cuenta.esta_archivada || cuenta.estado !== "conectado") {
        continue;
      }
      const tel = cita.cliente_telefono || cita.conversacion_id
        ? cita.cliente_telefono ?? null
        : null;
      if (!tel) continue;

      const fechaStr = new Date(cita.fecha_hora).toLocaleString(
        "es-ES",
        { hour: "2-digit", minute: "2-digit" },
      );
      const tipoStr = cita.tipo ? ` para tu ${cita.tipo}` : "";
      const contenido = `Hola ${cita.cliente_nombre.split(" ")[0]}, te recuerdo que tu cita${tipoStr} es hoy a las ${fechaStr}. ¿Confirmás?`;

      const idConv = cita.conversacion_id;
      if (idConv) {
        await encolarBandejaSalida(cita.cuenta_id, idConv, tel, contenido);
        await insertarMensaje(cita.cuenta_id, idConv, "asistente", contenido);
      }
      await actualizarCita(cita.id, { recordatorio_enviado: true });
      console.log(
        `[bot] 📅 recordatorio enviado para cita ${cita.id} (${cita.cliente_nombre}) a las ${fechaStr}`,
      );
    } catch (err) {
      console.error(`[bot] error recordatorio cita ${cita.id}:`, err);
    }
  }
}

/**
 * Procesa llamadas Vapi programadas cuya hora ya pasó. Cada 30s.
 * Para cada una: chequea cuenta activa + conversación válida +
 * delega en iniciarLlamadaConContexto (que aplica cooldown,
 * normalización de teléfono, contexto WhatsApp, assistant override).
 */
export async function procesarLlamadasProgramadas(): Promise<void> {
  if (!dentroHorarioHumano()) return;
  let pendientes;
  try {
    pendientes = await listarLlamadasProgramadasDue();
  } catch (err) {
    console.error("[bot] error listando llamadas programadas:", err);
    return;
  }
  if (pendientes.length === 0) return;

  for (const lp of pendientes) {
    try {
      const cuenta = await obtenerCuenta(lp.cuenta_id);
      if (!cuenta || cuenta.esta_archivada) {
        await marcarLlamadaProgramadaFallida(lp.id, "cuenta inactiva");
        continue;
      }
      // Resolver conversación (puede ser null si la llamada se programó
      // sin conv asociada — caso edge, no soportado todavía).
      if (!lp.conversacion_id) {
        await marcarLlamadaProgramadaFallida(
          lp.id,
          "llamada sin conversación asociada",
        );
        continue;
      }
      const conv = await obtenerConversacionPorId(lp.conversacion_id);
      if (!conv) {
        await marcarLlamadaProgramadaFallida(lp.id, "conversación borrada");
        continue;
      }
      // Resolver assistant override
      let assistantIdOverride: string | null = null;
      if (lp.assistant_id) {
        const ass = await obtenerAssistantLocal(lp.assistant_id);
        if (ass?.vapi_assistant_id) {
          assistantIdOverride = ass.vapi_assistant_id;
        }
      }
      const r = await iniciarLlamadaConContexto({
        cuenta,
        conversacion: conv,
        telefonoOverride: lp.telefono_destino ?? null,
        motivo: lp.motivo,
        origen: lp.origen,
        assistantIdOverride,
      });
      if (r.ok && r.llamada) {
        await marcarLlamadaProgramadaEjecutada(lp.id, r.llamada.id);
        console.log(
          `[bot] 📞⏰ llamada programada ${lp.id} ejecutada (call ${r.llamada.vapi_call_id})`,
        );
      } else {
        await marcarLlamadaProgramadaFallida(
          lp.id,
          r.error ?? "fallo al iniciar",
        );
        console.warn(
          `[bot] ⚠ llamada programada ${lp.id} falló (${r.motivoBloqueo}): ${r.error}`,
        );
      }
    } catch (err) {
      console.error(`[bot] error procesando llamada programada ${lp.id}:`, err);
      try {
        await marcarLlamadaProgramadaFallida(
          lp.id,
          err instanceof Error ? err.message : "error desconocido",
        );
      } catch {
        /* ignorar */
      }
    }
  }
}

// ============================================================
// Operador privado — resumen diario 9am + alertas de desconexión
// ============================================================

/**
 * Manda al operador privado un resumen del negocio cada mañana entre
 * 9 y 10am hora local del servidor. Idempotente por día: graba un
 * mensaje sistema marcador `[resumen_operador_diario:YYYY-MM-DD]` en
 * la conversación virtual del operador y antes de enviar consulta si
 * ya existe.
 */
export async function procesarResumenDiarioOperador(): Promise<void> {
  const ahora = new Date();
  const hora = ahora.getHours();
  if (hora < 9 || hora >= 10) return;

  const hoy = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(ahora.getDate()).padStart(2, "0")}`;
  const marcador = `[resumen_operador_diario:${hoy}]`;

  let cuentas;
  try {
    cuentas = await listarCuentas();
  } catch (err) {
    console.error("[bot] error listando cuentas para resumen operador:", err);
    return;
  }

  for (const cuenta of cuentas) {
    if (cuenta.esta_archivada) continue;
    if (!cuenta.operador_privado_resumen_diario) continue;
    const tel = (cuenta.telefono_operador_privado ?? "").trim();
    if (!tel) continue;

    try {
      // Idempotencia: si ya existe el marcador para hoy en esta cuenta, skip.
      const desdeIso = new Date(
        ahora.getFullYear(),
        ahora.getMonth(),
        ahora.getDate(),
      ).toISOString();
      const { data: existente } = await db()
        .from("mensajes")
        .select("id")
        .eq("cuenta_id", cuenta.id)
        .eq("rol", "sistema")
        .eq("contenido", marcador)
        .gte("creado_en", desdeIso)
        .limit(1);
      if (existente && existente.length > 0) continue;

      const resumen = await generarResumenDiario(cuenta);
      // Para el resumen diario forzamos el envío aunque
      // operador_privado_alertas esté off — el toggle propio es
      // operador_privado_resumen_diario. Usamos directamente el
      // helper de envío con bypass del toggle.
      const { enviarMensajeOperadorBypass } = await import(
        "@/lib/operadorPrivado"
      );
      const r = await enviarMensajeOperadorBypass(cuenta, resumen);
      if (!r.ok) {
        console.warn(
          `[bot] resumen operador omitido para cuenta ${cuenta.id}: ${r.motivo ?? "?"}`,
        );
        continue;
      }

      // Grabar marcador para idempotencia diaria.
      try {
        // Buscar la conversación del operador para grabar el marcador
        // dentro de ella (queda como log natural del hilo).
        const { data: conv } = await db()
          .from("conversaciones")
          .select("id")
          .eq("cuenta_id", cuenta.id)
          .eq("telefono", tel)
          .maybeSingle();
        if (conv) {
          await insertarMensaje(
            cuenta.id,
            (conv as { id: string }).id,
            "sistema",
            marcador,
            { tipo: "sistema" },
          );
        }
      } catch {
        /* ignorar — no romper si falla el marcador */
      }
      console.log(
        `[bot] 📊 resumen diario operador enviado a +${tel} (cuenta ${cuenta.id})`,
      );
    } catch (err) {
      console.error(
        `[bot] error generando resumen operador para cuenta ${cuenta.id}:`,
        err,
      );
    }
  }
}

/**
 * Detecta cuentas con `operador_privado_alertas=true` cuyo último
 * heartbeat sea > 5 minutos atrás (o estado != conectado), y manda
 * UNA alerta por episodio de caída usando un marcador en mensajes.
 *
 * Marcador: rol=sistema, contenido `[alerta_operador_caida:YYYY-MM-DD HH]`
 * — granularidad de hora para no spamear si la caída se prolonga, pero
 * volver a avisar si pasan 24h sin reconectar.
 */
export async function procesarAlertasDesconexionOperador(): Promise<void> {
  let cuentas;
  try {
    cuentas = await listarCuentas();
  } catch (err) {
    console.error("[bot] error listando cuentas (alertas desconexión):", err);
    return;
  }

  // Cooldown agresivo: 1 alerta cada 6 horas para evitar spam si la
  // caída se prolonga. Antes era 1 por hora pero seguía spameando
  // demasiado en escenarios de reconexión flaky (bucle 440).
  const COOLDOWN_HORAS = 6;
  // Umbral de detección — solo alertar si la desconexión lleva >= 10
  // minutos. Evita falsos positivos por blips de reconexión normal
  // (los "código 440" típicos duran <1 min).
  const UMBRAL_DESCONEXION_MIN = 10;

  const ahora = new Date();
  const haceUmbralMs = Date.now() - UMBRAL_DESCONEXION_MIN * 60 * 1000;
  // Marcador con granularidad de bloque de 6h (00, 06, 12, 18) para
  // garantizar dedupe aunque el server reinicie o haya jitter.
  const bloque6h = Math.floor(ahora.getHours() / COOLDOWN_HORAS) * COOLDOWN_HORAS;
  const ventana = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(ahora.getDate()).padStart(2, "0")}T${String(bloque6h).padStart(2, "0")}`;
  const marcador = `[alerta_operador_caida:${ventana}]`;

  for (const cuenta of cuentas) {
    if (cuenta.esta_archivada) continue;
    if (!cuenta.operador_privado_alertas) continue;
    const tel = (cuenta.telefono_operador_privado ?? "").trim();
    if (!tel) continue;
    // Necesitamos socket vivo para mandar la alerta — si la cuenta está
    // caída no podemos avisar por su propio WhatsApp (el dueño se
    // entera por panel + email). Solo alertamos si el socket está vivo
    // pero el heartbeat se atrasó (caso raro de proceso colgado).
    if (cuenta.estado !== "conectado") continue;

    // FIX UNIDADES: ultimo_heartbeat se guarda como UNIX SECONDS
    // (Math.floor(Date.now()/1000)) — multiplicar por 1000 para
    // comparar contra Date.now() que está en MS. Sin esta conversión
    // el cálculo daba minutos absurdos (29M minutos = epoch).
    const ultimoHbSeg = cuenta.ultimo_heartbeat ?? 0;
    const ultimoHbMs = ultimoHbSeg > 0 ? ultimoHbSeg * 1000 : 0;
    const heartbeatStale =
      ultimoHbMs > 0 && ultimoHbMs < haceUmbralMs;
    if (!heartbeatStale) continue;

    try {
      // Dedupe: si ya hubo alerta en las últimas COOLDOWN_HORAS h, skip.
      const desdeIso = new Date(
        Date.now() - COOLDOWN_HORAS * 60 * 60 * 1000,
      ).toISOString();
      const { data: existente } = await db()
        .from("mensajes")
        .select("id")
        .eq("cuenta_id", cuenta.id)
        .eq("rol", "sistema")
        .eq("contenido", marcador)
        .gte("creado_en", desdeIso)
        .limit(1);
      if (existente && existente.length > 0) continue;

      // Calcular minutos transcurridos. Si por algún motivo da absurdo
      // (>1 año = ~525.600 min) usamos un fallback razonable — no
      // queremos alertas con "hace 29 millones de min".
      let minutos = ultimoHbMs > 0
        ? Math.round((Date.now() - ultimoHbMs) / 60000)
        : UMBRAL_DESCONEXION_MIN;
      if (minutos < 0 || minutos > 525_600) {
        minutos = UMBRAL_DESCONEXION_MIN;
      }

      // GARANTIZAR que existe la conv virtual del operador ANTES de
      // mandar — así podemos grabar el marcador después y evitar spam.
      const { obtenerOCrearConversacion } = await import("@/lib/baseDatos");
      const convOp = await obtenerOCrearConversacion(
        cuenta.id,
        tel,
        "Operador (alertas privadas)",
      );

      const ok = await enviarAlertaOperador(
        cuenta,
        `🚨 Tu WhatsApp ${cuenta.etiqueta} está desconectado hace ${minutos} min.\n` +
          `Reconectá en ${urlApp()}/app/cuentas/${cuenta.id}/whatsapp`,
      );
      if (!ok) continue;

      // Grabar marcador SIEMPRE — con la conv ya garantizada arriba.
      // Sin esto, la próxima iteración manda otra alerta = SPAM.
      try {
        await insertarMensaje(
          cuenta.id,
          convOp.id,
          "sistema",
          marcador,
          { tipo: "sistema" },
        );
      } catch (errMarc) {
        console.error(
          `[bot] no se pudo grabar marcador anti-spam alerta cuenta ${cuenta.id}:`,
          errMarc,
        );
      }
    } catch (err) {
      console.error(
        `[bot] error en alerta desconexión operador cuenta ${cuenta.id}:`,
        err,
      );
    }
  }
}
