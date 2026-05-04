import { NextResponse, type NextRequest } from "next/server";
import { crearClienteMiddleware } from "@/lib/supabase/cliente-middleware";

/**
 * Reglas de routing:
 *   PÚBLICAS: /, /login, /signup, /forgot-password
 *   PROTEGIDAS: /app/*  → redirect a /login si no hay sesión
 *   API: deny-by-default. Sin sesión → 401, salvo allowlist de webhooks
 *        públicos que validan firma propia.
 */

const API_PUBLICA_ALLOWLIST = [
  "/api/wa-cloud/webhook",
  "/api/vapi/webhook",
  "/api/apify/webhook",
];

export async function middleware(request: NextRequest) {
  const { supabase, response } = crearClienteMiddleware(request);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  if (path.startsWith("/api")) {
    const esPublica = API_PUBLICA_ALLOWLIST.some(
      (p) => path === p || path.startsWith(p + "/"),
    );
    if (!esPublica && !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    return response;
  }

  if (path.startsWith("/app") && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("siguiente", path);
    return NextResponse.redirect(url);
  }

  if (user && (path === "/login" || path === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
