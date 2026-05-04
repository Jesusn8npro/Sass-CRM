import { NextResponse, type NextRequest } from "next/server";
import {
  actualizarRespuestaRapida,
  borrarRespuestaRapida,
  listarRespuestasRapidas,
} from "@/lib/baseDatos";
import { parsearJSON, verificarAccesoCuenta } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string; idRespuesta: string }>;
}

export async function PATCH(req: NextRequest, { params }: Contexto) {
  const { idCuenta, idRespuesta } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;
  if (!idRespuesta) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const respuestas = await listarRespuestasRapidas(idCuenta);
  const respuesta = respuestas.find((r) => r.id === idRespuesta);
  if (!respuesta) {
    return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }

  const payload = await parsearJSON<{ atajo?: unknown; texto?: unknown }>(req);
  if (payload instanceof NextResponse) return payload;

  const atajo = typeof payload.atajo === "string" ? payload.atajo : undefined;
  const texto = typeof payload.texto === "string" ? payload.texto : undefined;

  const actualizada = await actualizarRespuestaRapida(idRespuesta, {
    atajo,
    texto,
  });
  return NextResponse.json({ respuesta: actualizada });
}

export async function DELETE(_req: NextRequest, { params }: Contexto) {
  const { idCuenta, idRespuesta } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;
  if (!idRespuesta) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const respuestas = await listarRespuestasRapidas(idCuenta);
  const respuesta = respuestas.find((r) => r.id === idRespuesta);
  if (!respuesta) {
    return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }
  await borrarRespuestaRapida(idRespuesta);
  return NextResponse.json({ ok: true });
}
