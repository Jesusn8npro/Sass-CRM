import { NextResponse, type NextRequest } from "next/server";
import {
  crearConocimiento,
  listarConocimientoDeCuenta,
  obtenerCuenta,
} from "@/lib/baseDatos";
import { requerirSesion } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

export async function GET(_req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta } = await params;
  if (!idCuenta) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }
  const entradas = await listarConocimientoDeCuenta(idCuenta);
  return NextResponse.json({ entradas });
}

export async function POST(req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta } = await params;
  if (!idCuenta) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
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

  const entrada = await crearConocimiento(idCuenta, titulo, contenido);
  return NextResponse.json({ entrada });
}
