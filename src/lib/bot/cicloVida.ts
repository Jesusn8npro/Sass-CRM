import {
  actualizarHeartbeatCuenta,
  listarCuentas,
} from "@/lib/baseDatos";
import { obtenerGestor } from "@/lib/baileys/gestor";

interface EstadoCicloVida {
  arrancando: boolean;
  arrancado: boolean;
  intervaloBandeja: NodeJS.Timeout | null;
  intervaloHeartbeat: NodeJS.Timeout | null;
  intervaloSincronizacion: NodeJS.Timeout | null;
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
    apagado: false,
    guardiasInstalados: false,
  };
}
const estado: EstadoCicloVida = g[claveGlobal]!;

function emitirHeartbeats(): void {
  // Salud del bot ≠ salud del socket. Mientras el proceso esté vivo,
  // marcamos heartbeat para TODAS las cuentas no archivadas, aunque
  // su socket no haya conectado todavía. El estado del socket por
  // cuenta vive aparte en cuentas.estado.
  try {
    const cuentas = listarCuentas();
    for (const cuenta of cuentas) {
      try {
        actualizarHeartbeatCuenta(cuenta.id);
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
      const cuentas = listarCuentas();
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

    emitirHeartbeats();
    estado.intervaloHeartbeat = setInterval(emitirHeartbeats, 5000);

    estado.intervaloSincronizacion = setInterval(async () => {
      try {
        await gestor.sincronizar();
      } catch (err) {
        console.error("[bot] error en sincronización:", err);
      }
    }, 3000);

    estado.arrancado = true;
  } finally {
    estado.arrancando = false;
  }
}
