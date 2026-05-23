import { db } from "./cliente";

export interface CronRun {
  id: string;
  ejecutado_en: string;
  resultado: "publicado" | "error" | "saltado";
  disparado_por: "cron" | "manual";
  slug_articulo: string | null;
  titulo_articulo: string | null;
  categoria: string | null;
  ms_total: number | null;
  error_mensaje: string | null;
}

export async function registrarRunCron(
  run: Omit<CronRun, "id" | "ejecutado_en">,
): Promise<void> {
  const { error } = await db().from("blog_cron_runs").insert(run);
  if (error) {
    // Fire and forget — no romper la generación si el log falla
    console.warn("[blogCronRuns] no se pudo registrar run:", error.message);
  }
}

export async function listarRunsCron(limite = 100): Promise<CronRun[]> {
  const { data, error } = await db()
    .from("blog_cron_runs")
    .select("*")
    .order("ejecutado_en", { ascending: false })
    .limit(limite);
  if (error) {
    console.warn("[blogCronRuns] error al listar:", error.message);
    return [];
  }
  return (data ?? []) as CronRun[];
}
