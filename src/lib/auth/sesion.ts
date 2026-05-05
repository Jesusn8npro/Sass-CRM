import { NextResponse, type NextRequest } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/cliente-servidor";
import { obtenerCuenta } from "@/lib/db/cuentas";
import {
  marcarUso as marcarUsoApiKey,
  obtenerApiKeyPorClave,
  type ApiKey,
} from "@/lib/db/apiKeys";
import type { Cuenta } from "@/lib/db/tipos";

export async function obtenerUsuarioActual(): Promise<{
  id: string;
  email: string;
} | null> {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { id: user.id, email: user.email ?? "" };
}

/**
 * Devuelve usuario o NextResponse 401. Patrón:
 *   const auth = await requerirSesion();
 *   if (auth instanceof NextResponse) return auth;
 */
export async function requerirSesion(): Promise<
  { id: string; email: string } | NextResponse
> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  return usuario;
}

/**
 * Determina si un usuario es admin de plataforma leyendo `usuarios.rol`
 * desde Supabase. El admin se gestiona desde la DB:
 *   - Para promover: update public.usuarios set rol='admin_plataforma' where email='...';
 *   - Para revocar: update public.usuarios set rol='owner' where email='...';
 *
 * (Histórico) Antes el gating era por `process.env.ADMIN_EMAIL`. Se
 * migró a DB para que el operador pueda agregar/quitar admins sin
 * reiniciar el server ni tocar variables de entorno.
 */
export async function esUsuarioAdmin(idUsuario: string): Promise<boolean> {
  const { obtenerUsuarioApp } = await import("@/lib/db/usuarios");
  const u = await obtenerUsuarioApp(idUsuario);
  return u?.rol === "admin_plataforma";
}

/**
 * Guard para endpoints /api/admin/*. Devuelve el usuario si es admin,
 * o NextResponse 401/403 según corresponda.
 *
 *   const auth = await requerirAdmin();
 *   if (auth instanceof NextResponse) return auth;
 *
 * Sin sesión → 401. Logueado pero rol != admin_plataforma → 403.
 */
export async function requerirAdmin(): Promise<
  { id: string; email: string } | NextResponse
> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (!(await esUsuarioAdmin(usuario.id))) {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }
  return usuario;
}

/**
 * Sesión + cuenta + ownership en una sola llamada. Reemplaza el bloque
 * repetido en ~65 handlers de /api/cuentas/[idCuenta]/**.
 *
 * Uso:
 *   const acceso = await verificarAccesoCuenta(idCuenta);
 *   if (acceso instanceof NextResponse) return acceso;
 *   const { auth, cuenta } = acceso;
 */
export async function verificarAccesoCuenta(
  idCuenta: string | undefined,
): Promise<{ auth: { id: string; email: string }; cuenta: Cuenta } | NextResponse> {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;
  if (!idCuenta) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }
  return { auth, cuenta };
}

/**
 * Parseo seguro de JSON con respuesta 400 ante error. Reemplaza el
 * try/catch repetido en ~32 handlers.
 */
export async function parsearJSON<T = unknown>(
  req: NextRequest,
): Promise<T | NextResponse> {
  try {
    return (await req.json()) as T;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
}

// ============================================================
// API keys públicas (Zapier / Make / n8n)
// ============================================================

/**
 * Verifica el header `Authorization: Bearer sk_live_...`.
 *
 * Devuelve `{ cuenta, apiKey }` si la key es válida y la cuenta existe.
 * Devuelve `NextResponse 401` si falta el header, el formato es inválido,
 * la key no existe, está revocada o expirada.
 *
 * NO chequea sesión de Supabase Auth — la API key es self-contained.
 *
 * Nota: el caller debe verificar separadamente que la key matchee el
 * `idCuenta` del path (devolver 403 si no).
 */
export async function verificarApiKey(
  req: NextRequest,
): Promise<{ cuenta: Cuenta; apiKey: ApiKey } | NextResponse> {
  const header = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!header) {
    return NextResponse.json(
      { error: "Falta header Authorization" },
      { status: 401 },
    );
  }
  const match = /^Bearer\s+(sk_live_[A-Za-z0-9_-]+)$/.exec(header.trim());
  if (!match) {
    return NextResponse.json(
      { error: "Formato de Authorization inválido. Esperado: Bearer sk_live_..." },
      { status: 401 },
    );
  }
  const clave = match[1]!;
  const apiKey = await obtenerApiKeyPorClave(clave);
  if (!apiKey) {
    return NextResponse.json(
      { error: "API key inválida, revocada o expirada" },
      { status: 401 },
    );
  }
  const cuenta = await obtenerCuenta(apiKey.cuenta_id);
  if (!cuenta) {
    return NextResponse.json(
      { error: "La cuenta asociada a esta API key ya no existe" },
      { status: 401 },
    );
  }
  // Best-effort, no esperamos.
  void marcarUsoApiKey(apiKey.id);
  return { cuenta, apiKey };
}

/**
 * Helper combinado: si hay header `Authorization` usa API key; si hay
 * cookie de sesión usa el flujo normal. Útil cuando el mismo endpoint
 * puede ser llamado tanto desde la UI logueada como desde una integración.
 *
 * Si se pasa `idCuenta`, verifica que la API key esté scopeada a esa
 * cuenta (devuelve 403 si no matchea).
 */
export async function verificarAccesoApiOSesion(
  req: NextRequest,
  idCuenta?: string,
): Promise<
  | { cuenta: Cuenta; fuente: "api_key"; apiKey: ApiKey }
  | { cuenta: Cuenta; fuente: "sesion"; auth: { id: string; email: string } }
  | NextResponse
> {
  const tieneHeader =
    req.headers.has("authorization") || req.headers.has("Authorization");
  if (tieneHeader) {
    const r = await verificarApiKey(req);
    if (r instanceof NextResponse) return r;
    if (idCuenta && r.cuenta.id !== idCuenta) {
      return NextResponse.json(
        { error: "Esta API key no tiene acceso a esa cuenta" },
        { status: 403 },
      );
    }
    return { cuenta: r.cuenta, fuente: "api_key", apiKey: r.apiKey };
  }
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;
  return { cuenta: acceso.cuenta, fuente: "sesion", auth: acceso.auth };
}
