import { NextResponse, type NextRequest } from "next/server";
import {
  actualizarRespuestaRapida,
  borrarRespuestaRapida,
  obtenerRespuestaRapida,
} from "@/lib/baseDatos";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string; idRespuesta: string }>;
}

function validar(idCuenta: string, idRespuesta: string) {
  const cuentaId = Number(idCuenta);
  const respId = Number(idRespuesta);
  if (
    !Number.isFinite(cuentaId) ||
    cuentaId <= 0 ||
    !Number.isFinite(respId) ||
    respId <= 0
  ) {
    return null;
  }
  return { cuentaId, respId };
}

export async function PATCH(req: NextRequest, { params }: Contexto) {
  const { idCuenta, idRespuesta } = await params;
  const ids = validar(idCuenta, idRespuesta);
  if (!ids) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const respuesta = obtenerRespuestaRapida(ids.respId);
  if (!respuesta || respuesta.cuenta_id !== ids.cuentaId) {
    return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }

  let payload: { atajo?: unknown; texto?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const atajo = typeof payload.atajo === "string" ? payload.atajo : undefined;
  const texto = typeof payload.texto === "string" ? payload.texto : undefined;

  const actualizada = actualizarRespuestaRapida(ids.respId, { atajo, texto });
  return NextResponse.json({ respuesta: actualizada });
}

export async function DELETE(_req: NextRequest, { params }: Contexto) {
  const { idCuenta, idRespuesta } = await params;
  const ids = validar(idCuenta, idRespuesta);
  if (!ids) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const respuesta = obtenerRespuestaRapida(ids.respId);
  if (!respuesta || respuesta.cuenta_id !== ids.cuentaId) {
    return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }
  borrarRespuestaRapida(ids.respId);
  return NextResponse.json({ ok: true });
}
