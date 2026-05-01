import { NextResponse, type NextRequest } from "next/server";
import {
  borrarConversacion,
  cambiarEtapaConversacion,
  obtenerConversacionPorId,
  obtenerEtapa,
} from "@/lib/baseDatos";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string; idConversacion: string }>;
}

function validarIds(ic: string, iconv: string) {
  const cuentaId = Number(ic);
  const convId = Number(iconv);
  if (
    !Number.isFinite(cuentaId) ||
    cuentaId <= 0 ||
    !Number.isFinite(convId) ||
    convId <= 0
  ) {
    return null;
  }
  return { cuentaId, convId };
}

export async function PATCH(req: NextRequest, { params }: Contexto) {
  const { idCuenta, idConversacion } = await params;
  const ids = validarIds(idCuenta, idConversacion);
  if (!ids) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const conv = obtenerConversacionPorId(ids.convId);
  if (!conv || conv.cuenta_id !== ids.cuentaId) {
    return NextResponse.json(
      { error: "Conversación no encontrada" },
      { status: 404 },
    );
  }

  let payload: { etapa_id?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  // Permitimos null para sacar la conversación de cualquier etapa.
  if (payload.etapa_id === null) {
    cambiarEtapaConversacion(ids.convId, null);
    return NextResponse.json({ ok: true, etapa_id: null });
  }
  if (typeof payload.etapa_id !== "number" || !Number.isFinite(payload.etapa_id)) {
    return NextResponse.json(
      { error: "etapa_id debe ser número o null" },
      { status: 400 },
    );
  }
  const etapa = obtenerEtapa(payload.etapa_id);
  if (!etapa || etapa.cuenta_id !== ids.cuentaId) {
    return NextResponse.json(
      { error: "Etapa inválida para esta cuenta" },
      { status: 400 },
    );
  }
  cambiarEtapaConversacion(ids.convId, payload.etapa_id);
  return NextResponse.json({ ok: true, etapa_id: payload.etapa_id });
}

export async function DELETE(_req: NextRequest, { params }: Contexto) {
  const { idCuenta, idConversacion } = await params;
  const ids = validarIds(idCuenta, idConversacion);
  if (!ids) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const conv = obtenerConversacionPorId(ids.convId);
  if (!conv) {
    return NextResponse.json(
      { error: "Conversación no encontrada" },
      { status: 404 },
    );
  }
  if (conv.cuenta_id !== ids.cuentaId) {
    return NextResponse.json(
      { error: "La conversación no pertenece a esta cuenta" },
      { status: 403 },
    );
  }
  borrarConversacion(ids.convId);
  return NextResponse.json({ ok: true });
}
