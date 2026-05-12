/**
 * Helpers de sesión para el panel /admin (super-admins globales).
 *
 * Distinto a `src/lib/auth/sesion.ts` (que es para users normales del
 * SaaS): este módulo valida que el user logueado sea ADEMÁS un
 * super-admin activo en `public.super_admins`.
 */
import { NextResponse } from "next/server";
import { obtenerUsuarioActual } from "@/lib/auth/sesion";
import {
  obtenerSuperAdminPorEmail,
  type SuperAdmin,
} from "@/lib/baseDatos";

export interface SesionSuperAdmin {
  usuarioId: string;
  email: string;
  superAdmin: SuperAdmin;
}

/**
 * Devuelve la sesión de super-admin actual o null.
 * Útil en server components donde querés renderizar distinto
 * según si el user es admin o no (vs lanzar 401).
 */
export async function obtenerSesionSuperAdmin(): Promise<SesionSuperAdmin | null> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario || !usuario.email) return null;
  const superAdmin = await obtenerSuperAdminPorEmail(usuario.email);
  if (!superAdmin) return null;
  return {
    usuarioId: usuario.id,
    email: usuario.email,
    superAdmin,
  };
}

/**
 * Helper para route handlers: si NO hay sesión válida de super-admin,
 * devuelve NextResponse 401/403 que el handler debe retornar.
 *
 * Uso típico:
 *   export async function GET(...) {
 *     const sesion = await requerirSuperAdmin();
 *     if (sesion instanceof NextResponse) return sesion;
 *     // acá tenemos sesion.superAdmin garantizado
 *   }
 */
export async function requerirSuperAdmin(): Promise<
  SesionSuperAdmin | NextResponse
> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) {
    return NextResponse.json(
      { error: "No autenticado" },
      { status: 401 },
    );
  }
  if (!usuario.email) {
    return NextResponse.json(
      { error: "Sesión sin email — no se puede validar permisos" },
      { status: 403 },
    );
  }
  const superAdmin = await obtenerSuperAdminPorEmail(usuario.email);
  if (!superAdmin) {
    return NextResponse.json(
      { error: "No autorizado — solo super-admins pueden acceder" },
      { status: 403 },
    );
  }
  return {
    usuarioId: usuario.id,
    email: usuario.email,
    superAdmin,
  };
}
