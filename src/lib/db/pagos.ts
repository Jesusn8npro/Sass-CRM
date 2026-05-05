import { db, lanzar } from "./cliente";

export type TipoPago = "suscripcion" | "recarga_creditos" | "renovacion" | "reembolso";
export type EstadoPago = "pendiente" | "aprobado" | "fallido" | "reembolsado" | "cancelado";

export interface FilaPago {
  id: string;
  usuario_id: string;
  cuenta_id: string | null;
  tipo: TipoPago;
  pasarela: "paypal" | "epayco";
  monto_usd: number;
  creditos_otorgados: number;
  estado: EstadoPago;
  paypal_order_id: string | null;
  paypal_subscription_id: string | null;
  paypal_capture_id: string | null;
  metadata: Record<string, unknown>;
  creado_en: string;
  procesado_en: string | null;
}

export async function crearPagoPendiente(p: {
  usuarioId: string;
  cuentaId?: string | null;
  tipo: TipoPago;
  montoUsd: number;
  creditosOtorgados?: number;
  paypalOrderId?: string;
  paypalSubscriptionId?: string;
  metadata?: Record<string, unknown>;
}): Promise<FilaPago> {
  const { data, error } = await db()
    .from("pagos")
    .insert({
      usuario_id: p.usuarioId,
      cuenta_id: p.cuentaId ?? null,
      tipo: p.tipo,
      pasarela: "paypal",
      monto_usd: p.montoUsd,
      creditos_otorgados: p.creditosOtorgados ?? 0,
      estado: "pendiente",
      paypal_order_id: p.paypalOrderId ?? null,
      paypal_subscription_id: p.paypalSubscriptionId ?? null,
      metadata: p.metadata ?? {},
    })
    .select()
    .single();
  if (error) lanzar(error, "crearPagoPendiente");
  return data as FilaPago;
}

export async function marcarPagoAprobado(
  id: string,
  cambios: { paypalCaptureId?: string; metadata?: Record<string, unknown> },
): Promise<void> {
  const update: Record<string, unknown> = {
    estado: "aprobado",
    procesado_en: new Date().toISOString(),
  };
  if (cambios.paypalCaptureId) update.paypal_capture_id = cambios.paypalCaptureId;
  if (cambios.metadata) update.metadata = cambios.metadata;
  const { error } = await db().from("pagos").update(update).eq("id", id);
  if (error) lanzar(error, "marcarPagoAprobado");
}

export async function marcarPagoFallido(id: string, motivo: string): Promise<void> {
  const { error } = await db()
    .from("pagos")
    .update({
      estado: "fallido",
      procesado_en: new Date().toISOString(),
      metadata: { motivo },
    })
    .eq("id", id);
  if (error) lanzar(error, "marcarPagoFallido");
}

export async function obtenerPagoPorOrderId(
  orderId: string,
): Promise<FilaPago | null> {
  const { data, error } = await db()
    .from("pagos")
    .select("*")
    .eq("paypal_order_id", orderId)
    .maybeSingle();
  if (error) lanzar(error, "obtenerPagoPorOrderId");
  return (data as FilaPago) ?? null;
}

export async function obtenerPagoPorSubscriptionId(
  subId: string,
): Promise<FilaPago | null> {
  const { data, error } = await db()
    .from("pagos")
    .select("*")
    .eq("paypal_subscription_id", subId)
    .order("creado_en", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) lanzar(error, "obtenerPagoPorSubscriptionId");
  return (data as FilaPago) ?? null;
}

export async function listarPagosUsuario(
  usuarioId: string,
  limite = 50,
): Promise<FilaPago[]> {
  const { data, error } = await db()
    .from("pagos")
    .select("*")
    .eq("usuario_id", usuarioId)
    .order("creado_en", { ascending: false })
    .limit(limite);
  if (error) lanzar(error, "listarPagosUsuario");
  return (data ?? []) as FilaPago[];
}

export interface PaqueteCreditos {
  id: string;
  nombre: string;
  creditos: number;
  precio_usd: number;
  destacado: boolean;
  orden: number;
}

export async function listarPaquetesActivos(): Promise<PaqueteCreditos[]> {
  const { data, error } = await db()
    .from("paquetes_creditos")
    .select("*")
    .eq("activo", true)
    .order("orden", { ascending: true });
  if (error) {
    // La migración 08 aún no se aplicó: devolvemos vacío en lugar de 500.
    if (error.code === "42P01" || error.code === "PGRST205") return [];
    lanzar(error, "listarPaquetesActivos");
  }
  return (data ?? []) as PaqueteCreditos[];
}

export async function obtenerPaquete(id: string): Promise<PaqueteCreditos | null> {
  const { data, error } = await db()
    .from("paquetes_creditos")
    .select("*")
    .eq("id", id)
    .eq("activo", true)
    .maybeSingle();
  if (error) lanzar(error, "obtenerPaquete");
  return (data as PaqueteCreditos) ?? null;
}
