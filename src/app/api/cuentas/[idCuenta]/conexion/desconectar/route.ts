import { NextResponse, type NextRequest } from "next/server";
import path from "node:path";
import fs from "node:fs";
import { actualizarEstadoCuenta, obtenerCuenta } from "@/lib/baseDatos";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

export async function POST(_req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const id = Number(idCuenta);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const cuenta = obtenerCuenta(id);
  if (!cuenta) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }

  // Marcar como desconectada y limpiar auth/{id}/. El gestor del bot
  // detecta el cambio en su próxima sincronización (cada 3s) y reinicia
  // el socket — al no haber auth, se genera un QR nuevo.
  actualizarEstadoCuenta(id, {
    estado: "desconectado",
    cadena_qr: null,
    telefono: null,
  });

  const dirAuth = path.resolve(process.cwd(), "auth", String(id));
  try {
    fs.rmSync(dirAuth, { recursive: true, force: true });
  } catch (err) {
    console.warn(`[api] no se pudo limpiar auth/${id}:`, err);
  }

  return NextResponse.json({ ok: true });
}
