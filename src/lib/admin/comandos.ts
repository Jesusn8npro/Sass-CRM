/**
 * Parser de comandos del super-admin (canal WhatsApp).
 *
 * Convención: el admin escribe `/comando argumento1 argumento2 ...`
 * Los comandos son case-insensitive. Si el mensaje no empieza con `/`
 * o no matchea un comando conocido, devolvemos `null` → el manejador
 * decide qué hacer (ayuda contextual, fallback IA, etc).
 */
import {
  obtenerMetricasGlobales,
  listarCuentasCaidas,
} from "./reportes";
import {
  formatearAyuda,
  formatearAlertas,
  formatearCuentas,
  formatearIngresos,
  formatearReporteDiario,
  formatearUsuarios,
} from "./reportesFormato";
import {
  ejecutarBorradores,
  ejecutarPostBlog,
  ejecutarPublicar,
} from "./comandosBlog";

export type ComandoAdmin =
  | "reporte"
  | "usuarios"
  | "cuentas"
  | "ingresos"
  | "alertas"
  | "ayuda"
  | "post"
  | "borradores"
  | "publicar";

export interface ComandoParseado {
  comando: ComandoAdmin;
  args: string[];
  textoOriginal: string;
}

/**
 * Mapeo de aliases → comando canónico. Aliases son palabras (sin `/`)
 * que también disparan el comando (más natural para escribir).
 */
const ALIASES: Record<string, ComandoAdmin> = {
  reporte: "reporte",
  resumen: "reporte",
  hoy: "reporte",
  diario: "reporte",
  usuarios: "usuarios",
  users: "usuarios",
  clientes: "usuarios",
  cuentas: "cuentas",
  numeros: "cuentas",
  whatsapps: "cuentas",
  ingresos: "ingresos",
  facturacion: "ingresos",
  ventas: "ingresos",
  alertas: "alertas",
  caidas: "alertas",
  errores: "alertas",
  ayuda: "ayuda",
  help: "ayuda",
  comandos: "ayuda",
  menu: "ayuda",
  post: "post",
  articulo: "post",
  blog: "post",
  borradores: "borradores",
  drafts: "borradores",
  publicar: "publicar",
  publish: "publicar",
};

/**
 * Parsea un texto entrante del super-admin.
 * Devuelve null si no se reconoce — el caller debe responder con ayuda.
 */
export function parsearComandoAdmin(texto: string): ComandoParseado | null {
  if (!texto || typeof texto !== "string") return null;
  const limpio = texto.trim();
  if (limpio.length === 0) return null;

  // Aceptamos `/comando args` y también `comando args` (natural)
  const sinSlash = limpio.startsWith("/") ? limpio.slice(1) : limpio;
  const partes = sinSlash
    .toLowerCase()
    .split(/\s+/)
    .filter((p) => p.length > 0);
  if (partes.length === 0) return null;

  const primera = partes[0]!;
  const comando = ALIASES[primera];
  if (!comando) return null;

  return {
    comando,
    args: partes.slice(1),
    textoOriginal: limpio,
  };
}

/**
 * Ejecuta un comando parseado y devuelve la respuesta lista para enviar
 * por WhatsApp (string ya formateado).
 *
 * Algunos comandos (post) requieren contexto del super-admin que los
 * dispara, por eso recibimos `contexto` opcional.
 *
 * Si el comando falla, devuelve un mensaje de error legible.
 */
export async function ejecutarComandoAdmin(
  cmd: ComandoParseado,
  contexto?: { superAdminEmail: string; superAdminNombre: string | null },
): Promise<{ respuesta: string; resultado: Record<string, unknown> }> {
  try {
    switch (cmd.comando) {
      case "reporte": {
        const m = await obtenerMetricasGlobales();
        return {
          respuesta: formatearReporteDiario(m),
          resultado: { metricas: m as unknown as Record<string, unknown> },
        };
      }
      case "usuarios": {
        const m = await obtenerMetricasGlobales();
        return {
          respuesta: formatearUsuarios(m),
          resultado: {
            usuarios_total: m.usuarios_total,
            usuarios_con_cuenta: m.usuarios_con_cuenta,
            usuarios_nuevos_24h: m.usuarios_nuevos_24h,
          },
        };
      }
      case "cuentas": {
        const m = await obtenerMetricasGlobales();
        return {
          respuesta: formatearCuentas(m),
          resultado: {
            cuentas_total: m.cuentas_total,
            cuentas_conectadas: m.cuentas_conectadas,
            cuentas_caidas: m.cuentas_caidas,
          },
        };
      }
      case "ingresos": {
        const m = await obtenerMetricasGlobales();
        return {
          respuesta: formatearIngresos(m),
          resultado: {
            ingresos_mes_usd: m.ingresos_mes_usd,
            pagos_mes_count: m.pagos_mes_count,
          },
        };
      }
      case "alertas": {
        const caidas = await listarCuentasCaidas();
        return {
          respuesta: formatearAlertas(caidas),
          resultado: { cuentas_caidas: caidas.length },
        };
      }
      case "ayuda": {
        return { respuesta: formatearAyuda(), resultado: {} };
      }
      case "post": {
        // El tema es todo lo que vino después de "/post"
        const tema = cmd.args.join(" ");
        return ejecutarPostBlog(
          tema,
          contexto?.superAdminEmail ?? "admin@saas",
          contexto?.superAdminNombre ?? null,
        );
      }
      case "borradores": {
        return ejecutarBorradores();
      }
      case "publicar": {
        const idOPrefijo = cmd.args[0] ?? "";
        return ejecutarPublicar(idOPrefijo);
      }
      default: {
        const _exhaustive: never = cmd.comando;
        void _exhaustive;
        return { respuesta: formatearAyuda(), resultado: {} };
      }
    }
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    return {
      respuesta: `❌ Error ejecutando /${cmd.comando}\n\n${detalle.slice(0, 200)}`,
      resultado: { error: detalle },
    };
  }
}
