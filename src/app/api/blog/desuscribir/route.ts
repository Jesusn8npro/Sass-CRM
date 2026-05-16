/**
 * GET /api/blog/desuscribir?token=... — cancelar suscripción al newsletter
 *
 * Ruta pública — sin auth de sesión.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/cliente";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")?.trim();
  if (!token) return NextResponse.json({ error: "Token requerido" }, { status: 400 });

  const { data, error } = await db()
    .from("suscriptores_blog")
    .update({ desuscrito_en: new Date().toISOString() })
    .eq("token_confirmacion", token)
    .select("email")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Token inválido" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, mensaje: "Te desinscribiste correctamente. Ya no recibirás más emails del blog." });
}
