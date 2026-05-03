import { db, lanzar } from "./cliente";
import type { ContactoTelefono, ContactoTelefonoConContexto } from "./tipos";

const REGEX_TELEFONO = /\+?\d[\d\s().-]{7,18}\d/g;

export function extraerTelefonosDelTexto(texto: string): string[] {
  if (!texto) return [];
  const matches = texto.match(REGEX_TELEFONO) ?? [];
  const limpios: string[] = [];
  for (const m of matches) {
    const digitos = m.replace(/[^\d]/g, "");
    if (digitos.length >= 8 && digitos.length <= 15) limpios.push(digitos);
  }
  return Array.from(new Set(limpios));
}

export async function guardarContactosTelefono(
  cuentaId: string,
  conversacionId: string,
  telefonos: string[],
  telefonoPropio?: string | null,
): Promise<number> {
  if (telefonos.length === 0) return 0;
  const propio = telefonoPropio?.replace(/[^\d]/g, "") ?? "";
  const aInsertar: Array<{
    cuenta_id: string;
    conversacion_id: string;
    telefono: string;
  }> = [];
  for (const tel of telefonos) {
    if (
      propio &&
      (tel === propio ||
        (propio.length > tel.length && propio.endsWith(tel)) ||
        (tel.length > propio.length && tel.endsWith(propio)))
    ) {
      continue;
    }
    aInsertar.push({
      cuenta_id: cuentaId,
      conversacion_id: conversacionId,
      telefono: tel,
    });
  }
  if (aInsertar.length === 0) return 0;
  const { data, error } = await db()
    .from("contactos_telefono")
    .upsert(aInsertar, {
      onConflict: "cuenta_id,telefono",
      ignoreDuplicates: true,
    })
    .select("id");
  if (error) lanzar(error, "guardarContactosTelefono");
  return (data ?? []).length;
}

export async function listarContactosTelefono(
  cuentaId: string,
): Promise<ContactoTelefonoConContexto[]> {
  const { data, error } = await db()
    .from("contactos_telefono")
    .select("*, conversaciones (nombre, telefono)")
    .eq("cuenta_id", cuentaId)
    .order("capturado_en", { ascending: false });
  if (error) lanzar(error, "listarContactosTelefono");
  return (
    (data ?? []) as Array<
      ContactoTelefono & {
        conversaciones: { nombre: string | null; telefono: string } | null;
      }
    >
  ).map((r) => ({
    ...r,
    nombre_contacto: r.conversaciones?.nombre ?? null,
    telefono_conv: r.conversaciones?.telefono ?? null,
  }));
}

export async function borrarContactoTelefono(id: string): Promise<void> {
  const { error } = await db()
    .from("contactos_telefono")
    .delete()
    .eq("id", id);
  if (error) lanzar(error, "borrarContactoTelefono");
}

export async function contarContactosTelefono(
  cuentaId: string,
): Promise<number> {
  const { count, error } = await db()
    .from("contactos_telefono")
    .select("id", { count: "exact", head: true })
    .eq("cuenta_id", cuentaId);
  if (error) lanzar(error, "contarContactosTelefono");
  return count ?? 0;
}
