import { NextResponse, type NextRequest } from "next/server";
import {
  actualizarEntradaConocimiento,
  borrarEntradaConocimiento,
  obtenerEntradaConocimiento,
} from "@/lib/baseDatos";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string; idEntrada: string }>;
}

function validarIds(idCuenta: string, idEntrada: string) {
  const cuentaId = Number(idCuenta);
  const entradaId = Number(idEntrada);
  if (
    !Number.isFinite(cuentaId) ||
    cuentaId <= 0 ||
    !Number.isFinite(entradaId) ||
    entradaId <= 0
  ) {
    return null;
  }
  return { cuentaId, entradaId };
}

export async function PATCH(req: NextRequest, { params }: Contexto) {
  const { idCuenta, idEntrada } = await params;
  const ids = validarIds(idCuenta, idEntrada);
  if (!ids) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const entrada = obtenerEntradaConocimiento(ids.entradaId);
  if (!entrada) {
    return NextResponse.json(
      { error: "Entrada no encontrada" },
      { status: 404 },
    );
  }
  if (entrada.cuenta_id !== ids.cuentaId) {
    return NextResponse.json(
      { error: "La entrada no pertenece a esta cuenta" },
      { status: 403 },
    );
  }

  let payload: { titulo?: unknown; contenido?: unknown; orden?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const titulo =
    typeof payload.titulo === "string" ? payload.titulo : undefined;
  const contenido =
    typeof payload.contenido === "string" ? payload.contenido : undefined;
  const orden =
    typeof payload.orden === "number" ? payload.orden : undefined;

  const actualizada = actualizarEntradaConocimiento(ids.entradaId, {
    titulo,
    contenido,
    orden,
  });
  if (!actualizada) {
    return NextResponse.json(
      { error: "No se pudo actualizar" },
      { status: 500 },
    );
  }
  return NextResponse.json({ entrada: actualizada });
}

export async function DELETE(_req: NextRequest, { params }: Contexto) {
  const { idCuenta, idEntrada } = await params;
  const ids = validarIds(idCuenta, idEntrada);
  if (!ids) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const entrada = obtenerEntradaConocimiento(ids.entradaId);
  if (!entrada) {
    return NextResponse.json(
      { error: "Entrada no encontrada" },
      { status: 404 },
    );
  }
  if (entrada.cuenta_id !== ids.cuentaId) {
    return NextResponse.json(
      { error: "La entrada no pertenece a esta cuenta" },
      { status: 403 },
    );
  }
  borrarEntradaConocimiento(ids.entradaId);
  return NextResponse.json({ ok: true });
}
