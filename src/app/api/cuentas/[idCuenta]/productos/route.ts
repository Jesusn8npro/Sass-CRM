import { NextResponse, type NextRequest } from "next/server";
import {
  crearProducto,
  listarProductos,
} from "@/lib/baseDatos";
import { parsearJSON, verificarAccesoCuenta } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

export async function GET(_req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;
  const productos = await listarProductos(idCuenta);
  return NextResponse.json({ productos });
}

export async function POST(req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;

  const payload = await parsearJSON<{
    nombre?: unknown;
    descripcion?: unknown;
    precio?: unknown;
    moneda?: unknown;
    costo?: unknown;
    stock?: unknown;
    sku?: unknown;
    categoria?: unknown;
  }>(req);
  if (payload instanceof NextResponse) return payload;

  const nombre =
    typeof payload.nombre === "string" ? payload.nombre.trim() : "";
  if (!nombre) {
    return NextResponse.json(
      { error: "El nombre es obligatorio" },
      { status: 400 },
    );
  }

  const descripcion =
    typeof payload.descripcion === "string" ? payload.descripcion : "";
  const precio =
    typeof payload.precio === "number" && Number.isFinite(payload.precio)
      ? payload.precio
      : null;
  const moneda =
    typeof payload.moneda === "string" && payload.moneda.trim()
      ? payload.moneda.trim().toUpperCase().slice(0, 5)
      : "COP";
  const costo =
    typeof payload.costo === "number" && Number.isFinite(payload.costo)
      ? payload.costo
      : null;
  const stock =
    typeof payload.stock === "number" && Number.isFinite(payload.stock)
      ? Math.max(0, Math.floor(payload.stock))
      : null;
  const sku =
    typeof payload.sku === "string" && payload.sku.trim()
      ? payload.sku.trim()
      : null;
  const categoria =
    typeof payload.categoria === "string" && payload.categoria.trim()
      ? payload.categoria.trim()
      : null;

  const producto = await crearProducto(idCuenta, {
    nombre,
    descripcion,
    precio,
    moneda,
    costo,
    stock,
    sku,
    categoria,
  });
  return NextResponse.json({ producto }, { status: 201 });
}
