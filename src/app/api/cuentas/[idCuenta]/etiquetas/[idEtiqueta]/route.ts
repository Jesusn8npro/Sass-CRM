import { NextResponse, type NextRequest } from "next/server";
import {
  actualizarEtiqueta,
  borrarEtiqueta,
  listarEtiquetas,
  obtenerCuenta,
} from "@/lib/baseDatos";
import { requerirSesion } from "@/lib/auth/sesion";

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

export async function PATCH(req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta, idEtiqueta } = await params;
  if (!idCuenta || !idEtiqueta) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }
  const etiquetas = await listarEtiquetas(idCuenta);
  const etiqueta = etiquetas.find((e) => e.id === idEtiqueta);
  if (!etiqueta) {
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

  const actualizada = await actualizarEtiqueta(idEtiqueta, {
    nombre,
    color,
    descripcion,
  });
  return NextResponse.json({ etiqueta: actualizada });
}

export async function DELETE(_req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta, idEtiqueta } = await params;
  if (!idCuenta || !idEtiqueta) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }
  const etiquetas = await listarEtiquetas(idCuenta);
  const etiqueta = etiquetas.find((e) => e.id === idEtiqueta);
  if (!etiqueta) {
    return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }
  await borrarEtiqueta(idEtiqueta);
  return NextResponse.json({ ok: true });
}
