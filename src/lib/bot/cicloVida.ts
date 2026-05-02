import {
  actualizarCita,
  actualizarHeartbeatCuenta,
  cancelarSeguimiento,
  contarMensajesEnviadosHoyCuenta,
  contarMensajesUsuarioPosteriores,
  encolarBandejaSalida,
  insertarMensaje,
  listarCitasParaRecordar,
  listarCuentas,
  listarSeguimientosPendientesDue,
  marcarSeguimientoEnviado,
  marcarSeguimientoFallido,
  obtenerConversacionPorId,
  obtenerCuenta,
} from "@/lib/baseDatos";
import { obtenerGestor } from "@/lib/baileys/gestor";

interface EstadoCicloVida {
  arrancando: boolean;
  arrancado: boolean;
  intervaloBandeja: NodeJS.Timeout | null;
  intervaloHeartbeat: NodeJS.Timeout | null;
  intervaloSincronizacion: NodeJS.Timeout | null;
  intervaloSeguimientos: NodeJS.Timeout | null;
  intervaloRecordatoriosCitas: NodeJS.Timeout | null;
  apagado: boolean;
  guardiasInstalados: boolean;
}

// Singleton al alcance del proceso. El módulo puede recargarse en dev
// HMR; mantenemos el estado en globalThis para que sobreviva.
const claveGlobal = "__cicloVidaBot" as const;
type GlobalConCicloVida = typeof globalThis & {
  [claveGlobal]?: EstadoCicloVida;
};
const g = globalThis as GlobalConCicloVida;
if (!g[claveGlobal]) {
  g[claveGlobal] = {
    arrancando: false,
    arrancado: false,
    intervaloBandeja: null,
    intervaloHeartbeat: null,
    intervaloSincronizacion: null,
    intervaloSeguimientos: null,
    intervaloRecordatoriosCitas: null,
    apagado: false,
    guardiasInstalados: false,
  };
}
const estado: EstadoCicloVida = g[claveGlobal]!;

// Reglas anti-ban WhatsApp:
//  - Solo a clientes que escribieron antes (al menos 1 msg user en la conv)
//  - Si los últimos 2 msgs son del bot/humano sin respuesta del cliente → no enviar
//  - Max N mensajes por cuenta por día (configurable, default 80)
//  - Solo enviar entre 8am y 10pm (zona del server, no del cliente — simplificación)
const LIMITE_DIARIO_POR_CUENTA = 80;
const HORA_INICIO = 8;
const HORA_FIN = 22;

function dentroHorarioHumano(): boolean {
  const h = new Date().getHours();
  return h >= HORA_INICIO && h < HORA_FIN;
}

/**
 * Procesa los seguimientos cuya fecha programada ya pasó.
 * Aplica reglas anti-ban antes de poner el mensaje en bandeja_salida.
 * Llamado cada 30s desde el scheduler.
 */
async function procesarSeguimientosPendientes(): Promise<void> {
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
async function procesarRecordatoriosCitas(): Promise<void> {
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

async function emitirHeartbeats(): Promise<void> {
  // Salud del bot ≠ salud del socket. Mientras el proceso esté vivo,
  // marcamos heartbeat para TODAS las cuentas no archivadas, aunque
  // su socket no haya conectado todavía. El estado del socket por
  // cuenta vive aparte en cuentas.estado.
  try {
    const cuentas = await listarCuentas();
    for (const cuenta of cuentas) {
      try {
        await actualizarHeartbeatCuenta(cuenta.id);
      } catch (err) {
        console.error(`[bot] error en heartbeat cuenta ${cuenta.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[bot] error leyendo cuentas para heartbeat:", err);
  }
}

function instalarGuardias(): void {
  if (estado.guardiasInstalados) return;
  estado.guardiasInstalados = true;
  process.on("uncaughtException", (err) => {
    console.error("[bot] uncaughtException:", err);
  });
  process.on("unhandledRejection", (razon) => {
    console.error("[bot] unhandledRejection:", razon);
  });
  const apagar = async () => {
    if (estado.apagado) return;
    estado.apagado = true;
    console.log("\n[bot] Apagando...");
    if (estado.intervaloBandeja) clearInterval(estado.intervaloBandeja);
    if (estado.intervaloHeartbeat) clearInterval(estado.intervaloHeartbeat);
    if (estado.intervaloSincronizacion)
      clearInterval(estado.intervaloSincronizacion);
    if (estado.intervaloSeguimientos)
      clearInterval(estado.intervaloSeguimientos);
    if (estado.intervaloRecordatoriosCitas)
      clearInterval(estado.intervaloRecordatoriosCitas);
    try {
      await obtenerGestor().apagarTodo();
    } catch {
      // ignorar
    }
  };
  process.on("SIGINT", () => {
    void apagar().then(() => process.exit(0));
  });
  process.on("SIGTERM", () => {
    void apagar().then(() => process.exit(0));
  });
}

/**
 * Arranca el bot dentro del proceso actual. Idempotente: llamadas
 * repetidas no duplican intervals ni sockets. Pensado para correr
 * tanto desde scripts/iniciar-bot.ts (proceso suelto) como desde
 * src/instrumentation.ts (mismo proceso que Next.js).
 */
export async function arrancarBotEnProceso(): Promise<void> {
  if (estado.arrancado || estado.arrancando) return;
  estado.arrancando = true;
  instalarGuardias();
  try {
    console.log("[bot] Arrancando agente WhatsApp multi-cuenta...");
    if (!process.env.OPENAI_API_KEY) {
      console.warn(
        "[bot] ⚠ OPENAI_API_KEY no está definida. Las respuestas IA fallarán.",
      );
    }
    const gestor = obtenerGestor();
    await gestor.iniciar();
    const activas = gestor.cuentasActivas();
    if (activas.length === 0) {
      const cuentas = await listarCuentas();
      if (cuentas.length === 0) {
        console.log(
          "[bot] No hay cuentas creadas. Agregá la primera desde el panel.",
        );
      } else {
        console.log(
          `[bot] Hay ${cuentas.length} cuenta(s) en DB pero ninguna activa todavía.`,
        );
      }
    } else {
      console.log(
        `[bot] ${activas.length} cuenta(s) activa(s): [${activas.join(", ")}]`,
      );
    }

    estado.intervaloBandeja = setInterval(async () => {
      try {
        await gestor.procesarBandejasDeSalida();
      } catch (err) {
        console.error("[bot] error procesando bandejas de salida:", err);
      }
    }, 2000);

    await emitirHeartbeats();
    estado.intervaloHeartbeat = setInterval(() => {
      void emitirHeartbeats();
    }, 5000);

    estado.intervaloSincronizacion = setInterval(async () => {
      try {
        await gestor.sincronizar();
      } catch (err) {
        console.error("[bot] error en sincronización:", err);
      }
    }, 3000);

    // Seguimientos programados: cada 30s revisa los que ya están due
    estado.intervaloSeguimientos = setInterval(() => {
      void procesarSeguimientosPendientes().catch((err) => {
        console.error("[bot] error procesando seguimientos:", err);
      });
    }, 30_000);

    // Recordatorios de citas: cada 60s revisa citas en la próxima hora
    estado.intervaloRecordatoriosCitas = setInterval(() => {
      void procesarRecordatoriosCitas().catch((err) => {
        console.error("[bot] error recordatorios citas:", err);
      });
    }, 60_000);

    estado.arrancado = true;
  } finally {
    estado.arrancando = false;
  }
}
