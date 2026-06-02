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
  // Público: para verificar qué commit está desplegado (diagnóstico de deploy).
  "/api/version",
  "/api/wa-cloud/webhook",
  "/api/vapi/webhook",
  "/api/apify/webhook",
  "/api/resend/webhook",
  "/api/billing/paypal/webhook",
  // Crons: TODA ruta /api/cron/* se auto-protege con header x-cron-secret
  // en su handler. El middleware debe dejarlas pasar porque las dispara
  // GitHub Actions / EasyPanel sin sesión de usuario. Contrato innegociable:
  // ningún route bajo /api/cron puede omitir la verificación de CRON_SECRET.
  "/api/cron",
  // API pública v1 — autenticada vía API key en el handler, no por sesión.
  "/api/v1",
  // Demo público (chat sandbox). Rate-limit por IP en el handler.
  "/api/demo/chat",
  // Callback de auth (intercambio de token_hash para reset de contraseña y magic links).
  "/api/auth/callback",
  // Newsletter del blog — suscripción y desuscripción sin auth.
  "/api/blog/suscribir",
  "/api/blog/desuscribir",
  // Demo público voz — registro de llamada desde widget landing (rate-limitado en handler).
  "/api/landing/llamada",
  // Webhook de Academia Vallenata Online — valida x-webhook-secret en el handler.
  "/api/academia/lead",
];

// UUID v4 exacto — solo coincide con IDs reales, no con "nueva" ni slugs
const RE_CUENTA_UUID =
  /^\/app\/cuentas\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(\/.*)?$/;

export async function proxy(request: NextRequest) {
  const { supabase, response } = crearClienteMiddleware(request);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // ── URLs amigables: /app/cuentas/UUID/* → /app/cuenta/* ──────────────────
  // Guarda la cuenta activa en cookie y redirige a la URL limpia.
  const matchUUID = RE_CUENTA_UUID.exec(path);
  if (matchUUID) {
    const idCuenta = matchUUID[1]!;
    const resto = matchUUID[2] ?? "";
    const urlLimpia = request.nextUrl.clone();
    urlLimpia.pathname = `/app/cuenta${resto}`;
    const redir = NextResponse.redirect(urlLimpia);
    redir.cookies.set("cuenta_activa", idCuenta, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 días
    });
    return redir;
  }

  // ── Reescritura: /app/cuenta/* → /app/cuentas/UUID/* internamente ────────
  // El navegador siempre ve /app/cuenta/... pero Next.js sirve /app/cuentas/UUID/...
  if (path === "/app/cuenta" || path.startsWith("/app/cuenta/")) {
    const idActivo = request.cookies.get("cuenta_activa")?.value;
    if (!idActivo) {
      const url = request.nextUrl.clone();
      url.pathname = "/app";
      return NextResponse.redirect(url);
    }
    const urlInterna = request.nextUrl.clone();
    urlInterna.pathname = path.replace("/app/cuenta", `/app/cuentas/${idActivo}`);
    return NextResponse.rewrite(urlInterna);
  }

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
