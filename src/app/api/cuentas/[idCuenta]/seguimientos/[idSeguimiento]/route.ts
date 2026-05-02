import { NextResponse, type NextRequest } from "next/server";
import {
  cancelarSeguimiento,
  obtenerSeguimiento,
} from "@/lib/baseDatos";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string; idSeguimiento: string }>;
}

/** Cancelar un seguimiento pendiente. */
export async function DELETE(req: NextRequest, { params }: Contexto) {
  const { idCuenta, idSeguimiento } = await params;
  const idC = Number(idCuenta);
  const idS = Number(idSeguimiento);
  if (
    !Number.isFinite(idC) ||
    idC <= 0 ||
    !Number.isFinite(idS) ||
    idS <= 0
  ) {
    return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
  }
  const s = obtenerSeguimiento(idS);
  if (!s || s.cuenta_id !== idC) {
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
  cancelarSeguimiento(idS, razon);
  return NextResponse.json({ ok: true });
}
