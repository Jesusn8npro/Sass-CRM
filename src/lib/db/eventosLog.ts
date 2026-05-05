/**
 * Eventos de log para visibilidad operativa del SaaS.
 *
 * `registrarEvento` es fire-and-forget: NUNCA tira ni bloquea el flujo
 * principal. Si la migración 19 no está aplicada en este proyecto, el
 * insert falla silenciosamente.
 *
 * `listarEventosLog` es para el endpoint admin /api/admin/logs.
 */
import { db, lanzar } from "./cliente";

export type NivelEvento = "info" | "warn" | "error" | "critical";

export interface EventoLog {
  id: string;
  cuenta_id: string | null;
  nivel: NivelEvento;
  contexto: string;
  mensaje: string;
  metadata: Record<string, unknown> | null;
  creado_en: string;
}

export interface RegistroEvento {
  cuentaId?: string | null;
  nivel: NivelEvento;
  contexto: string;
  mensaje: string;
  metadata?: Record<string, unknown>;
}

/**
 * Inserta un evento de log. Fire-and-forget — los errores se loggean
 * pero nunca rompen el flujo del caller. Si la tabla no existe (42P01),
 * absorbe en silencio.
 */
export function registrarEvento(reg: RegistroEvento): void {
  void (async () => {
    try {
      const { error } = await db()
        .from("eventos_log")
        .insert({
          cuenta_id: reg.cuentaId ?? null,
          nivel: reg.nivel,
          contexto: reg.contexto,
          mensaje: reg.mensaje.slice(0, 4000),
          metadata: reg.metadata ?? null,
        });
      if (error) {
        if (error.code !== "42P01" && error.code !== "PGRST205") {
          console.warn("[eventos_log] insert falló:", error.message);
        }
      }
    } catch (err) {
      console.warn("[eventos_log] excepción no fatal:", err);
    }
  })();
}

export interface FiltroEventosLog {
  desde?: string;
  nivel?: NivelEvento;
  cuentaId?: string;
  limite: number;
}

/**
 * Lista eventos para el endpoint admin. Devuelve `{ eventos, total }`.
 * Si la tabla no existe (proyecto legacy), devuelve listado vacío en
 * vez de tirar.
 */
export async function listarEventosLog(
  filtro: FiltroEventosLog,
): Promise<{ eventos: EventoLog[]; total: number }> {
  const limite = Math.max(1, Math.min(500, filtro.limite || 100));
  let q = db()
    .from("eventos_log")
    .select("*", { count: "exact" })
    .order("creado_en", { ascending: false })
    .limit(limite);

  if (filtro.nivel) q = q.eq("nivel", filtro.nivel);
  if (filtro.cuentaId) q = q.eq("cuenta_id", filtro.cuentaId);
  if (filtro.desde) q = q.gte("creado_en", filtro.desde);

  const { data, error, count } = await q;
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") {
      return { eventos: [], total: 0 };
    }
    lanzar(error, "listarEventosLog");
  }
  return {
    eventos: (data ?? []) as EventoLog[],
    total: count ?? 0,
  };
}
