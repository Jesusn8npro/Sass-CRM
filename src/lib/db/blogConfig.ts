import { db, lanzar } from "./cliente";

export interface BlogConfig {
  activo: boolean;
  horas: number[];
  dias_semana: number[];
  max_por_dia: number;
  longitud: "corto" | "medio" | "largo";
  tier_portada: "pro" | "estandar";
  modo_imagenes: "sin-imagenes" | "solo-portada" | "completo";
  actualizado_en: string;
}

export async function obtenerBlogConfig(): Promise<BlogConfig> {
  const { data, error } = await db()
    .from("blog_config")
    .select("*")
    .eq("id", 1)
    .single();
  if (error) lanzar(error, "obtenerBlogConfig");
  return data as BlogConfig;
}

export async function actualizarBlogConfig(
  cambios: Partial<Omit<BlogConfig, "actualizado_en">>,
): Promise<BlogConfig> {
  const { data, error } = await db()
    .from("blog_config")
    .update(cambios)
    .eq("id", 1)
    .select()
    .single();
  if (error) lanzar(error, "actualizarBlogConfig");
  return data as BlogConfig;
}

/** Retorna true si el cron debe ejecutarse ahora según la config. */
export function debeEjecutarAhora(config: BlogConfig): boolean {
  if (!config.activo) return false;
  const ahora = new Date();
  const horaUTC = ahora.getUTCHours();
  const diaUTC = ahora.getUTCDay();
  return config.horas.includes(horaUTC) && config.dias_semana.includes(diaUTC);
}
