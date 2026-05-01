import { NextResponse, type NextRequest } from "next/server";
import {
  crearEntradaConocimiento,
  listarConocimientoDeCuenta,
  obtenerCuenta,
} from "@/lib/baseDatos";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

export async function GET(_req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const id = Number(idCuenta);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  if (!obtenerCuenta(id)) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }
  const entradas = listarConocimientoDeCuenta(id);
  return NextResponse.json({ entradas });
}

export async function POST(req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const id = Number(idCuenta);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  if (!obtenerCuenta(id)) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }

  let payload: { titulo?: unknown; contenido?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const titulo = typeof payload.titulo === "string" ? payload.titulo.trim() : "";
  const contenido =
    typeof payload.contenido === "string" ? payload.contenido : "";
  if (!titulo) {
    return NextResponse.json(
      { error: "El título es obligatorio" },
      { status: 400 },
    );
  }

  const entrada = crearEntradaConocimiento(id, titulo, contenido);
  return NextResponse.json({ entrada });
}
