import { db, lanzar } from "./cliente";
import type { Etiqueta, EtiquetaConCount } from "./tipos";

export async function listarEtiquetas(cuentaId: string): Promise<Etiqueta[]> {
  const { data, error } = await db()
    .from("etiquetas")
    .select("*")
    .eq("cuenta_id", cuentaId)
    .order("orden", { ascending: true });
  if (error) lanzar(error, "listarEtiquetas");
  return (data ?? []) as Etiqueta[];
}

export async function listarEtiquetasConCount(
  cuentaId: string,
): Promise<EtiquetaConCount[]> {
  const etiquetas = await listarEtiquetas(cuentaId);
  if (etiquetas.length === 0) return [];
  const { data: counts } = await db()
    .from("conversacion_etiquetas")
    .select("etiqueta_id")
    .in(
      "etiqueta_id",
      etiquetas.map((e) => e.id),
    );
  const map = new Map<string, number>();
  for (const row of (counts ?? []) as Array<{ etiqueta_id: string }>) {
    map.set(row.etiqueta_id, (map.get(row.etiqueta_id) ?? 0) + 1);
  }
  return etiquetas.map((e) => ({
    ...e,
    conversaciones_count: map.get(e.id) ?? 0,
  }));
}

export async function crearEtiqueta(
  cuentaId: string,
  nombre: string,
  color = "zinc",
  descripcion: string | null = null,
): Promise<Etiqueta> {
  const { data, error } = await db()
    .from("etiquetas")
    .insert({ cuenta_id: cuentaId, nombre, color, descripcion })
    .select()
    .single();
  if (error) lanzar(error, "crearEtiqueta");
  return data as Etiqueta;
}

export async function actualizarEtiqueta(
  id: string,
  cambios: Partial<{
    nombre: string;
    color: string;
    descripcion: string | null;
    orden: number;
  }>,
): Promise<Etiqueta | null> {
  const { data, error } = await db()
    .from("etiquetas")
    .update(cambios)
    .eq("id", id)
    .select()
    .single();
  if (error) lanzar(error, "actualizarEtiqueta");
  return data as Etiqueta;
}

export async function borrarEtiqueta(id: string): Promise<void> {
  const { error } = await db().from("etiquetas").delete().eq("id", id);
  if (error) lanzar(error, "borrarEtiqueta");
}

export async function asignarEtiqueta(
  conversacionId: string,
  etiquetaId: string,
): Promise<void> {
  const { error } = await db()
    .from("conversacion_etiquetas")
    .upsert(
      { conversacion_id: conversacionId, etiqueta_id: etiquetaId },
      { onConflict: "conversacion_id,etiqueta_id" },
    );
  if (error) lanzar(error, "asignarEtiqueta");
}

export async function desasignarEtiqueta(
  conversacionId: string,
  etiquetaId: string,
): Promise<void> {
  const { error } = await db()
    .from("conversacion_etiquetas")
    .delete()
    .eq("conversacion_id", conversacionId)
    .eq("etiqueta_id", etiquetaId);
  if (error) lanzar(error, "desasignarEtiqueta");
}

export async function listarEtiquetasDeConversacion(
  conversacionId: string,
): Promise<Etiqueta[]> {
  const { data, error } = await db()
    .from("conversacion_etiquetas")
    .select("etiquetas (*)")
    .eq("conversacion_id", conversacionId);
  if (error) lanzar(error, "listarEtiquetasDeConversacion");
  const filas = (data ?? []) as unknown as Array<{
    etiquetas: Etiqueta | Etiqueta[] | null;
  }>;
  const out: Etiqueta[] = [];
  for (const f of filas) {
    if (!f.etiquetas) continue;
    if (Array.isArray(f.etiquetas)) out.push(...f.etiquetas);
    else out.push(f.etiquetas);
  }
  return out;
}
