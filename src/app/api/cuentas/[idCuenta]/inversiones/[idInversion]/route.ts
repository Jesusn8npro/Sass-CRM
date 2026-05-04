import { NextResponse, type NextRequest } from "next/server";
import {
  actualizarInversion,
  borrarInversion,
  obtenerInversion,
} from "@/lib/baseDatos";
import { parsearJSON, verificarAccesoCuenta } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string; idInversion: string }>;
}

export async function PATCH(req: NextRequest, { params }: Contexto) {
  const { idCuenta, idInversion } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;
  if (!idInversion) {
    return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
  }
  const inv = await obtenerInversion(idInversion);
  if (!inv || inv.cuenta_id !== idCuenta) {
    return NextResponse.json({ error: "Inversión no encontrada" }, { status: 404 });
  }

  const payload = await parsearJSON<Record<string, unknown>>(req);
  if (payload instanceof NextResponse) return payload;

  const cambios: Parameters<typeof actualizarInversion>[1] = {};
  if (typeof payload.concepto === "string" && payload.concepto.trim()) {
    cambios.concepto = payload.concepto.trim();
  }
  if (
    typeof payload.monto === "number" &&
    Number.isFinite(payload.monto) &&
    payload.monto > 0
  ) {
    cambios.monto = payload.monto;
  }
  if (typeof payload.moneda === "string" && payload.moneda.trim()) {
    cambios.moneda = payload.moneda.trim().toUpperCase().slice(0, 5);
  }
  if (typeof payload.categoria === "string") {
    cambios.categoria = payload.categoria.trim() || null;
  }
  if (typeof payload.fecha === "string" && payload.fecha.trim()) {
    cambios.fecha = payload.fecha;
  }
  if (typeof payload.notas === "string") {
    cambios.notas = payload.notas.trim() || null;
  }

  const actualizada = await actualizarInversion(idInversion, cambios);
  return NextResponse.json({ inversion: actualizada });
}

export async function DELETE(_req: NextRequest, { params }: Contexto) {
  const { idCuenta, idInversion } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;
  if (!idInversion) {
    return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
  }
  const inv = await obtenerInversion(idInversion);
  if (!inv || inv.cuenta_id !== idCuenta) {
    return NextResponse.json({ error: "Inversión no encontrada" }, { status: 404 });
  }
  await borrarInversion(idInversion);
  return NextResponse.json({ ok: true });
}
