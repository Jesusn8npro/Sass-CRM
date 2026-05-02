import { NextResponse, type NextRequest } from "next/server";
import path from "node:path";
import fs from "node:fs";
import { actualizarEstadoCuenta, obtenerCuenta } from "@/lib/baseDatos";
import { requerirSesion } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

export async function POST(_req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta } = await params;
  if (!idCuenta) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }

  // Marcar como desconectada y limpiar auth/{id}/. El gestor del bot
  // detecta el cambio en su próxima sincronización (cada 3s) y reinicia
  // el socket — al no haber auth, se genera un QR nuevo.
  await actualizarEstadoCuenta(idCuenta, {
    estado: "desconectado",
    cadena_qr: null,
    telefono: null,
  });

  const dirAuth = path.resolve(process.cwd(), "auth", String(idCuenta));
  try {
    fs.rmSync(dirAuth, { recursive: true, force: true });
  } catch (err) {
    console.warn(`[api] no se pudo limpiar auth/${idCuenta}:`, err);
  }

  return NextResponse.json({ ok: true });
}
