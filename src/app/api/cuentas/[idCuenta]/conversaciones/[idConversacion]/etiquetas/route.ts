import { NextResponse, type NextRequest } from "next/server";
import {
  asignarEtiquetaAConversacion,
  obtenerConversacionPorId,
  obtenerEtiqueta,
  obtenerEtiquetasDeConversacion,
  quitarEtiquetaDeConversacion,
} from "@/lib/baseDatos";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string; idConversacion: string }>;
}

function validar(idCuenta: string, idConv: string) {
  const cuentaId = Number(idCuenta);
  const convId = Number(idConv);
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

function verificarConvPerteneceACuenta(
  convId: number,
  cuentaId: number,
): { ok: true } | { ok: false; status: number; error: string } {
  const conv = obtenerConversacionPorId(convId);
  if (!conv)
    return { ok: false, status: 404, error: "Conversación no encontrada" };
  if (conv.cuenta_id !== cuentaId)
    return {
      ok: false,
      status: 403,
      error: "La conversación no pertenece a esta cuenta",
    };
  return { ok: true };
}

export async function GET(_req: NextRequest, { params }: Contexto) {
  const { idCuenta, idConversacion } = await params;
  const ids = validar(idCuenta, idConversacion);
  if (!ids) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  const v = verificarConvPerteneceACuenta(ids.convId, ids.cuentaId);
  if (!v.ok)
    return NextResponse.json({ error: v.error }, { status: v.status });
  const etiquetas = obtenerEtiquetasDeConversacion(ids.convId);
  return NextResponse.json({ etiquetas });
}

export async function POST(req: NextRequest, { params }: Contexto) {
  const { idCuenta, idConversacion } = await params;
  const ids = validar(idCuenta, idConversacion);
  if (!ids) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  const v = verificarConvPerteneceACuenta(ids.convId, ids.cuentaId);
  if (!v.ok)
    return NextResponse.json({ error: v.error }, { status: v.status });

  let payload: { etiqueta_id?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const etiquetaId = Number(payload.etiqueta_id);
  if (!Number.isFinite(etiquetaId) || etiquetaId <= 0) {
    return NextResponse.json(
      { error: "etiqueta_id inválido" },
      { status: 400 },
    );
  }
  const etiqueta = obtenerEtiqueta(etiquetaId);
  if (!etiqueta || etiqueta.cuenta_id !== ids.cuentaId) {
    return NextResponse.json(
      { error: "Etiqueta no pertenece a esta cuenta" },
      { status: 400 },
    );
  }

  asignarEtiquetaAConversacion(ids.convId, etiquetaId);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: Contexto) {
  const { idCuenta, idConversacion } = await params;
  const ids = validar(idCuenta, idConversacion);
  if (!ids) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  const v = verificarConvPerteneceACuenta(ids.convId, ids.cuentaId);
  if (!v.ok)
    return NextResponse.json({ error: v.error }, { status: v.status });

  const url = new URL(req.url);
  const etiquetaId = Number(url.searchParams.get("etiqueta_id"));
  if (!Number.isFinite(etiquetaId) || etiquetaId <= 0) {
    return NextResponse.json(
      { error: "Pasá ?etiqueta_id=<id>" },
      { status: 400 },
    );
  }

  quitarEtiquetaDeConversacion(ids.convId, etiquetaId);
  return NextResponse.json({ ok: true });
}
