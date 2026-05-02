import { NextResponse, type NextRequest } from "next/server";
import {
  asignarEtiqueta,
  desasignarEtiqueta,
  listarEtiquetas,
  listarEtiquetasDeConversacion,
  obtenerConversacionPorId,
  obtenerCuenta,
} from "@/lib/baseDatos";
import { requerirSesion } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string; idConversacion: string }>;
}

async function verificarAcceso(
  idCuenta: string,
  idConversacion: string,
  usuarioId: string,
): Promise<NextResponse | null> {
  if (!idCuenta || !idConversacion) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== usuarioId) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }
  const conv = await obtenerConversacionPorId(idConversacion);
  if (!conv || conv.cuenta_id !== idCuenta) {
    return NextResponse.json(
      { error: "Conversación no encontrada" },
      { status: 404 },
    );
  }
  return null;
}

export async function GET(_req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;
  const { idCuenta, idConversacion } = await params;
  const err = await verificarAcceso(idCuenta, idConversacion, auth.id);
  if (err) return err;
  const etiquetas = await listarEtiquetasDeConversacion(idConversacion);
  return NextResponse.json({ etiquetas });
}

export async function POST(req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;
  const { idCuenta, idConversacion } = await params;
  const err = await verificarAcceso(idCuenta, idConversacion, auth.id);
  if (err) return err;

  let payload: { etiqueta_id?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const etiquetaId =
    typeof payload.etiqueta_id === "string" ? payload.etiqueta_id : "";
  if (!etiquetaId) {
    return NextResponse.json(
      { error: "etiqueta_id inválido" },
      { status: 400 },
    );
  }
  const etiquetasCuenta = await listarEtiquetas(idCuenta);
  if (!etiquetasCuenta.some((e) => e.id === etiquetaId)) {
    return NextResponse.json(
      { error: "Etiqueta no pertenece a esta cuenta" },
      { status: 400 },
    );
  }

  await asignarEtiqueta(idConversacion, etiquetaId);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;
  const { idCuenta, idConversacion } = await params;
  const err = await verificarAcceso(idCuenta, idConversacion, auth.id);
  if (err) return err;

  const url = new URL(req.url);
  const etiquetaId = url.searchParams.get("etiqueta_id");
  if (!etiquetaId) {
    return NextResponse.json(
      { error: "Pasá ?etiqueta_id=<id>" },
      { status: 400 },
    );
  }

  await desasignarEtiqueta(idConversacion, etiquetaId);
  return NextResponse.json({ ok: true });
}
