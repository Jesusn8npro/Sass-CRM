/**
 * Endpoint manual para forzar el envío del reporte diario.
 *
 * Dos modos de autenticación:
 *   1. Sesión Supabase válida + super-admin → POST desde el panel.
 *   2. Header `Authorization: Bearer <CRON_SECRET>` → ejecutado por
 *      un cron externo (Easy Panel, GitHub Actions, etc).
 *
 * Es seguro llamarlo varias veces — el procesador es idempotente
 * (skip silencioso fuera de la ventana horaria, anti-duplicado vía
 * `ultimo_reporte_diario_en`).
 */
import { NextRequest, NextResponse } from "next/server";
import { obtenerUsuarioActual } from "@/lib/auth/sesion";
import { obtenerSuperAdminPorEmail } from "@/lib/baseDatos";
import { procesarReporteDiario } from "@/lib/admin/reporteDiario";

export const dynamic = "force-dynamic";

async function autorizar(req: NextRequest): Promise<NextResponse | null> {
  // Modo 1: bearer token (cron externo)
  const auth = req.headers.get("authorization") ?? "";
  const secretEsperado = process.env.CRON_SECRET;
  if (secretEsperado && auth === `Bearer ${secretEsperado}`) {
    return null; // OK
  }

  // Modo 2: sesión super-admin
  const usuario = await obtenerUsuarioActual();
  if (usuario?.email) {
    const sa = await obtenerSuperAdminPorEmail(usuario.email);
    if (sa) return null;
  }

  return NextResponse.json(
    { error: "No autorizado" },
    { status: 401 },
  );
}

export async function POST(req: NextRequest) {
  const err = await autorizar(req);
  if (err) return err;

  try {
    await procesarReporteDiario();
    return NextResponse.json({ ok: true });
  } catch (e) {
    const detalle = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: detalle },
      { status: 500 },
    );
  }
}

// GET sólo para health-check del cron — no ejecuta nada
export async function GET() {
  return NextResponse.json({
    ok: true,
    descripcion: "Endpoint cron del reporte diario. Usar POST con Bearer token.",
  });
}
