import {
  actualizarHeartbeatCuenta,
  listarCuentas,
} from "@/lib/baseDatos";
import { obtenerGestor } from "@/lib/baileys/gestor";
import {
  procesarAlertasDesconexionOperador,
  procesarLlamadasProgramadas,
  procesarRecordatoriosCitas,
  procesarResumenDiarioOperador,
  procesarSeguimientosPendientes,
} from "./procesadores";
import { procesarAutoSeguimientos } from "./procesarAutoSeguimientos";
import { procesarReporteDiario } from "@/lib/admin/reporteDiario";
import { procesarOutreach } from "@/lib/outreach/orquestador";

interface EstadoCicloVida {
  arrancando: boolean;
  arrancado: boolean;
  intervaloBandeja: NodeJS.Timeout | null;
  intervaloHeartbeat: NodeJS.Timeout | null;
  intervaloSincronizacion: NodeJS.Timeout | null;
  intervaloSeguimientos: NodeJS.Timeout | null;
  intervaloAutoSeguimientos: NodeJS.Timeout | null;
  intervaloRecordatoriosCitas: NodeJS.Timeout | null;
  intervaloLlamadasProgramadas: NodeJS.Timeout | null;
  intervaloOutreach: NodeJS.Timeout | null;
  intervaloReportesSemanales: NodeJS.Timeout | null;
  /** Última semana ISO (YYYY-WW) en la que se disparó el reporte. */
  ultimaSemanaReporte: string | null;
  intervaloResumenOperador: NodeJS.Timeout | null;
  intervaloAlertasDesconexionOperador: NodeJS.Timeout | null;
  intervaloReporteDiarioAdmin: NodeJS.Timeout | null;
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
    intervaloAutoSeguimientos: null,
    intervaloRecordatoriosCitas: null,
    intervaloLlamadasProgramadas: null,
    intervaloOutreach: null,
    intervaloReportesSemanales: null,
    ultimaSemanaReporte: null,
    intervaloResumenOperador: null,
    intervaloAlertasDesconexionOperador: null,
    intervaloReporteDiarioAdmin: null,
    apagado: false,
    guardiasInstalados: false,
  };
}
const estado: EstadoCicloVida = g[claveGlobal]!;

/**
 * Devuelve la clave ISO YYYY-WW del momento dado (semana del lunes
 * ancla por el jueves, ISO 8601). La usamos para asegurar que el
 * disparo del reporte semanal corre UNA sola vez por semana aunque
 * el proceso se reinicie o el chequeo horario corra varias veces.
 */
function claveSemanaIsoActual(d: Date): string {
  const ref = new Date(
    Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()),
  );
  const dia = ref.getUTCDay() || 7;
  ref.setUTCDate(ref.getUTCDate() + 4 - dia);
  const inicioAnio = new Date(Date.UTC(ref.getUTCFullYear(), 0, 1));
  const numero = Math.ceil(
    ((ref.getTime() - inicioAnio.getTime()) / 86400000 + 1) / 7,
  );
  return `${ref.getUTCFullYear()}-W${String(numero).padStart(2, "0")}`;
}

/**
 * Si es lunes ≥ 9am LOCAL del servidor y aún no disparamos el reporte
 * de esta semana, llama al endpoint interno con el secret.
 *
 * En LATAM lo típico es tener TZ del proceso = America/Argentina/Buenos_Aires
 * o similar. Idempotencia real está en Resend (X-Entity-Ref-ID por
 * cuenta+semana), este flag sólo evita HTTPs redundantes.
 */
