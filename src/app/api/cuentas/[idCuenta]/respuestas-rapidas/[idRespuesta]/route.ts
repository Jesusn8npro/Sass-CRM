import { NextResponse, type NextRequest } from "next/server";
import {
  actualizarRespuestaRapida,
  borrarRespuestaRapida,
  listarRespuestasRapidas,
  obtenerCuenta,
} from "@/lib/baseDatos";
import { requerirSesion } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string; idRespuesta: string }>;
}

export async function PATCH(req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta, idRespuesta } = await params;
  if (!idCuenta || !idRespuesta) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }
  const respuestas = await listarRespuestasRapidas(idCuenta);
  const respuesta = respuestas.find((r) => r.id === idRespuesta);
  if (!respuesta) {
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

  const actualizada = await actualizarRespuestaRapida(idRespuesta, {
    atajo,
    texto,
  });
  return NextResponse.json({ respuesta: actualizada });
}

export async function DELETE(_req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta, idRespuesta } = await params;
  if (!idCuenta || !idRespuesta) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }
  const respuestas = await listarRespuestasRapidas(idCuenta);
  const respuesta = respuestas.find((r) => r.id === idRespuesta);
  if (!respuesta) {
    return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }
  await borrarRespuestaRapida(idRespuesta);
  return NextResponse.json({ ok: true });
}
