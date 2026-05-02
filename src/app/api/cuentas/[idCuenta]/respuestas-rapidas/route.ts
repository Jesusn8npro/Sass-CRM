import { NextResponse, type NextRequest } from "next/server";
import {
  crearRespuestaRapida,
  listarRespuestasRapidas,
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
  const respuestas = await listarRespuestasRapidas(idCuenta);
  return NextResponse.json({ respuestas });
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

  let payload: { atajo?: unknown; texto?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const atajo = typeof payload.atajo === "string" ? payload.atajo.trim() : "";
  const texto = typeof payload.texto === "string" ? payload.texto : "";
  if (!atajo) {
    return NextResponse.json(
      { error: "El atajo es obligatorio" },
      { status: 400 },
    );
  }
  if (!texto.trim()) {
    return NextResponse.json(
      { error: "El texto es obligatorio" },
      { status: 400 },
    );
  }

  const respuesta = await crearRespuestaRapida(idCuenta, atajo, texto);
  return NextResponse.json({ respuesta });
}
