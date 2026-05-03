/**
 * Acceso a créditos por cuenta. Usa RPCs de Supabase para garantizar
 * atomicidad (descontar + loggear en una sola transacción con FOR UPDATE).
 *
 * NUNCA hacer "select saldo + if > costo + update saldo" desde JS — eso
 * abre race condition. Siempre `descontarCreditos()`.
 */
import { db, lanzar } from "./cliente";

export interface SaldoCreditos {
  cuenta_id: string;
  saldo_actual: number;
  saldo_mensual: number;
  proximo_reset: string;
  actualizado_en: string;
}

export interface FilaUsoCreditos {
  id: string;
  cuenta_id: string;
  tipo: string;
  costo_creditos: number;
  costo_usd: number | null;
  metadata: Record<string, unknown>;
  creado_en: string;
}

/**
 * Devuelve el saldo de la cuenta. Si la fila no existe (caso borde
 * post-backfill), devuelve null — el caller decide si recrearla.
 */
export async function obtenerSaldo(
  cuentaId: string,
): Promise<SaldoCreditos | null> {
  const { data, error } = await db()
    .from("creditos")
    .select("*")
    .eq("cuenta_id", cuentaId)
    .maybeSingle();
  if (error) lanzar(error, "obtenerSaldo");
  return (data as SaldoCreditos) ?? null;
}

/**
 * Descuenta créditos de forma atómica. Devuelve true si OK, false si
 * no hay saldo suficiente. Siempre chequear el bool antes de invocar
 * la API que cuesta plata.
 */
export async function descontarCreditos(
  cuentaId: string,
  tipo: string,
  costoCreditos: number,
  opciones?: {
    costoUsd?: number;
    metadata?: Record<string, unknown>;
  },
): Promise<boolean> {
  const { data, error } = await db().rpc("descontar_creditos", {
    p_cuenta_id: cuentaId,
    p_tipo: tipo,
    p_costo_creditos: costoCreditos,
    p_costo_usd: opciones?.costoUsd ?? null,
    p_metadata: opciones?.metadata ?? {},
  });
  if (error) lanzar(error, "descontarCreditos");
  return data === true;
}

/**
 * Suma créditos al saldo. Usar para renovación mensual, regalo de
 * onboarding, o reintegro tras un job que falló.
 */
export async function agregarCreditos(
  cuentaId: string,
  cantidad: number,
): Promise<void> {
  if (cantidad <= 0) {
    throw new Error("[creditos] cantidad debe ser positiva");
  }
  const { error } = await db().rpc("agregar_creditos", {
    p_cuenta_id: cuentaId,
    p_cantidad: cantidad,
  });
  if (error) lanzar(error, "agregarCreditos");
}

/**
 * Lista los últimos N consumos de la cuenta, más recientes primero.
 * Para mostrar en la página de "Mis créditos".
 */
export async function listarUsoCreditos(
  cuentaId: string,
  limite = 50,
): Promise<FilaUsoCreditos[]> {
  const { data, error } = await db()
    .from("uso_creditos")
    .select("*")
    .eq("cuenta_id", cuentaId)
    .order("creado_en", { ascending: false })
    .limit(limite);
  if (error) lanzar(error, "listarUsoCreditos");
  return (data ?? []) as FilaUsoCreditos[];
}
