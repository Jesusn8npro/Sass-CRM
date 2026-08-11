/**
 * DAO de los eventos de negocio que llegan desde el sitio/base del cliente.
 *
 * Un evento es "algo pasó en mi negocio y quiero enterarme por WhatsApp":
 * se registró un usuario, alguien inició una compra, un pago quedó pendiente.
 * El webhook público `/api/eventos/negocio` los recibe, los guarda acá y
 * dispara la alerta al teléfono del operador privado.
 *
 * Requiere la migración 41. Si todavía no se aplicó, las lecturas degradan
 * a "sin token" y el registro es silencioso — igual que el resto del proyecto,
 * una migración pendiente no puede tumbar el bot.
 */
import { randomBytes } from "crypto";
import { db, lanzar } from "./cliente";

/** Un evento recibido, ya normalizado. */
export interface EventoNegocio {
  id: string;
  cuenta_id: string;
  tipo: string;
  titulo: string | null;
  datos: Record<string, unknown>;
  notificado: boolean;
  motivo: string | null;
  creado_en: string;
}

function esErrorColumnaInexistente(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string };
  if (e.code === "42703" || e.code === "PGRST204" || e.code === "42P01") return true;
  return (
    typeof e.message === "string" &&
    /(column|relation) .* does not exist/i.test(e.message)
  );
}

/**
 * Resuelve la cuenta dueña de un token de eventos. Devuelve null si el token
 * está vacío, no existe, o la migración 41 no fue aplicada.
 */
export async function obtenerCuentaPorTokenEventos(
  token: string,
): Promise<string | null> {
  const limpio = (token ?? "").trim();
  // Sin este corte, un token vacío haría `.eq(col, "")` y podría casar con
  // filas que tengan cadena vacía en vez de null.
  if (limpio.length < 16) return null;

  const { data, error } = await db()
    .from("cuentas")
    .select("id")
    .eq("token_eventos", limpio)
    .maybeSingle();
  if (error) {
    if (esErrorColumnaInexistente(error)) return null;
    lanzar(error, "obtenerCuentaPorTokenEventos");
  }
  return (data?.id as string) ?? null;
}

/** Genera y guarda un token nuevo para la cuenta. Devuelve el token en claro. */
export async function regenerarTokenEventos(cuentaId: string): Promise<string> {
  const token = `evt_${randomBytes(24).toString("hex")}`;
  const { error } = await db()
    .from("cuentas")
    .update({ token_eventos: token })
    .eq("id", cuentaId);
  if (error) lanzar(error, "regenerarTokenEventos");
  return token;
}

/** Guarda el evento recibido. Fire-and-forget: nunca tira. */
export async function registrarEventoNegocio(parametros: {
  cuentaId: string;
  tipo: string;
  titulo: string | null;
  datos: Record<string, unknown>;
  notificado: boolean;
  motivo?: string | null;
}): Promise<void> {
  try {
    await db().from("eventos_negocio").insert({
      cuenta_id: parametros.cuentaId,
      tipo: parametros.tipo,
      titulo: parametros.titulo,
      datos: parametros.datos,
      notificado: parametros.notificado,
      motivo: parametros.motivo ?? null,
    });
  } catch {
    /* la migración 41 puede no estar aplicada — no rompemos el webhook */
  }
}

/** Últimos eventos de la cuenta, para el panel. */
export async function listarEventosNegocio(
  cuentaId: string,
  limite = 50,
): Promise<EventoNegocio[]> {
  const { data, error } = await db()
    .from("eventos_negocio")
    .select("*")
    .eq("cuenta_id", cuentaId)
    .order("creado_en", { ascending: false })
    .limit(Math.min(200, Math.max(1, limite)));
  if (error) {
    if (esErrorColumnaInexistente(error)) return [];
    lanzar(error, "listarEventosNegocio");
  }
  return (data ?? []) as EventoNegocio[];
}
