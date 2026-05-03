import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/cliente-servidor";

/**
 * Obtiene el usuario autenticado desde el server (route handlers,
 * server actions, server components). Devuelve null si no hay sesión.
 */
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
 * Helper para route handlers: si NO hay sesión, devuelve un Response
 * 401 que el handler debe retornar inmediatamente.
 *
 * Uso típico:
 *   export async function GET(...) {
 *     const auth = await requerirSesion();
 *     if (auth instanceof NextResponse) return auth;
 *     // acá usamos auth.id como usuario_id
 *   }
 */
export async function requerirSesion(): Promise<
  { id: string; email: string } | NextResponse
> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) {
    return NextResponse.json(
      { error: "No autenticado" },
      { status: 401 },
    );
  }
  return usuario;
}
