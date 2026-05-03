import { db, lanzar } from "./cliente";
import type { FilaBandejaSalida, TipoMensaje } from "./tipos";

export async function encolarBandejaSalida(
  cuentaId: string,
  conversacionId: string,
  telefono: string,
  contenido: string,
  opciones?: { tipo?: TipoMensaje; media_path?: string | null },
): Promise<string> {
  const { data, error } = await db()
    .from("bandeja_salida")
    .insert({
      cuenta_id: cuentaId,
      conversacion_id: conversacionId,
      telefono,
      tipo: opciones?.tipo ?? "texto",
      contenido,
      media_path: opciones?.media_path ?? null,
    })
    .select("id")
    .single();
  if (error) lanzar(error, "encolarBandejaSalida");
  return (data as { id: string }).id;
}

export async function obtenerPendientesBandejaDeCuenta(
  cuentaId: string,
  limite = 20,
): Promise<FilaBandejaSalida[]> {
  const { data, error } = await db()
    .from("bandeja_salida")
    .select("*")
    .eq("cuenta_id", cuentaId)
    .eq("enviado", false)
    .order("creado_en", { ascending: true })
    .limit(limite);
  if (error) lanzar(error, "obtenerPendientesBandejaDeCuenta");
  return (data ?? []) as FilaBandejaSalida[];
}

export async function marcarBandejaEnviado(id: string): Promise<void> {
  const { error } = await db()
    .from("bandeja_salida")
    .update({ enviado: true })
    .eq("id", id);
  if (error) lanzar(error, "marcarBandejaEnviado");
}
