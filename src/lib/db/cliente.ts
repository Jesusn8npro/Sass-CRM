/**
 * Cliente Supabase admin (service_role) singleton + helper de errores.
 * Usado por todos los módulos de `src/lib/db/*`.
 */
import { crearClienteAdmin } from "../supabase/cliente-servidor";
import type { SupabaseClient } from "@supabase/supabase-js";

let _admin: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (!_admin) _admin = crearClienteAdmin();
  return _admin;
}

/**
 * Construye un mensaje de error útil a partir de errores de Supabase
 * /PostgREST que vienen como `{ message, code, details, hint }`.
 * String(obj) da "[object Object]" — esto da algo legible.
 */
export function lanzar(error: unknown, contexto: string): never {
  let msg: string;
  if (error instanceof Error) {
    msg = error.message;
  } else if (error && typeof error === "object") {
    const e = error as Record<string, unknown>;
    const partes: string[] = [];
    if (typeof e.message === "string") partes.push(e.message);
    if (typeof e.code === "string") partes.push(`code=${e.code}`);
    if (typeof e.details === "string") partes.push(`details=${e.details}`);
    if (typeof e.hint === "string") partes.push(`hint=${e.hint}`);
    msg = partes.length > 0 ? partes.join(" | ") : JSON.stringify(error);
  } else {
    msg = String(error);
  }
  throw new Error(`[db:${contexto}] ${msg}`);
}
