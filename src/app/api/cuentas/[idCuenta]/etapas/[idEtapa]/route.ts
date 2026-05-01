import { NextResponse, type NextRequest } from "next/server";
import {
  actualizarEtapa,
  borrarEtapa,
  obtenerCuenta,
  obtenerEtapa,
} from "@/lib/baseDatos";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string; idEtapa: string }>;
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

function validarIds(ic: string, ie: string) {
  const idCuenta = Number(ic);
  const idEtapa = Number(ie);
  if (
    !Number.isFinite(idCuenta) ||
    idCuenta <= 0 ||
    !Number.isFinite(idEtapa) ||
    idEtapa <= 0
  ) {
    return null;
  }
  return { idCuenta, idEtapa };
}

export async function PATCH(req: NextRequest, { params }: Contexto) {
  const { idCuenta, idEtapa } = await params;
  const ids = validarIds(idCuenta, idEtapa);
  if (!ids) {
    return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
  }
  if (!obtenerCuenta(ids.idCuenta)) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }
  const etapa = obtenerEtapa(ids.idEtapa);
  if (!etapa || etapa.cuenta_id !== ids.idCuenta) {
    return NextResponse.json({ error: "Etapa no encontrada" }, { status: 404 });
  }

  let payload: { nombre?: unknown; color?: unknown; orden?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const nombre =
    typeof payload.nombre === "string" && payload.nombre.trim()
      ? payload.nombre.trim()
      : undefined;
  const color =
    typeof payload.color === "string" && COLORES_VALIDOS.has(payload.color)
      ? payload.color
      : undefined;
  const orden =
    typeof payload.orden === "number" && Number.isFinite(payload.orden)
      ? payload.orden
      : undefined;

  const actualizada = actualizarEtapa(ids.idEtapa, { nombre, color, orden });
  return NextResponse.json({ etapa: actualizada });
}

export async function DELETE(_req: NextRequest, { params }: Contexto) {
  const { idCuenta, idEtapa } = await params;
  const ids = validarIds(idCuenta, idEtapa);
  if (!ids) {
    return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
  }
  const etapa = obtenerEtapa(ids.idEtapa);
  if (!etapa || etapa.cuenta_id !== ids.idCuenta) {
    return NextResponse.json({ error: "Etapa no encontrada" }, { status: 404 });
  }
  borrarEtapa(ids.idEtapa);
  return NextResponse.json({ ok: true });
}
