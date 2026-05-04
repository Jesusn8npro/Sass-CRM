import { NextResponse, type NextRequest } from "next/server";
import {
  crearRespuestaRapida,
  listarRespuestasRapidas,
} from "@/lib/baseDatos";
import { parsearJSON, verificarAccesoCuenta } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

export async function GET(_req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;
  const respuestas = await listarRespuestasRapidas(idCuenta);
  return NextResponse.json({ respuestas });
}

export async function POST(req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;

  const payload = await parsearJSON<{ atajo?: unknown; texto?: unknown }>(req);
  if (payload instanceof NextResponse) return payload;

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
