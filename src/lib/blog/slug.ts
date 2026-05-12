/**
 * Generación de slugs URL-friendly desde un título.
 *
 * Reglas:
 *  - minúsculas
 *  - sin acentos (NFD + remove diacritics)
 *  - solo letras a-z, dígitos y guiones
 *  - sin guiones consecutivos
 *  - longitud entre 3 y 120 caracteres
 *
 * Garantiza unicidad sufijando -2, -3, etc. si ya existe en DB.
 */
import { existeArticuloConSlug } from "@/lib/db/blog";

export function slugificar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    // Quitar marcas diacríticas (acentos)
    .replace(/[̀-ͯ]/g, "")
    // Caracteres no permitidos → guión
    .replace(/[^a-z0-9]+/g, "-")
    // Sin guiones en los extremos
    .replace(/^-+|-+$/g, "")
    // Sin guiones consecutivos
    .replace(/-{2,}/g, "-")
    // Max 120 chars (limite de DB)
    .slice(0, 120)
    // Y limpiar guión final si quedó por el truncado
    .replace(/-+$/g, "");
}

/**
 * Genera un slug único para un nuevo artículo. Si ya existe uno con
 * ese slug, va sufijando -2, -3... hasta encontrar uno libre.
 *
 * Garantía: max 20 intentos. Si fallan los 20, devuelve uno con timestamp
 * (extremadamente improbable que choque pero por las dudas).
 */
export async function generarSlugUnico(titulo: string): Promise<string> {
  const base = slugificar(titulo);
  if (base.length < 3) {
    // Fallback si el título es muy corto / solo caracteres especiales
    return `articulo-${Date.now().toString(36)}`;
  }

  // Intento 1: el slug crudo
  if (!(await existeArticuloConSlug(base))) return base;

  // Sufijos numéricos
  for (let i = 2; i <= 20; i++) {
    const candidato = `${base}-${i}`.slice(0, 120);
    if (!(await existeArticuloConSlug(candidato))) return candidato;
  }

  // Último recurso: timestamp
  return `${base.slice(0, 100)}-${Date.now().toString(36)}`;
}
