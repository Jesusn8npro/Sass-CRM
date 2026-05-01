import { NextResponse, type NextRequest } from "next/server";
import fs from "node:fs";
import {
  actualizarDescripcionMedio,
  borrarMedioBiblioteca,
  obtenerMedioBiblioteca,
} from "@/lib/baseDatos";
import { rutaAbsolutaDeBiblioteca } from "@/lib/baileys/medios";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string; idMedio: string }>;
}

function validar(idCuenta: string, idMedio: string) {
  const cuentaId = Number(idCuenta);
  const medioId = Number(idMedio);
  if (
    !Number.isFinite(cuentaId) ||
    cuentaId <= 0 ||
    !Number.isFinite(medioId) ||
    medioId <= 0
  ) {
    return null;
  }
  return { cuentaId, medioId };
}

export async function PATCH(req: NextRequest, { params }: Contexto) {
  const { idCuenta, idMedio } = await params;
  const ids = validar(idCuenta, idMedio);
  if (!ids) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const medio = obtenerMedioBiblioteca(ids.medioId);
  if (!medio || medio.cuenta_id !== ids.cuentaId) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  let payload: { descripcion?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const descripcion =
    typeof payload.descripcion === "string"
      ? payload.descripcion.trim()
      : null;
  if (!descripcion) {
    return NextResponse.json(
      { error: "La descripción no puede estar vacía" },
      { status: 400 },
    );
  }
  const actualizado = actualizarDescripcionMedio(ids.medioId, descripcion);
  return NextResponse.json({ medio: actualizado });
}

export async function DELETE(_req: NextRequest, { params }: Contexto) {
  const { idCuenta, idMedio } = await params;
  const ids = validar(idCuenta, idMedio);
  if (!ids) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const medio = obtenerMedioBiblioteca(ids.medioId);
  if (!medio || medio.cuenta_id !== ids.cuentaId) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  // Borrar archivo de disco
  try {
    const ruta = rutaAbsolutaDeBiblioteca(medio.ruta_archivo);
    if (fs.existsSync(ruta)) fs.unlinkSync(ruta);
  } catch (err) {
    console.warn("[biblioteca] no se pudo borrar archivo:", err);
  }

  borrarMedioBiblioteca(ids.medioId);
  return NextResponse.json({ ok: true });
}
