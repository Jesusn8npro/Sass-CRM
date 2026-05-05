/**
 * DAO de API keys públicas para integraciones externas.
 *
 * - Las keys son opaque (no JWT). Formato: `sk_live_<base64url-32bytes>`.
 * - Se guarda SOLO el SHA-256 hex. El plaintext se devuelve UNA VEZ
 *   en `crearApiKey` y nunca más se puede recuperar.
 * - Si la migración 10 todavía no se aplicó, las funciones de lectura
 *   degradan a [] / null y la de creación lanza un error con `code`
 *   reconocible para que el endpoint devuelva 503.
 */
import crypto from "node:crypto";
import { db } from "./cliente";

const PREFIJO_PUBLICO = "sk_live_";

export interface ApiKey {
  id: string;
  cuenta_id: string;
  usuario_id: string;
  nombre: string;
  prefijo: string;
  permisos: string[];
  ultima_uso_en: string | null;
  revocada_en: string | null;
  expira_en: string | null;
  creado_en: string;
}

/** Permisos válidos. Mantener simple — read/write. */
export type PermisoApiKey = "read" | "write";
const PERMISOS_VALIDOS: readonly PermisoApiKey[] = ["read", "write"];

/** Error tipado para que el endpoint devuelva 503 si falta la tabla. */
export class TablaApiKeysNoDisponibleError extends Error {
  code = "TABLA_API_KEYS_NO_DISPONIBLE" as const;
  constructor() {
    super(
      "La tabla `api_keys` todavía no existe en la base. Aplicá la migración 10.",
    );
  }
}

function esErrorTablaInexistente(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string };
  // 42P01 = undefined_table en Postgres, PGRST205 = relation not found en PostgREST
  if (e.code === "42P01" || e.code === "PGRST205") return true;
  return typeof e.message === "string" && /relation .* does not exist/i.test(e.message);
}

function hashearClave(plaintext: string): string {
  return crypto.createHash("sha256").update(plaintext).digest("hex");
}

function generarClavePlaintext(): string {
  // 32 bytes -> ~43 chars base64url. Suficiente entropía.
  const random = crypto.randomBytes(32).toString("base64url");
  return `${PREFIJO_PUBLICO}${random}`;
}

function sanearPermisos(input: string[] | undefined): PermisoApiKey[] {
  if (!Array.isArray(input)) return [];
  const set = new Set<PermisoApiKey>();
  for (const p of input) {
    if (typeof p !== "string") continue;
    const lower = p.trim().toLowerCase();
    if ((PERMISOS_VALIDOS as readonly string[]).includes(lower)) {
      set.add(lower as PermisoApiKey);
    }
  }
  return Array.from(set);
}

/**
 * Crea una API key nueva.
 *
 * Devuelve el plaintext UNA SOLA VEZ. Después solo es accesible el
 * prefijo y el hash. Si la tabla no existe, lanza
 * `TablaApiKeysNoDisponibleError`.
 */
export async function crearApiKey(parametros: {
  cuentaId: string;
  usuarioId: string;
  nombre: string;
  permisos?: string[];
  expiraEn?: string | null;
}): Promise<{ apiKey: ApiKey; clavePlaintext: string }> {
  const nombre = parametros.nombre.trim().slice(0, 80);
  if (!nombre) {
    throw new Error("El nombre de la API key no puede estar vacío");
  }
  const permisos = sanearPermisos(parametros.permisos);
  // Si el caller no pasó nada o todo era inválido, default a read+write.
  const permisosFinales =
    permisos.length > 0 ? permisos : (["read", "write"] as PermisoApiKey[]);

  const clavePlaintext = generarClavePlaintext();
  const claveHash = hashearClave(clavePlaintext);
  const prefijo = clavePlaintext.slice(0, 12); // "sk_live_" + 4 chars

  const { data, error } = await db()
    .from("api_keys")
    .insert({
      cuenta_id: parametros.cuentaId,
      usuario_id: parametros.usuarioId,
      nombre,
      clave_hash: claveHash,
      prefijo,
      permisos: permisosFinales,
      expira_en: parametros.expiraEn ?? null,
    })
    .select(
      "id, cuenta_id, usuario_id, nombre, prefijo, permisos, ultima_uso_en, revocada_en, expira_en, creado_en",
    )
    .single();

  if (error) {
    if (esErrorTablaInexistente(error)) {
      throw new TablaApiKeysNoDisponibleError();
    }
    throw new Error(`[db:crearApiKey] ${error.message ?? String(error)}`);
  }

  return { apiKey: data as ApiKey, clavePlaintext };
}

/**
 * Lista las keys de una cuenta. Si la tabla no existe devuelve [].
 * NO incluye `clave_hash` — la metadata pública es suficiente para la UI.
 */
export async function listarApiKeysDeCuenta(
  cuentaId: string,
): Promise<ApiKey[]> {
  const { data, error } = await db()
    .from("api_keys")
    .select(
      "id, cuenta_id, usuario_id, nombre, prefijo, permisos, ultima_uso_en, revocada_en, expira_en, creado_en",
    )
    .eq("cuenta_id", cuentaId)
    .order("creado_en", { ascending: false });
  if (error) {
    if (esErrorTablaInexistente(error)) return [];
    throw new Error(`[db:listarApiKeysDeCuenta] ${error.message ?? String(error)}`);
  }
  return (data ?? []) as ApiKey[];
}

/**
 * Revoca una key. Verifica ownership por usuario_id como guard
 * defensivo (el caller ya validó la cuenta vía `verificarAccesoCuenta`).
 */
export async function revocarApiKey(
  id: string,
  usuarioId: string,
): Promise<boolean> {
  const { data, error } = await db()
    .from("api_keys")
    .update({ revocada_en: new Date().toISOString() })
    .eq("id", id)
    .eq("usuario_id", usuarioId)
    .is("revocada_en", null)
    .select("id")
    .maybeSingle();
  if (error) {
    if (esErrorTablaInexistente(error)) return false;
    throw new Error(`[db:revocarApiKey] ${error.message ?? String(error)}`);
  }
  return !!data;
}

/**
 * Resuelve una key plaintext a su fila en DB. Devuelve null si:
 *   - la key no existe
 *   - está revocada
 *   - está expirada
 *   - la tabla no existe (deny-by-default)
 */
export async function obtenerApiKeyPorClave(
  clavePlaintext: string,
): Promise<ApiKey | null> {
  if (!clavePlaintext.startsWith(PREFIJO_PUBLICO)) return null;
  const claveHash = hashearClave(clavePlaintext);
  const { data, error } = await db()
    .from("api_keys")
    .select(
      "id, cuenta_id, usuario_id, nombre, prefijo, permisos, ultima_uso_en, revocada_en, expira_en, creado_en",
    )
    .eq("clave_hash", claveHash)
    .maybeSingle();
  if (error) {
    if (esErrorTablaInexistente(error)) return null;
    throw new Error(`[db:obtenerApiKeyPorClave] ${error.message ?? String(error)}`);
  }
  if (!data) return null;
  const fila = data as ApiKey;
  if (fila.revocada_en) return null;
  if (fila.expira_en && new Date(fila.expira_en).getTime() < Date.now()) {
    return null;
  }
  return fila;
}

/**
 * Marca el último uso de la key. Best-effort — si falla, no bloqueamos
 * la request del cliente.
 */
export async function marcarUso(id: string): Promise<void> {
  try {
    await db()
      .from("api_keys")
      .update({ ultima_uso_en: new Date().toISOString() })
      .eq("id", id);
  } catch {
    // No bloqueamos la request por un fallo de telemetría.
  }
}
