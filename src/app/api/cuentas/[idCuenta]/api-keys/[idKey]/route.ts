/**
 * DELETE → revoca una API key (no la borra, queda como auditable).
 *
 * Auth: sesión Supabase + ownership de cuenta.
 */
import { NextResponse, type NextRequest } from "next/server";
import { revocarApiKey } from "@/lib/db/apiKeys";
import { verificarAccesoCuenta } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string; idKey: string }>;
}

export async function DELETE(_req: NextRequest, { params }: Contexto) {
  const { idCuenta, idKey } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;

  const ok = await revocarApiKey(idKey, acceso.auth.id);
  if (!ok) {
    return NextResponse.json(
      { error: "API key no encontrada o ya revocada" },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true });
}
