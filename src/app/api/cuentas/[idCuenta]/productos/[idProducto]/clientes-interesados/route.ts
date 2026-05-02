import { NextResponse, type NextRequest } from "next/server";
import {
  listarInteresadosEnProducto,
  obtenerCuenta,
  obtenerProducto,
} from "@/lib/baseDatos";
import { requerirSesion } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string; idProducto: string }>;
}

export async function GET(_req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta, idProducto } = await params;
  if (!idCuenta || !idProducto) {
    return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
  }
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }
  const prod = await obtenerProducto(idProducto);
  if (!prod || prod.cuenta_id !== idCuenta) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }
  const interesados = await listarInteresadosEnProducto(idProducto);
  return NextResponse.json({ producto: prod, interesados });
}
