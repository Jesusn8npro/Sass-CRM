import { NextResponse, type NextRequest } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/cliente-servidor";

/**
 * Cierra la sesión del usuario actual y redirige al landing.
 * Lo invocamos como POST desde el botón "Cerrar sesión" del sidebar.
 */
export async function POST(req: NextRequest) {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  const url = req.nextUrl.clone();
  url.pathname = "/";
  return NextResponse.redirect(url, { status: 303 });
}
