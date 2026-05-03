import { db, lanzar } from "./cliente";
import type {
  ContactoEmail,
  ContactoEmailConTelefono,
  ValidezEmail,
} from "./tipos";

const REGEX_EMAIL = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;

export function extraerEmailsDelTexto(texto: string): string[] {
  if (!texto) return [];
  const matches = texto.match(REGEX_EMAIL) ?? [];
  return Array.from(new Set(matches.map((m) => m.toLowerCase())));
}

export function clasificarValidezEmail(email: string): ValidezEmail {
  const e = email.trim().toLowerCase();
  if (!e || !e.includes("@") || !e.includes(".")) return "invalido";
  const [user, dominio] = e.split("@");
  if (!user || !dominio) return "invalido";
  if (user.length < 2) return "sospechoso";
  if (user.length > 64) return "invalido";
  if (!dominio.includes(".")) return "invalido";
  if (dominio.length < 4) return "sospechoso";
  if (/(.)\1{4,}/.test(user)) return "sospechoso";
  const tld = dominio.split(".").pop() ?? "";
  if (tld.length < 2) return "invalido";
  const dominiosComunes = [
    "gmail.com",
    "hotmail.com",
    "outlook.com",
    "yahoo.com",
    "icloud.com",
    "live.com",
  ];
  for (const d of dominiosComunes) {
    if (dominio === d) return "valido";
    if (dominio.length === d.length) {
      let diffs = 0;
      for (let i = 0; i < d.length; i++) if (dominio[i] !== d[i]) diffs++;
      if (diffs > 0 && diffs <= 2) return "sospechoso";
    }
  }
  return "valido";
}

export async function guardarContactosEmail(
  cuentaId: string,
  conversacionId: string,
  emails: string[],
): Promise<{ nuevos: number; sospechosos: string[] }> {
  if (emails.length === 0) return { nuevos: 0, sospechosos: [] };
  const sospechosos: string[] = [];
  const aInsertar: Array<{
    cuenta_id: string;
    conversacion_id: string;
    email: string;
    validez: ValidezEmail;
  }> = [];
  for (const email of emails) {
    const validez = clasificarValidezEmail(email);
    if (validez === "invalido") continue;
    if (validez === "sospechoso") sospechosos.push(email);
    aInsertar.push({
      cuenta_id: cuentaId,
      conversacion_id: conversacionId,
      email,
      validez,
    });
  }
  if (aInsertar.length === 0) return { nuevos: 0, sospechosos };
  const { data, error } = await db()
    .from("contactos_email")
    .upsert(aInsertar, {
      onConflict: "cuenta_id,email",
      ignoreDuplicates: true,
    })
    .select("id");
  if (error) lanzar(error, "guardarContactosEmail");
  return { nuevos: (data ?? []).length, sospechosos };
}

export async function listarContactosEmail(
  cuentaId: string,
): Promise<ContactoEmailConTelefono[]> {
  const { data, error } = await db()
    .from("contactos_email")
    .select("*, conversaciones (nombre, telefono)")
    .eq("cuenta_id", cuentaId)
    .order("capturado_en", { ascending: false });
  if (error) lanzar(error, "listarContactosEmail");
  return (
    (data ?? []) as Array<
      ContactoEmail & {
        conversaciones: { nombre: string | null; telefono: string } | null;
      }
    >
  ).map((r) => ({
    ...r,
    nombre_contacto: r.conversaciones?.nombre ?? null,
    telefono: r.conversaciones?.telefono ?? null,
  }));
}

export async function borrarContactoEmail(id: string): Promise<void> {
  const { error } = await db().from("contactos_email").delete().eq("id", id);
  if (error) lanzar(error, "borrarContactoEmail");
}

export async function contarContactosEmail(cuentaId: string): Promise<number> {
  const { count, error } = await db()
    .from("contactos_email")
    .select("id", { count: "exact", head: true })
    .eq("cuenta_id", cuentaId);
  if (error) lanzar(error, "contarContactosEmail");
  return count ?? 0;
}
