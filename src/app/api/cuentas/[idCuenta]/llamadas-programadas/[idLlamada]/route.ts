import { NextResponse, type NextRequest } from "next/server";
import {
  cancelarLlamadaProgramada,
  obtenerCuenta,
} from "@/lib/baseDatos";
import { requerirSesion } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string; idLlamada: string }>;
}

/**
 * "Borra" una llamada programada — en realidad la marca como cancelada
 * para mantener el historial. El scheduler la ignora (filtra por
 * estado='pendiente').
 */
export async function DELETE(req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta, idLlamada } = await params;
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }

  let razon = "cancelada por el operador";
  try {
    const body = (await req.json()) as { razon?: string } | null;
    if (body?.razon) razon = String(body.razon).slice(0, 300);
  } catch {
    // sin body es OK
  }

  await cancelarLlamadaProgramada(idLlamada, razon);
  return NextResponse.json({ ok: true });
}
