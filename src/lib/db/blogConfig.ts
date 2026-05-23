import { sql } from "./sql";

export interface BlogConfig {
  activo: boolean;
  horas: number[];
  minutos: number;
  dias_semana: number[];
  max_por_dia: number;
  longitud: "corto" | "medio" | "largo";
  tier_portada: "pro" | "estandar";
  modo_imagenes: "sin-imagenes" | "solo-portada" | "completo";
  tema_manual: string | null;
  actualizado_en: string;
}

export async function obtenerBlogConfig(): Promise<BlogConfig> {
  const rows = await sql()`SELECT * FROM blog_config WHERE id = 1 LIMIT 1`;
  if (!rows[0]) throw new Error("[db:obtenerBlogConfig] no existe config");
  return rows[0] as BlogConfig;
}

export async function actualizarBlogConfig(
  cambios: Partial<Omit<BlogConfig, "actualizado_en">>,
): Promise<BlogConfig> {
  if (Object.keys(cambios).length === 0) throw new Error("[db:actualizarBlogConfig] sin cambios");
  const db = sql();
  // sql(obj) genera "col1"=$1,"col2"=$2 para el SET
  const rows = await db`
    UPDATE blog_config
    SET ${db(cambios as Record<string, unknown>)}, actualizado_en = now()
    WHERE id = 1
    RETURNING *
  `;
  if (!rows[0]) throw new Error("[db:actualizarBlogConfig] sin resultado");
  return rows[0] as BlogConfig;
}

// Colombia = UTC-5, sin horario de verano.
// Calculamos la hora de Bogotá explícitamente para que el cron funcione
// sin importar el timezone del servidor (Docker/EasyPanel suele ser UTC).
export function horaBogota(date?: Date): { hora: number; min: number; dia: number } {
  const utcMs = (date ?? new Date()).getTime();
  const bogota = new Date(utcMs - 5 * 60 * 60 * 1000);
  return {
    hora: bogota.getUTCHours(),
    min:  bogota.getUTCMinutes(),
    dia:  bogota.getUTCDay(),
  };
}

// Dispara una vez por slot (hora:minuto) por día.
// Ventana de ±15 min alrededor del minuto configurado para que el usuario
// tenga margen de guardar la config sin perder la ventana.
export function debeEjecutarAhora(config: BlogConfig): boolean {
  if (!config.activo) return false;
  const { hora, min, dia } = horaBogota();
  if (!config.dias_semana.includes(dia)) return false;
  if (!config.horas.includes(hora)) return false;
  const minutos = config.minutos ?? null;
  if (minutos === null) return true;
  return Math.abs(min - minutos) <= 15;
}
