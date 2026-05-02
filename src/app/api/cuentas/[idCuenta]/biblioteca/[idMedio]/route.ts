import { NextResponse, type NextRequest } from "next/server";
import {
  actualizarDescripcionMedio,
  borrarMedioBiblioteca,
  obtenerCuenta,
  obtenerMedioBiblioteca,
} from "@/lib/baseDatos";
import { borrarMedioBibliotecaArchivo } from "@/lib/baileys/medios";
import { requerirSesion } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string; idMedio: string }>;
}

export async function PATCH(req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta, idMedio } = await params;
  if (!idCuenta || !idMedio) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }

  const medio = await obtenerMedioBiblioteca(idMedio);
  if (!medio || medio.cuenta_id !== idCuenta) {
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
  const actualizado = await actualizarDescripcionMedio(idMedio, descripcion);
  return NextResponse.json({ medio: actualizado });
}

export async function DELETE(_req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta, idMedio } = await params;
  if (!idCuenta || !idMedio) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }

  const medio = await obtenerMedioBiblioteca(idMedio);
  if (!medio || medio.cuenta_id !== idCuenta) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  // Borrar archivo de Storage (con fallback de borrar legacy local).
  try {
    await borrarMedioBibliotecaArchivo(medio.ruta_archivo);
  } catch (err) {
    console.warn("[biblioteca] no se pudo borrar archivo:", err);
  }

  await borrarMedioBiblioteca(idMedio);
  return NextResponse.json({ ok: true });
}
