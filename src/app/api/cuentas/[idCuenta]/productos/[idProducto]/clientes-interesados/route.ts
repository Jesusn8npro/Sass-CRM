import { NextResponse, type NextRequest } from "next/server";
import {
  listarInteresadosEnProducto,
  obtenerProducto,
} from "@/lib/baseDatos";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string; idProducto: string }>;
}

export async function GET(_req: NextRequest, { params }: Contexto) {
  const { idCuenta, idProducto } = await params;
  const idC = Number(idCuenta);
  const idP = Number(idProducto);
  if (
    !Number.isFinite(idC) ||
    idC <= 0 ||
    !Number.isFinite(idP) ||
    idP <= 0
  ) {
    return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
  }
  const prod = obtenerProducto(idP);
  if (!prod || prod.cuenta_id !== idC) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }
  const interesados = listarInteresadosEnProducto(idP);
  return NextResponse.json({ producto: prod, interesados });
}
