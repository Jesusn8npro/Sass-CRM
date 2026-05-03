import { db, lanzar } from "./cliente";
import type { MedioBiblioteca, TipoMediaBiblioteca } from "./tipos";

export async function listarBiblioteca(
  cuentaId: string,
): Promise<MedioBiblioteca[]> {
  const { data, error } = await db()
    .from("biblioteca_medios")
    .select("*")
    .eq("cuenta_id", cuentaId)
    .order("creado_en", { ascending: true });
  if (error) lanzar(error, "listarBiblioteca");
  return (data ?? []) as MedioBiblioteca[];
}

export async function obtenerMedioBiblioteca(
  id: string,
): Promise<MedioBiblioteca | null> {
  const { data, error } = await db()
    .from("biblioteca_medios")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) lanzar(error, "obtenerMedioBiblioteca");
  return (data as MedioBiblioteca) ?? null;
}

export async function obtenerMedioPorIdentificador(
  cuentaId: string,
  identificador: string,
): Promise<MedioBiblioteca | null> {
  const { data, error } = await db()
    .from("biblioteca_medios")
    .select("*")
    .eq("cuenta_id", cuentaId)
    .eq("identificador", identificador)
    .maybeSingle();
  if (error) lanzar(error, "obtenerMedioPorIdentificador");
  return (data as MedioBiblioteca) ?? null;
}

export async function crearMedioBiblioteca(
  cuentaId: string,
  identificador: string,
  tipo: TipoMediaBiblioteca,
  rutaArchivo: string,
  descripcion: string,
): Promise<MedioBiblioteca> {
  const { data, error } = await db()
    .from("biblioteca_medios")
    .insert({
      cuenta_id: cuentaId,
      identificador,
      tipo,
      ruta_archivo: rutaArchivo,
      descripcion,
    })
    .select()
    .single();
  if (error) lanzar(error, "crearMedioBiblioteca");
  return data as MedioBiblioteca;
}

export async function actualizarDescripcionMedio(
  id: string,
  descripcion: string,
): Promise<MedioBiblioteca | null> {
  const { data, error } = await db()
    .from("biblioteca_medios")
    .update({ descripcion })
    .eq("id", id)
    .select()
    .single();
  if (error) lanzar(error, "actualizarDescripcionMedio");
  return data as MedioBiblioteca;
}

export async function borrarMedioBiblioteca(id: string): Promise<void> {
  const { error } = await db()
    .from("biblioteca_medios")
    .delete()
    .eq("id", id);
  if (error) lanzar(error, "borrarMedioBiblioteca");
}
