import { db, lanzar } from "./cliente";
import type { EtapaPipeline } from "./tipos";

const ETAPAS_DEFAULT: Array<{ nombre: string; color: string }> = [
  { nombre: "Nuevo", color: "zinc" },
  { nombre: "Contactado", color: "azul" },
  { nombre: "Interesado", color: "amarillo" },
  { nombre: "Negociando", color: "ambar" },
  { nombre: "Cerrado", color: "esmeralda" },
  { nombre: "Perdido", color: "rojo" },
];

export async function listarEtapas(cuentaId: string): Promise<EtapaPipeline[]> {
  const { data, error } = await db()
    .from("etapas_pipeline")
    .select("*")
    .eq("cuenta_id", cuentaId)
    .order("orden", { ascending: true });
  if (error) lanzar(error, "listarEtapas");
  return (data ?? []) as EtapaPipeline[];
}

export async function obtenerEtapa(id: string): Promise<EtapaPipeline | null> {
  const { data, error } = await db()
    .from("etapas_pipeline")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) lanzar(error, "obtenerEtapa");
  return (data as EtapaPipeline) ?? null;
}

export async function crearEtapa(
  cuentaId: string,
  nombre: string,
  color: string,
  opciones?: {
    paso_id?: string | null;
    paso_siguiente_id?: string | null;
    criterio_transicion?: string;
    objetivos?: string;
    descripcion?: string;
  },
): Promise<EtapaPipeline> {
  const { data: max } = await db()
    .from("etapas_pipeline")
    .select("orden")
    .eq("cuenta_id", cuentaId)
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();
  const orden = ((max as { orden: number } | null)?.orden ?? 0) + 1;
  const { data, error } = await db()
    .from("etapas_pipeline")
    .insert({
      cuenta_id: cuentaId,
      nombre,
      color,
      orden,
      paso_id: opciones?.paso_id ?? null,
      paso_siguiente_id: opciones?.paso_siguiente_id ?? null,
      criterio_transicion: opciones?.criterio_transicion ?? "",
      objetivos: opciones?.objetivos ?? "",
      descripcion: opciones?.descripcion ?? "",
    })
    .select()
    .single();
  if (error) lanzar(error, "crearEtapa");
  return data as EtapaPipeline;
}

export async function actualizarEtapa(
  id: string,
  cambios: Partial<{
    nombre: string;
    color: string;
    orden: number;
    paso_id: string | null;
    paso_siguiente_id: string | null;
    criterio_transicion: string;
    objetivos: string;
    descripcion: string;
  }>,
): Promise<EtapaPipeline | null> {
  const { data, error } = await db()
    .from("etapas_pipeline")
    .update(cambios)
    .eq("id", id)
    .select()
    .single();
  if (error) lanzar(error, "actualizarEtapa");
  return data as EtapaPipeline;
}

export async function reordenarEtapas(
  cuentaId: string,
  ordenIds: string[],
): Promise<void> {
  for (let i = 0; i < ordenIds.length; i++) {
    const { error } = await db()
      .from("etapas_pipeline")
      .update({ orden: i + 1 })
      .eq("id", ordenIds[i])
      .eq("cuenta_id", cuentaId);
    if (error) lanzar(error, "reordenarEtapas");
  }
}

export async function borrarEtapa(id: string): Promise<void> {
  // FK ON DELETE SET NULL ya se encarga de las conversaciones
  const { error } = await db().from("etapas_pipeline").delete().eq("id", id);
  if (error) lanzar(error, "borrarEtapa");
}

export async function sembrarEtapasSiVacias(cuentaId: string): Promise<void> {
  const existentes = await listarEtapas(cuentaId);
  if (existentes.length > 0) return;
  const filas = ETAPAS_DEFAULT.map((e, idx) => ({
    cuenta_id: cuentaId,
    nombre: e.nombre,
    color: e.color,
    orden: idx + 1,
  }));
  const { error } = await db().from("etapas_pipeline").insert(filas);
  if (error) lanzar(error, "sembrarEtapasSiVacias");
}
