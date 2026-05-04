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
