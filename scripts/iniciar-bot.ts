import "./cargador-entorno";
import {
  actualizarHeartbeatCuenta,
  listarCuentas,
} from "../src/lib/baseDatos";
import { obtenerGestor } from "../src/lib/baileys/gestor";

const gestor = obtenerGestor();

let intervaloBandeja: NodeJS.Timeout | null = null;
let intervaloHeartbeat: NodeJS.Timeout | null = null;
let intervaloSincronizacion: NodeJS.Timeout | null = null;
let detenido = false;

async function arrancar(): Promise<void> {
  console.log("[bot] Arrancando agente WhatsApp multi-cuenta...");
  if (!process.env.OPENAI_API_KEY) {
    console.warn(
      "[bot] ⚠ OPENAI_API_KEY no está definida. Las respuestas IA fallarán.",
    );
  }
  await gestor.iniciar();
  const activas = gestor.cuentasActivas();
  if (activas.length === 0) {
    const cuentas = listarCuentas();
    if (cuentas.length === 0) {
      console.log(
        "[bot] No hay cuentas creadas. Agregá la primera desde el panel en localhost:3000.",
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
}

function programarBandeja(): void {
  intervaloBandeja = setInterval(async () => {
    try {
      await gestor.procesarBandejasDeSalida();
    } catch (err) {
      console.error("[bot] error procesando bandejas de salida:", err);
    }
  }, 2000);
}

function emitirHeartbeats(): void {
  // Salud del bot ≠ salud del socket. Mientras este proceso esté vivo,
  // marcamos heartbeat para TODAS las cuentas no archivadas, aunque
  // su socket todavía no haya conectado (ej: cuenta recién creada
  // esperando QR). El estado de cada conexión WhatsApp se reporta
  // aparte en cuenta.estado ('qr' / 'conectando' / 'conectado' / etc).
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

function programarHeartbeat(): void {
  // Emisión inmediata para que el panel no muestre "bot inactivo"
  // durante los primeros 5 segundos después del arranque.
  emitirHeartbeats();
  intervaloHeartbeat = setInterval(emitirHeartbeats, 5000);
}

function programarSincronizacion(): void {
  // Cada 3s revisa si se agregaron/quitaron cuentas desde el panel
  // y mantiene el conjunto de sockets sincronizado.
  intervaloSincronizacion = setInterval(async () => {
    try {
      await gestor.sincronizar();
    } catch (err) {
      console.error("[bot] error en sincronización:", err);
    }
  }, 3000);
}

async function apagado(): Promise<void> {
  if (detenido) return;
  detenido = true;
  console.log("\n[bot] Apagando...");
  if (intervaloBandeja) clearInterval(intervaloBandeja);
  if (intervaloHeartbeat) clearInterval(intervaloHeartbeat);
  if (intervaloSincronizacion) clearInterval(intervaloSincronizacion);
  try {
    await gestor.apagarTodo();
  } catch {
    // ignorar
  }
  process.exit(0);
}

process.on("SIGINT", apagado);
process.on("SIGTERM", apagado);

process.on("uncaughtException", (err) => {
  console.error("[bot] uncaughtException:", err);
});
process.on("unhandledRejection", (razon) => {
  console.error("[bot] unhandledRejection:", razon);
});

arrancar()
  .then(() => {
    programarBandeja();
    programarHeartbeat();
    programarSincronizacion();
  })
  .catch((err) => {
    console.error("[bot] error fatal arrancando el bot:", err);
    process.exit(1);
  });
