import { NextResponse, type NextRequest } from "next/server";
import {
  borrarConversacion,
  cambiarEtapaConversacion,
  obtenerConversacionPorId,
  obtenerEtapa,
} from "@/lib/baseDatos";
import { parsearJSON, verificarAccesoCuenta } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string; idConversacion: string }>;
}

export async function PATCH(req: NextRequest, { params }: Contexto) {
  const { idCuenta, idConversacion } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;
  if (!idConversacion) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const conv = await obtenerConversacionPorId(idConversacion);
  if (!conv || conv.cuenta_id !== idCuenta) {
    return NextResponse.json(
      { error: "Conversación no encontrada" },
      { status: 404 },
    );
  }

  const payload = await parsearJSON<{ etapa_id?: unknown }>(req);
  if (payload instanceof NextResponse) return payload;

  // Permitimos null para sacar la conversación de cualquier etapa.
  if (payload.etapa_id === null) {
    await cambiarEtapaConversacion(idConversacion, null);
    return NextResponse.json({ ok: true, etapa_id: null });
  }
  if (typeof payload.etapa_id !== "string" || !payload.etapa_id) {
    return NextResponse.json(
      { error: "etapa_id debe ser string o null" },
      { status: 400 },
    );
  }
  const etapa = await obtenerEtapa(payload.etapa_id);
  if (!etapa || etapa.cuenta_id !== idCuenta) {
    return NextResponse.json(
      { error: "Etapa inválida para esta cuenta" },
      { status: 400 },
    );
  }
  await cambiarEtapaConversacion(idConversacion, payload.etapa_id);
  return NextResponse.json({ ok: true, etapa_id: payload.etapa_id });
}

export async function DELETE(_req: NextRequest, { params }: Contexto) {
  const { idCuenta, idConversacion } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;
  if (!idConversacion) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const conv = await obtenerConversacionPorId(idConversacion);
  if (!conv || conv.cuenta_id !== idCuenta) {
    return NextResponse.json(
      { error: "Conversación no encontrada" },
      { status: 404 },
    );
  }
  await borrarConversacion(idConversacion);
  return NextResponse.json({ ok: true });
}
