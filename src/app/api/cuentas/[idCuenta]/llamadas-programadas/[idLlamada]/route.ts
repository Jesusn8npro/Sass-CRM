import { NextResponse, type NextRequest } from "next/server";
import {
  cancelarLlamadaProgramada,
} from "@/lib/baseDatos";
import { verificarAccesoCuenta } from "@/lib/auth/sesion";

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
  const { idCuenta, idLlamada } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;

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
