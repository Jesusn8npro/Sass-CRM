/**
 * Procesador del reporte diario.
 *
 * Lógica:
 *  1. Lista super-admins activos que NO recibieron reporte hoy.
 *  2. Para cada uno: arma resumen + encola en la bandeja_salida de
 *     UNA cuenta cualquiera del SaaS (necesitamos un número que envíe).
 *  3. Marca al admin como "ya recibió hoy".
 *
 * Se llama desde `cicloVida.ts` cada cierto intervalo. Es idempotente —
 * el flag `ultimo_reporte_diario_en` evita duplicados aunque corra
 * varias veces.
 *
 * Política horaria: el cron corre cada 5 min pero solo dispara entre
 * las 8am y 10am hora local del server (proceso). Fuera de ese rango,
 * skip silencioso.
 */
import { obtenerMetricasGlobales } from "./reportes";
import { formatearReporteDiario } from "./reportesFormato";
import {
  encolarBandejaSalida,
  listarSuperAdminsPendientesReporte,
  marcarReporteDiarioEnviado,
  obtenerOCrearConversacion,
  registrarAccionAdmin,
} from "@/lib/baseDatos";
import { db } from "@/lib/db/cliente";

const HORA_INICIO_ENVIO = 8; // 8am
const HORA_FIN_ENVIO = 10; // 10am

/**
 * Devuelve la primera cuenta WhatsApp del SaaS que esté activa y
 * conectada (heartbeat fresco). Usamos esta cuenta como "remitente"
 * de los reportes — el super-admin recibe el mensaje en su WhatsApp
 * desde uno de los números del SaaS.
 *
 * Si no hay ninguna cuenta conectada, devolvemos null y el cron
 * salta este ciclo (vuelve a probar al próximo).
 */
async function obtenerCuentaRemitente(): Promise<{
  id: string;
  telefono: string | null;
} | null> {
  const heartbeatVivo = Math.floor(Date.now() / 1000) - 120; // 2 min
  const { data, error } = await db()
    .from("cuentas")
    .select("id, telefono, ultimo_heartbeat")
    .eq("esta_archivada", false)
    .eq("esta_activa", true)
    .not("telefono", "is", null)
    .gte("ultimo_heartbeat", heartbeatVivo)
    .order("ultimo_heartbeat", { ascending: false })
    .limit(1);
  if (error) {
    console.error("[reporteDiario] error obteniendo cuenta remitente:", error);
    return null;
  }
  const fila = (data ?? [])[0] as
    | { id: string; telefono: string | null }
    | undefined;
  return fila ?? null;
}

/**
 * Ejecuta una pasada del cron. Idempotente — solo manda a los admins
 * que NO recibieron reporte hoy, y solo dentro de la ventana horaria.
 */
export async function procesarReporteDiario(): Promise<void> {
  const ahora = new Date();
  const hora = ahora.getHours();

  // Fuera de ventana horaria → skip silencioso
  if (hora < HORA_INICIO_ENVIO || hora >= HORA_FIN_ENVIO) return;

  const pendientes = await listarSuperAdminsPendientesReporte();
  if (pendientes.length === 0) return; // Ya recibieron todos

  const remitente = await obtenerCuentaRemitente();
  if (!remitente) {
    console.warn(
      "[reporteDiario] no hay cuenta WA conectada — skip ciclo, reintenta en 5 min",
    );
    return;
  }

  console.log(
    `[reporteDiario] enviando reporte a ${pendientes.length} admin(s) desde cuenta ${remitente.id}`,
  );

  const metricas = await obtenerMetricasGlobales();
  const texto = formatearReporteDiario(metricas);

  for (const admin of pendientes) {
    try {
      // Conversación entre la cuenta remitente y el teléfono del admin.
      // Si ya existe, la reutiliza; si no, la crea.
      const conv = await obtenerOCrearConversacion(
        remitente.id,
        admin.telefono_whatsapp,
        admin.nombre ?? "Super Admin",
        `${admin.telefono_whatsapp}@s.whatsapp.net`,
      );

      await encolarBandejaSalida(
        remitente.id,
        conv.id,
        admin.telefono_whatsapp,
        texto,
        { tipo: "texto", media_path: null },
      );

      await marcarReporteDiarioEnviado(admin.id);

      void registrarAccionAdmin({
        superAdminId: admin.id,
        origen: "cron",
        accion: "reporte_diario",
        payload: { cuenta_remitente_id: remitente.id },
        resultado: { mensaje_encolado: true, conv_id: conv.id },
      });

      console.log(
        `[reporteDiario] ✓ reporte encolado para ${admin.email} (+${admin.telefono_whatsapp})`,
      );
    } catch (err) {
      const detalle = err instanceof Error ? err.message : String(err);
      console.error(
        `[reporteDiario] error mandando a ${admin.email}:`,
        detalle,
      );
      void registrarAccionAdmin({
        superAdminId: admin.id,
        origen: "cron",
        accion: "reporte_diario",
        error: detalle.slice(0, 500),
      });
    }
  }
}
