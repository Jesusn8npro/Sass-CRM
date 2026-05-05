/**
 * Enforcement de límites de plan SaaS.
 *
 * Hoy lo único que enforce-amos es `limite_mensajes_mes` — la cantidad
 * de mensajes que el agente IA puede GENERAR (rol=asistente) en un mes
 * calendario para todas las cuentas de un usuario sumadas.
 *
 * Cuando el usuario alcanza su límite:
 *  - El bot NO genera respuesta nueva (ahorra costos OpenAI/TTS).
 *  - Se inserta un marcador en la conversación.
 *  - Se notifica UNA SOLA VEZ al operador privado por mes.
 *
 * Cuando el usuario llega al 90% del límite:
 *  - Se envía advertencia al operador (también una vez).
 *
 * Cache en memoria de 5min para no contar en cada respuesta — el conteo
 * es eventual-consistent. Acepta sobrepasar el límite por unos pocos
 * mensajes, pero nunca por mucho.
 */
import { db } from "./db/cliente";
import { obtenerPlan } from "./planes";
import {
  obtenerUsuarioApp,
  type Cuenta,
} from "./baseDatos";

interface ResultadoLimite {
  /** Mensajes generados por IA este mes (rol=asistente) en TODAS las cuentas del usuario. */
  usados: number;
  /** Tope del plan. null = ilimitado. */
  limite: number | null;
  /** true si usados >= limite. Bloquea la generación. */
  lleno: boolean;
  /** true si usados >= 90% del límite (mandar advertencia única). */
  cerca: boolean;
  /** Plan id del usuario. */
  plan: string;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { resultado: ResultadoLimite; expira: number }>();

function inicioDelMes(): Date {
  const ahora = new Date();
  return new Date(ahora.getFullYear(), ahora.getMonth(), 1);
}

/**
 * Calcula uso vs límite para un usuario. Resultado cacheado 5 min.
 */
export async function verificarLimiteMensajes(
  usuarioId: string,
): Promise<ResultadoLimite> {
  const ahora = Date.now();
  const cached = cache.get(usuarioId);
  if (cached && cached.expira > ahora) return cached.resultado;

  const usuario = await obtenerUsuarioApp(usuarioId);
  const plan = obtenerPlan(usuario?.plan);
  const limite = Number.isFinite(plan.limite_mensajes_mes)
    ? plan.limite_mensajes_mes
    : null;

  // Si el plan es ilimitado, no consultamos. Devolvemos OK directo.
  if (limite === null) {
    const r: ResultadoLimite = {
      usados: 0,
      limite: null,
      lleno: false,
      cerca: false,
      plan: plan.id,
    };
    cache.set(usuarioId, { resultado: r, expira: ahora + CACHE_TTL_MS });
    return r;
  }

  // Cuentas del usuario (incluye archivadas — el conteo es del histórico
  // del mes, aunque la cuenta luego se archive).
  const { data: cuentas } = await db()
    .from("cuentas")
    .select("id")
    .eq("usuario_id", usuarioId);
  const idsCuentas = (cuentas ?? []).map((c) => (c as { id: string }).id);
  if (idsCuentas.length === 0) {
    const r: ResultadoLimite = {
      usados: 0,
      limite,
      lleno: false,
      cerca: false,
      plan: plan.id,
    };
    cache.set(usuarioId, { resultado: r, expira: ahora + CACHE_TTL_MS });
    return r;
  }

  const desde = inicioDelMes().toISOString();
  const { count } = await db()
    .from("mensajes")
    .select("id", { count: "exact", head: true })
    .in("cuenta_id", idsCuentas)
    .eq("rol", "asistente")
    .gte("creado_en", desde);

  const usados = count ?? 0;
  const lleno = usados >= limite;
  const cerca = !lleno && usados >= Math.round(limite * 0.9);

  const r: ResultadoLimite = { usados, limite, lleno, cerca, plan: plan.id };
  cache.set(usuarioId, { resultado: r, expira: ahora + CACHE_TTL_MS });
  return r;
}

/**
 * Invalida el cache para un usuario. Llamar después de operaciones
 * que afecten el conteo (cambio de plan, mensaje recién enviado).
 */
export function invalidarCacheLimite(usuarioId: string): void {
  cache.delete(usuarioId);
}

/**
 * Helper para registrar un marcador "límite alcanzado" en una
 * conversación de modo que no se notifique 2 veces en el mismo mes.
 */
export async function yaSeNotificoLimite(
  cuentaId: string,
): Promise<boolean> {
  const desde = inicioDelMes().toISOString();
  const marcador = "[limite_plan_alcanzado_mes]";
  const { data } = await db()
    .from("mensajes")
    .select("id")
    .eq("cuenta_id", cuentaId)
    .eq("rol", "sistema")
    .eq("contenido", marcador)
    .gte("creado_en", desde)
    .limit(1);
  return !!(data && data.length > 0);
}

export async function yaSeNotificoCerca(cuentaId: string): Promise<boolean> {
  const desde = inicioDelMes().toISOString();
  const marcador = "[limite_plan_cerca_mes]";
  const { data } = await db()
    .from("mensajes")
    .select("id")
    .eq("cuenta_id", cuentaId)
    .eq("rol", "sistema")
    .eq("contenido", marcador)
    .gte("creado_en", desde)
    .limit(1);
  return !!(data && data.length > 0);
}

/**
 * Texto que el agente envía al cliente cuando se llegó al límite. NO
 * menciona "límite" para no exponer el problema al cliente final —
 * es responsabilidad del dueño resolverlo.
 */
export function mensajeFueraDeServicioCliente(cuenta: Cuenta): string {
  const nombre = cuenta.agente_nombre?.trim() || cuenta.etiqueta;
  return `Hola, ${nombre} está temporalmente fuera de servicio. Te responderemos a la brevedad. Disculpá la demora.`;
}
