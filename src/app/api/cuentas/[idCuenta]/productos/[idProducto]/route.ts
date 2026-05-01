import { NextResponse, type NextRequest } from "next/server";
import {
  actualizarProducto,
  borrarProducto,
  obtenerCuenta,
  obtenerProducto,
} from "@/lib/baseDatos";
import { borrarImagenProducto } from "@/lib/productos";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string; idProducto: string }>;
}

function validarIds(ic: string, ip: string) {
  const idCuenta = Number(ic);
  const idProducto = Number(ip);
  if (
    !Number.isFinite(idCuenta) ||
    idCuenta <= 0 ||
    !Number.isFinite(idProducto) ||
    idProducto <= 0
  ) {
    return null;
  }
  return { idCuenta, idProducto };
}

export async function GET(_req: NextRequest, { params }: Contexto) {
  const { idCuenta, idProducto } = await params;
  const ids = validarIds(idCuenta, idProducto);
  if (!ids) {
    return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
  }
  const prod = obtenerProducto(ids.idProducto);
  if (!prod || prod.cuenta_id !== ids.idCuenta) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }
  return NextResponse.json({ producto: prod });
}

export async function PATCH(req: NextRequest, { params }: Contexto) {
  const { idCuenta, idProducto } = await params;
  const ids = validarIds(idCuenta, idProducto);
  if (!ids) {
    return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
  }
  if (!obtenerCuenta(ids.idCuenta)) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }
  const prod = obtenerProducto(ids.idProducto);
  if (!prod || prod.cuenta_id !== ids.idCuenta) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const cambios: Parameters<typeof actualizarProducto>[1] = {};
  if (typeof payload.nombre === "string" && payload.nombre.trim()) {
    cambios.nombre = payload.nombre.trim();
  }
  if (typeof payload.descripcion === "string") {
    cambios.descripcion = payload.descripcion;
  }
  if (
    typeof payload.precio === "number" &&
    Number.isFinite(payload.precio)
  ) {
    cambios.precio = payload.precio;
  } else if (payload.precio === null) {
    cambios.precio = null;
  }
  if (typeof payload.moneda === "string" && payload.moneda.trim()) {
    cambios.moneda = payload.moneda.trim().toUpperCase().slice(0, 5);
  }
  if (typeof payload.costo === "number" && Number.isFinite(payload.costo)) {
    cambios.costo = payload.costo;
  } else if (payload.costo === null) {
    cambios.costo = null;
  }
  if (typeof payload.stock === "number" && Number.isFinite(payload.stock)) {
    cambios.stock = Math.max(0, Math.floor(payload.stock));
  } else if (payload.stock === null) {
    cambios.stock = null;
  }
  if (typeof payload.sku === "string") {
    cambios.sku = payload.sku.trim() || null;
  }
  if (typeof payload.categoria === "string") {
    cambios.categoria = payload.categoria.trim() || null;
  }
  if (typeof payload.esta_activo === "boolean") {
    cambios.esta_activo = payload.esta_activo ? 1 : 0;
  } else if (typeof payload.esta_activo === "number") {
    cambios.esta_activo = payload.esta_activo ? 1 : 0;
  }
  if (
    typeof payload.orden === "number" &&
    Number.isFinite(payload.orden)
  ) {
    cambios.orden = payload.orden;
  }

  const actualizado = actualizarProducto(ids.idProducto, cambios);
  return NextResponse.json({ producto: actualizado });
}

export async function DELETE(_req: NextRequest, { params }: Contexto) {
  const { idCuenta, idProducto } = await params;
  const ids = validarIds(idCuenta, idProducto);
  if (!ids) {
    return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
  }
  const prod = obtenerProducto(ids.idProducto);
  if (!prod || prod.cuenta_id !== ids.idCuenta) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }
  borrarImagenProducto(prod.imagen_path);
  borrarProducto(ids.idProducto);
  return NextResponse.json({ ok: true });
}
