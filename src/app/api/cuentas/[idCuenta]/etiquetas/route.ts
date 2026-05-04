import { NextResponse, type NextRequest } from "next/server";
import {
  crearEtiqueta,
  listarEtiquetasConCount,
} from "@/lib/baseDatos";
import { parsearJSON, verificarAccesoCuenta } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string }>;
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

export async function GET(_req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;
  const etiquetas = await listarEtiquetasConCount(idCuenta);
  return NextResponse.json({ etiquetas });
}

export async function POST(req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;

  const payload = await parsearJSON<{ nombre?: unknown; color?: unknown; descripcion?: unknown }>(req);
  if (payload instanceof NextResponse) return payload;

  const nombre = typeof payload.nombre === "string" ? payload.nombre.trim() : "";
  if (!nombre) {
    return NextResponse.json(
      { error: "El nombre es obligatorio" },
      { status: 400 },
    );
  }
  const color =
    typeof payload.color === "string" && COLORES_VALIDOS.has(payload.color)
      ? payload.color
      : "zinc";
  const descripcion =
    typeof payload.descripcion === "string" ? payload.descripcion : null;

  const etiqueta = await crearEtiqueta(idCuenta, nombre, color, descripcion);
  return NextResponse.json({ etiqueta });
}
