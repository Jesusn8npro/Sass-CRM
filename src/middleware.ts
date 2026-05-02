import { NextResponse, type NextRequest } from "next/server";
import { crearClienteMiddleware } from "@/lib/supabase/cliente-middleware";

/**
 * Reglas de routing protegido:
 *
 *  PÚBLICAS (cualquiera): /, /login, /signup, /forgot-password
 *  PROTEGIDAS (requiere sesión): /app/*
 *  WEBHOOKS (sin auth, validan secret propio): /api/vapi/webhook
 *  API rutas internas: por ahora abiertas mientras migramos.
 *    Se cerrarán en sub-fase 6.A.3 con auth por usuario.
 */
export async function middleware(request: NextRequest) {
  const { supabase, response } = crearClienteMiddleware(request);

  // Refresh de sesión SIEMPRE (esto mantiene viva la cookie).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Rutas que requieren auth
  const requiereAuth = path.startsWith("/app");

  if (requiereAuth && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("siguiente", path);
    return NextResponse.redirect(url);
  }

  // Si está logueado y va a /login o /signup, lo mandamos al panel
  if (user && (path === "/login" || path === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Ejecutar en todas las rutas EXCEPTO:
    //  - archivos estáticos (_next/static, _next/image)
    //  - favicons / manifest
    //  - rutas API (las manejaremos individualmente cuando agreguemos
    //    auth en endpoints propios de cuenta)
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
