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
