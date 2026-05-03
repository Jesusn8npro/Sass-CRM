/**
 * Threads del wizard conversacional de configuración del agente IA.
 * 1 thread por cuenta — al cerrar y volver, retoma donde quedó.
 */
import { db, lanzar } from "./cliente";

export interface ThreadConfig {
  id: string;
  cuenta_id: string;
  mensajes: Array<{ role: string; content: unknown }>;
  config_parcial: Record<string, unknown>;
  completado: boolean;
  actualizado_en: string;
}

export async function obtenerThreadConfig(
  cuentaId: string,
): Promise<ThreadConfig | null> {
  const { data, error } = await db()
    .from("threads_config")
    .select("*")
    .eq("cuenta_id", cuentaId)
    .maybeSingle();
  if (error) lanzar(error, "obtenerThreadConfig");
  return (data as ThreadConfig) ?? null;
}

export async function guardarThreadConfig(
  cuentaId: string,
  cambios: {
    mensajes?: ThreadConfig["mensajes"];
    config_parcial?: ThreadConfig["config_parcial"];
    completado?: boolean;
  },
): Promise<void> {
  const fila: Record<string, unknown> = {
    cuenta_id: cuentaId,
    actualizado_en: new Date().toISOString(),
  };
  if (cambios.mensajes !== undefined) fila.mensajes = cambios.mensajes;
  if (cambios.config_parcial !== undefined) {
    fila.config_parcial = cambios.config_parcial;
  }
  if (cambios.completado !== undefined) fila.completado = cambios.completado;

  const { error } = await db()
    .from("threads_config")
    .upsert(fila, { onConflict: "cuenta_id" });
  if (error) lanzar(error, "guardarThreadConfig");
}

export async function reiniciarThreadConfig(
  cuentaId: string,
): Promise<void> {
  const { error } = await db()
    .from("threads_config")
    .delete()
    .eq("cuenta_id", cuentaId);
  if (error) lanzar(error, "reiniciarThreadConfig");
}
