import { NextResponse, type NextRequest } from "next/server";
import {
  listarInteresadosEnProducto,
  obtenerProducto,
} from "@/lib/baseDatos";
import { verificarAccesoCuenta } from "@/lib/auth/sesion";

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
  const interesados = await listarInteresadosEnProducto(idProducto);
  return NextResponse.json({ producto: prod, interesados });
}
