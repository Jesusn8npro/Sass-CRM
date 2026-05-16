import { db, lanzar } from "./cliente";

export interface CuentaMiembro {
  id: string;
  cuenta_id: string;
  usuario_id: string;
  rol: "agente" | "admin";
  invitado_por: string | null;
  activo: boolean;
  creado_en: string;
  // join
  email?: string;
  nombre?: string | null;
}

export async function listarMiembros(cuentaId: string): Promise<CuentaMiembro[]> {
  const { data, error } = await db()
    .from("cuenta_miembros")
    .select("*, usuarios(email, nombre)")
    .eq("cuenta_id", cuentaId)
    .eq("activo", true)
    .order("creado_en", { ascending: true });
  if (error) lanzar(error, "listarMiembros");
  return ((data ?? []) as Array<CuentaMiembro & { usuarios?: { email: string; nombre: string | null } }>).map((m) => ({
    ...m,
    email: m.usuarios?.email,
    nombre: m.usuarios?.nombre,
  }));
}

export async function esMiembroActivo(cuentaId: string, usuarioId: string): Promise<boolean> {
  const { data, error } = await db()
    .from("cuenta_miembros")
    .select("id")
    .eq("cuenta_id", cuentaId)
    .eq("usuario_id", usuarioId)
    .eq("activo", true)
    .maybeSingle();
  if (error) return false;
  return !!data;
}

export async function agregarMiembro(
  cuentaId: string,
  usuarioId: string,
  rol: "agente" | "admin",
  invitadoPor: string,
): Promise<CuentaMiembro> {
  const { data, error } = await db()
    .from("cuenta_miembros")
    .upsert(
      { cuenta_id: cuentaId, usuario_id: usuarioId, rol, invitado_por: invitadoPor, activo: true },
      { onConflict: "cuenta_id,usuario_id" },
    )
    .select("*")
    .single();
  if (error) lanzar(error, "agregarMiembro");
  return data as CuentaMiembro;
}

export async function eliminarMiembro(cuentaId: string, usuarioId: string): Promise<void> {
  const { error } = await db()
    .from("cuenta_miembros")
    .update({ activo: false })
    .eq("cuenta_id", cuentaId)
    .eq("usuario_id", usuarioId);
  if (error) lanzar(error, "eliminarMiembro");
}

export async function asignarConversacion(
  conversacionId: string,
  cuentaId: string,
  asignadoA: string | null,
): Promise<void> {
  const { error } = await db()
    .from("conversaciones")
    .update({ asignado_a: asignadoA })
    .eq("id", conversacionId)
    .eq("cuenta_id", cuentaId);
  if (error) lanzar(error, "asignarConversacion");
}