async function quizasDispararReporteSemanal(): Promise<void> {
  if (process.env.REPORTES_SEMANALES_HABILITADO !== "true") return;
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return;

  const ahora = new Date();
  const esLunes = ahora.getDay() === 1; // 1 = lunes
  const esHoraOk = ahora.getHours() >= 9 && ahora.getHours() < 12;
  if (!esLunes || !esHoraOk) return;

  const semana = claveSemanaIsoActual(ahora);
  if (estado.ultimaSemanaReporte === semana) return;

  const baseUrl = (
    process.env.APP_URL?.trim() ||
    process.env.PUBLIC_URL?.trim() ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
  const url = `${baseUrl}/api/cron/reportes-semanales`;

  // Marcamos ANTES de disparar — si la llamada falla, la corrida
  // siguiente no la repite (los emails individuales son idempotentes
  // en Resend igual). Si querés reintentar tras fallo, comenta esta
  // línea y mové la asignación al ramo `ok`.
  estado.ultimaSemanaReporte = semana;

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "x-cron-secret": secret },
    });
    if (!r.ok) {
      console.warn(
        `[bot] reporte semanal HTTP ${r.status} — no fatal, reintentará la próxima semana`,
      );
    } else {
      const body = await r.json().catch(() => null);
      console.log("[bot] reporte semanal disparado:", body);
    }
  } catch (err) {
    console.warn("[bot] error disparando reporte semanal:", err);
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

/**
 * Detecta unhandledRejections "ruidosas" pero benignas de Baileys.
 * Cuando el socket muere mientras hay queries internas pendientes
 * (sendPassiveIq, waitForMessage), esas Promises rechazan despues
 * con "Timed Out" o "Connection Closed". No rompen nada — el gestor
 * detecta el close y reconecta — pero ensucian los logs.
 *
 * Maneja tanto Error normales como objetos boom (isBoom:true)
 * que Baileys lanza internamente con statusCode 408/428.
 */
function esRechazoBenignoBaileys(razon: unknown): boolean {
  if (!razon || typeof razon !== "object") return false;
  const r = razon as Record<string, unknown>;

  // Mensaje: puede estar en .message o en .output.payload.message (boom)
  const msg =
    (typeof r.message === "string" ? r.message : "") ||
    (typeof (r.output as Record<string, unknown> | undefined)?.payload === "object"
      ? String(((r.output as Record<string, unknown>).payload as Record<string, unknown>).message ?? "")
      : "");

  // Stack: puede estar en .stack o en .data.stack (boom)
  const stack =
    (typeof r.stack === "string" ? r.stack : "") ||
    (typeof (r.data as Record<string, unknown> | undefined)?.stack === "string"
      ? (r.data as Record<string, unknown>).stack as string
      : "");

  // Los boom 408/428 de Baileys son siempre benignos aunque no tengamos msg
  const esBoomBaileys =
    r.isBoom === true &&
    typeof r.output === "object" &&
    ([408, 428].includes(
      Number((r.output as Record<string, unknown>).statusCode),
    )) &&
    (stack.includes("@whiskeysockets") || stack.includes("baileys"));

  if (esBoomBaileys) return true;

  const esTimedOutOClosed =
    msg.includes("Timed Out") ||
    msg.includes("Connection Closed") ||
    msg.includes("Connection Terminated") ||
    msg.includes("Precondition Required") ||
    msg.includes("Stream Errored");

  const vieneDeBaileys =
    stack.includes("@whiskeysockets/baileys") ||
    stack.includes("baileys/lib/Socket") ||
    stack.includes("baileys/lib/Utils");

  return esTimedOutOClosed && vieneDeBaileys;
}

function instalarGuardias(): void {
  if (estado.guardiasInstalados) return;
  estado.guardiasInstalados = true;
  process.on("uncaughtException", (err) => {
    console.error("[bot] uncaughtException:", err);
  });
  process.on("unhandledRejection", (razon) => {
    // Suprimimos TOTAL los rejections internos de Baileys. No loggeamos
    // ni siquiera versiones compactas — son timeouts de queries WS
    // pendientes cuando el socket muere, totalmente benignos. El
    // gestor maneja los closes y reconexiones por separado.
    if (esRechazoBenignoBaileys(razon)) return;
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
    if (estado.intervaloAutoSeguimientos)
      clearInterval(estado.intervaloAutoSeguimientos);
    if (estado.intervaloRecordatoriosCitas)
      clearInterval(estado.intervaloRecordatoriosCitas);
    if (estado.intervaloLlamadasProgramadas)
      clearInterval(estado.intervaloLlamadasProgramadas);
    if (estado.intervaloOutreach)
      clearInterval(estado.intervaloOutreach);
    if (estado.intervaloReportesSemanales)
      clearInterval(estado.intervaloReportesSemanales);
    if (estado.intervaloResumenOperador)
      clearInterval(estado.intervaloResumenOperador);
    if (estado.intervaloAlertasDesconexionOperador)
      clearInterval(estado.intervaloAlertasDesconexionOperador);
    if (estado.intervaloReporteDiarioAdmin)
      clearInterval(estado.intervaloReporteDiarioAdmin);
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
 * repetidas no duplican intervals ni sockets.
 * Disparado desde `src/instrumentation.ts`.
 */
export async function arrancarBotEnProceso(): Promise<void> {
  if (estado.arrancado || estado.arrancando) return;

  // Kill switch para dev local: si vas a trabajar solo en la UI sin
  // pisar la sesión que está corriendo en producción (Easy Panel),
  // poné BOT_ENABLED=false en tu .env.local. El panel sigue funcionando
  // pero el bot Baileys NO arranca → no compite por la sesión.
  if (process.env.BOT_ENABLED === "false") {
    console.log(
      "[bot] ⏸ BOT_ENABLED=false — bot deshabilitado. UI funciona, Baileys no arranca.",
    );
    return;
  }

  estado.arrancando = true;
  instalarGuardias();
  try {
    console.log("[bot] Arrancando agente WhatsApp multi-cuenta...");
    console.log(
      "[bot] 🚀 build v2.6 — anti-duplicado citas, dedupe captura robusto, append messages, auto-correct fecha",
    );
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
    }, 8_000); // era 2s → 8s: misma experiencia real, -75% de queries

    await emitirHeartbeats();
    estado.intervaloHeartbeat = setInterval(() => {
      void emitirHeartbeats();
    }, 60_000); // era 5s → 60s: heartbeat cada minuto es suficiente

    estado.intervaloSincronizacion = setInterval(async () => {
      try {
        await gestor.sincronizar();
      } catch (err) {
        console.error("[bot] error en sincronización:", err);
      }
    }, 30_000); // era 3s → 30s: detectar cuentas nuevas cada 30s es más que suficiente

    // Seguimientos programados: cada 30s revisa los que ya están due
    estado.intervaloSeguimientos = setInterval(() => {
      void procesarSeguimientosPendientes().catch((err) => {
        console.error("[bot] error procesando seguimientos:", err);
      });
    }, 30_000);

    // Auto-seguimientos: cada 2 min revisa qué conversaciones merecen
    // un recordatorio automatico segun los pasos configurados.
    estado.intervaloAutoSeguimientos = setInterval(() => {
      void procesarAutoSeguimientos().catch((err) => {
        console.error("[bot] error en auto-seguimientos:", err);
      });
    }, 120_000);

    // Recordatorios de citas: cada 60s revisa citas en la próxima hora
    estado.intervaloRecordatoriosCitas = setInterval(() => {
      void procesarRecordatoriosCitas().catch((err) => {
        console.error("[bot] error recordatorios citas:", err);
      });
    }, 60_000);

    // Llamadas Vapi programadas: cada 30s revisa las que ya están due
    estado.intervaloLlamadasProgramadas = setInterval(() => {
      void procesarLlamadasProgramadas().catch((err) => {
        console.error("[bot] error procesando llamadas programadas:", err);
      });
    }, 30_000);

    // Orquestador de cold outreach: cada 5 min busca leads nuevos,
    // dispara llamadas Vapi o secuencias de email, y despacha follow-ups.
    estado.intervaloOutreach = setInterval(() => {
      void procesarOutreach().catch((err) => {
        console.error("[bot] error en orquestador outreach:", err);
      });
    }, 5 * 60_000);

    // Reportes semanales: cada hora chequea si es lunes ≥ 9am y dispara
    // el endpoint interno una sola vez por semana ISO. Sólo se activa
    // si REPORTES_SEMANALES_HABILITADO=true en el env.
    estado.intervaloReportesSemanales = setInterval(() => {
      void quizasDispararReporteSemanal().catch((err) => {
        console.error("[bot] error en scheduler reporte semanal:", err);
      });
    }, 3_600_000); // 1 hora

    // Resumen diario al operador privado: cada 60 min chequea si es
    // entre 9 y 10am y manda el resumen del día anterior. Idempotente
    // por día (marcador en mensajes).
    estado.intervaloResumenOperador = setInterval(() => {
      void procesarResumenDiarioOperador().catch((err) => {
        console.error("[bot] error resumen operador:", err);
      });
    }, 60_000 * 60);

    // Alertas de desconexión >5min al operador privado: cada 2 min.
    estado.intervaloAlertasDesconexionOperador = setInterval(() => {
      void procesarAlertasDesconexionOperador().catch((err) => {
        console.error("[bot] error alertas desconexión operador:", err);
      });
    }, 120_000);

    // Reporte diario al SUPER-ADMIN del SaaS: cada 5 min entre 8am y 10am.
    // El procesador es idempotente — solo manda 1 vez por día por admin.
    // Distinto del "resumen operador" (que es por cuenta, dueño del WA);
    // este es el reporte global del dueño de la plataforma.
    estado.intervaloReporteDiarioAdmin = setInterval(() => {
      void procesarReporteDiario().catch((err) => {
        console.error("[bot] error en reporte diario admin:", err);
      });
    }, 5 * 60_000);

    estado.arrancado = true;
  } finally {
    estado.arrancando = false;
  }
}
