import { NextResponse, type NextRequest } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/cliente-servidor";
import { obtenerCuenta } from "@/lib/db/cuentas";
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
 * Lee el email admin del entorno. Si no está definido, el panel admin
 * queda completamente apagado (los endpoints devuelven 404 y la UI
 * redirecciona). Soporta lista separada por comas.
 */
function emailsAdminConfigurados(): string[] {
  const raw = process.env.ADMIN_EMAIL ?? "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function adminPanelHabilitado(): boolean {
  return emailsAdminConfigurados().length > 0;
}

export function esEmailAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return emailsAdminConfigurados().includes(email.toLowerCase());
}

/**
 * Guard para endpoints /api/admin/*. Devuelve el usuario si es admin,
 * o NextResponse 401/403/404 segun corresponda. Patrón:
 *   const auth = await requerirAdmin();
 *   if (auth instanceof NextResponse) return auth;
 *
 * Si ADMIN_EMAIL no está configurado → 404 (panel apagado).
 * Si no hay sesión → 401.
 * Si el email no matchea → 403.
 */
export async function requerirAdmin(): Promise<
  { id: string; email: string } | NextResponse
> {
  if (!adminPanelHabilitado()) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  const usuario = await obtenerUsuarioActual();
  if (!usuario) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (!esEmailAdmin(usuario.email)) {
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
