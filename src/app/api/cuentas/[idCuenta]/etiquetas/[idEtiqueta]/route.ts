import { NextResponse, type NextRequest } from "next/server";
import {
  actualizarEtiqueta,
  borrarEtiqueta,
  obtenerEtiqueta,
} from "@/lib/baseDatos";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string; idEtiqueta: string }>;
}

const COLORES_VALIDOS = new Set([
  "zinc",
  "rojo",
  "ambar",
  "amarillo",
  "esmeralda",
  "azul",
  "violeta",
  "rosa",
]);

function validar(idCuenta: string, idEtiqueta: string) {
  const cuentaId = Number(idCuenta);
  const etiquetaId = Number(idEtiqueta);
  if (
    !Number.isFinite(cuentaId) ||
    cuentaId <= 0 ||
    !Number.isFinite(etiquetaId) ||
    etiquetaId <= 0
  ) {
    return null;
  }
  return { cuentaId, etiquetaId };
}

export async function PATCH(req: NextRequest, { params }: Contexto) {
  const { idCuenta, idEtiqueta } = await params;
  const ids = validar(idCuenta, idEtiqueta);
  if (!ids) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const etiqueta = obtenerEtiqueta(ids.etiquetaId);
  if (!etiqueta || etiqueta.cuenta_id !== ids.cuentaId) {
    return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }

  let payload: { nombre?: unknown; color?: unknown; descripcion?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const nombre =
    typeof payload.nombre === "string" ? payload.nombre : undefined;
  const color =
    typeof payload.color === "string" && COLORES_VALIDOS.has(payload.color)
      ? payload.color
      : undefined;
  const descripcion =
    typeof payload.descripcion === "string"
      ? payload.descripcion
      : payload.descripcion === null
      ? null
      : undefined;

  const actualizada = actualizarEtiqueta(ids.etiquetaId, {
    nombre,
    color,
    descripcion,
  });
  return NextResponse.json({ etiqueta: actualizada });
}

export async function DELETE(_req: NextRequest, { params }: Contexto) {
  const { idCuenta, idEtiqueta } = await params;
  const ids = validar(idCuenta, idEtiqueta);
  if (!ids) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  const etiqueta = obtenerEtiqueta(ids.etiquetaId);
  if (!etiqueta || etiqueta.cuenta_id !== ids.cuentaId) {
    return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }
  borrarEtiqueta(ids.etiquetaId);
  return NextResponse.json({ ok: true });
}
