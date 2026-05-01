import { NextResponse, type NextRequest } from "next/server";
import {
  crearProducto,
  listarProductos,
  obtenerCuenta,
} from "@/lib/baseDatos";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

function validarId(s: string): number | null {
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function GET(_req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const id = validarId(idCuenta);
  if (id === null) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  if (!obtenerCuenta(id)) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }
  const productos = listarProductos(id);
  return NextResponse.json({ productos });
}

export async function POST(req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const id = validarId(idCuenta);
  if (id === null) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  if (!obtenerCuenta(id)) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }

  let payload: {
    nombre?: unknown;
    descripcion?: unknown;
    precio?: unknown;
    moneda?: unknown;
    costo?: unknown;
    stock?: unknown;
    sku?: unknown;
    categoria?: unknown;
  };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

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

  const producto = crearProducto(id, {
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
