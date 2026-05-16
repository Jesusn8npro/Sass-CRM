/**
 * POST /api/blog/suscribir — suscribir email al newsletter del blog
 * GET  /api/blog/suscribir?token=... — confirmar suscripción
 *
 * Ruta pública — sin auth de sesión. Rate-limit 3/hora por IP.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/cliente";
import { enviarEmail, urlApp } from "@/lib/emails/cliente";
import { emailConfirmacionSuscripcion } from "@/lib/emails/plantillas";
import { verificarRateLimit } from "@/lib/auth/rateLimit";

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limite = verificarRateLimit(`suscribir:${ip}`, 3, 3600);
  if (limite) return limite;

  let body: { email?: unknown; nombre?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const nombre = typeof body.nombre === "string" ? body.nombre.trim().slice(0, 100) : null;

  if (!email || !RE_EMAIL.test(email) || email.length > 200) {
    return NextResponse.json({ error: "Email inválido" }, { status: 400 });
  }

  const { data: existente } = await db()
    .from("suscriptores_blog")
    .select("id, confirmado, token_confirmacion, desuscrito_en")
    .eq("email", email)
    .maybeSingle();

  if (existente?.confirmado && !existente.desuscrito_en) {
    return NextResponse.json({ error: "Ya estás suscrito" }, { status: 409 });
  }

  let token: string;

  if (existente) {
    // Reactivar si estaba desuscrito, o reenviar confirmación si no confirmó
    const cambios: Record<string, unknown> = {};
    if (existente.desuscrito_en) cambios.desuscrito_en = null;
    if (nombre) cambios.nombre = nombre;
    await db().from("suscriptores_blog").update(cambios).eq("id", existente.id);
    token = existente.token_confirmacion!;
  } else {
    const { data: nuevo, error } = await db()
      .from("suscriptores_blog")
      .insert({ email, nombre: nombre || null })
      .select("token_confirmacion")
      .single();
    if (error || !nuevo) return NextResponse.json({ error: "Error al registrar" }, { status: 500 });
    token = nuevo.token_confirmacion!;
  }

  const urlConfirmar = `${urlApp()}/api/blog/suscribir?token=${encodeURIComponent(token)}`;
  const { subject, html } = emailConfirmacionSuscripcion(nombre, urlConfirmar);
  void enviarEmail({ to: email, subject, html, idempotencyKey: `suscripcion_blog:${token}` });

  return NextResponse.json({ ok: true, mensaje: "Revisá tu email para confirmar la suscripción" });
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")?.trim();
  if (!token) return NextResponse.json({ error: "Token requerido" }, { status: 400 });

  const { data, error } = await db()
    .from("suscriptores_blog")
    .update({ confirmado: true })
    .eq("token_confirmacion", token)
    .select("email")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Token inválido o expirado" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, mensaje: "¡Suscripción confirmada! Ya recibirás los nuevos artículos." });
}
