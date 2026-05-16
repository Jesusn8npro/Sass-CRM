import { NextResponse, type NextRequest } from "next/server";
import { parsearJSON, verificarAccesoCuenta } from "@/lib/auth/sesion";
import { asignarConversacion } from "@/lib/db/cuentaMiembros";

export const dynamic = "force-dynamic";
interface Ctx { params: Promise<{ idCuenta: string; idConversacion: string }> }

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { idCuenta, idConversacion } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;

  const body = await parsearJSON<{ asignadoA?: unknown }>(req);
  if (body instanceof NextResponse) return body;

  const asignadoA = typeof body.asignadoA === "string" ? body.asignadoA : null;
  await asignarConversacion(idConversacion, idCuenta, asignadoA);
  return NextResponse.json({ ok: true });
}
