import { NextResponse, type NextRequest } from "next/server";
import {
  cancelarSeguimiento,
  obtenerSeguimiento,
} from "@/lib/baseDatos";
import { verificarAccesoCuenta } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string; idSeguimiento: string }>;
}

/** Cancelar un seguimiento pendiente. */
export async function DELETE(req: NextRequest, { params }: Contexto) {
  const { idCuenta, idSeguimiento } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;
  if (!idSeguimiento) {
    return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
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
