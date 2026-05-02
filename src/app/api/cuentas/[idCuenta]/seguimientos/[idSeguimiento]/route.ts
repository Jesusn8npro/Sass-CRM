import { NextResponse, type NextRequest } from "next/server";
import {
  cancelarSeguimiento,
  obtenerCuenta,
  obtenerSeguimiento,
} from "@/lib/baseDatos";
import { requerirSesion } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string; idSeguimiento: string }>;
}

/** Cancelar un seguimiento pendiente. */
export async function DELETE(req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta, idSeguimiento } = await params;
  if (!idCuenta || !idSeguimiento) {
    return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
  }
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }
  const s = await obtenerSeguimiento(idSeguimiento);
  if (!s || s.cuenta_id !== idCuenta) {
    return NextResponse.json(
      { error: "Seguimiento no encontrado" },
      { status: 404 },
    );
  }
  if (s.estado !== "pendiente") {
    return NextResponse.json(
      { error: `No se puede cancelar (estado: ${s.estado})` },
      { status: 400 },
    );
  }
  const url = new URL(req.url);
  const razon = url.searchParams.get("razon") ?? "cancelado por operador";
  await cancelarSeguimiento(idSeguimiento, razon);
  return NextResponse.json({ ok: true });
}
