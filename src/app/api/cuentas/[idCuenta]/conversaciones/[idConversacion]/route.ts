import { NextResponse, type NextRequest } from "next/server";
import {
  borrarConversacion,
  cambiarEtapaConversacion,
  obtenerConversacionPorId,
  obtenerCuenta,
  obtenerEtapa,
} from "@/lib/baseDatos";
import { requerirSesion } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string; idConversacion: string }>;
}

export async function PATCH(req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta, idConversacion } = await params;
  if (!idCuenta || !idConversacion) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }
  const conv = await obtenerConversacionPorId(idConversacion);
  if (!conv || conv.cuenta_id !== idCuenta) {
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
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta, idConversacion } = await params;
  if (!idCuenta || !idConversacion) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
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
