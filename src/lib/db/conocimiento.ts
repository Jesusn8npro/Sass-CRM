import { db, lanzar } from "./cliente";
import type { EntradaConocimiento } from "./tipos";

export async function listarConocimientoDeCuenta(
  cuentaId: string,
): Promise<EntradaConocimiento[]> {
  const { data, error } = await db()
    .from("conocimiento")
    .select("*")
    .eq("cuenta_id", cuentaId)
    .order("orden", { ascending: true });
  if (error) lanzar(error, "listarConocimientoDeCuenta");
  return (data ?? []) as EntradaConocimiento[];
}

export async function crearConocimiento(
  cuentaId: string,
  titulo: string,
  contenido: string,
  opciones?: { categoria?: string; esta_activo?: boolean },
): Promise<EntradaConocimiento> {
  const { data: max } = await db()
    .from("conocimiento")
    .select("orden")
    .eq("cuenta_id", cuentaId)
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();
  const orden = ((max as { orden: number } | null)?.orden ?? 0) + 1;
  const { data, error } = await db()
    .from("conocimiento")
    .insert({
      cuenta_id: cuentaId,
      titulo,
      contenido,
      orden,
      categoria: opciones?.categoria?.trim() || "general",
      esta_activo: opciones?.esta_activo ?? true,
    })
    .select()
    .single();
  if (error) lanzar(error, "crearConocimiento");
  return data as EntradaConocimiento;
}

export async function actualizarConocimiento(
  id: string,
  cambios: Partial<{
    titulo: string;
    contenido: string;
    orden: number;
    categoria: string;
    esta_activo: boolean;
  }>,
): Promise<EntradaConocimiento | null> {
  const { data, error } = await db()
    .from("conocimiento")
    .update(cambios)
    .eq("id", id)
    .select()
    .single();
  if (error) lanzar(error, "actualizarConocimiento");
  return data as EntradaConocimiento;
}

export async function borrarConocimiento(id: string): Promise<void> {
  const { error } = await db().from("conocimiento").delete().eq("id", id);
  if (error) lanzar(error, "borrarConocimiento");
}
