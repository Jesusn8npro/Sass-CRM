import { NextResponse, type NextRequest } from "next/server";
import {
  actualizarProducto,
  borrarProducto,
  obtenerProducto,
} from "@/lib/baseDatos";
import { borrarImagenProducto } from "@/lib/productos";
import { parsearJSON, verificarAccesoCuenta } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string; idProducto: string }>;
}

export async function GET(_req: NextRequest, { params }: Contexto) {
  const { idCuenta, idProducto } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;
  if (!idProducto) {
    return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
  }
  const prod = await obtenerProducto(idProducto);
  if (!prod || prod.cuenta_id !== idCuenta) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }
  return NextResponse.json({ producto: prod });
}

export async function PATCH(req: NextRequest, { params }: Contexto) {
  const { idCuenta, idProducto } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;
  if (!idProducto) {
    return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
  }
  const prod = await obtenerProducto(idProducto);
  if (!prod || prod.cuenta_id !== idCuenta) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }

  const payload = await parsearJSON<Record<string, unknown>>(req);
  if (payload instanceof NextResponse) return payload;

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
    cambios.esta_activo = payload.esta_activo;
  }
  if (
    typeof payload.orden === "number" &&
    Number.isFinite(payload.orden)
  ) {
    cambios.orden = payload.orden;
  }

  const actualizado = await actualizarProducto(idProducto, cambios);
  return NextResponse.json({ producto: actualizado });
}

export async function DELETE(_req: NextRequest, { params }: Contexto) {
  const { idCuenta, idProducto } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;
  if (!idProducto) {
    return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
  }
  const prod = await obtenerProducto(idProducto);
  if (!prod || prod.cuenta_id !== idCuenta) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }
  borrarImagenProducto(prod.imagen_path);
  await borrarProducto(idProducto);
  return NextResponse.json({ ok: true });
}
