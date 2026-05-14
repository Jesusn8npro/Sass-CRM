import { NextResponse } from "next/server";
import { verificarAccesoCuenta } from "@/lib/auth/sesion";
import { listarLeadsProspeccion } from "@/lib/db/leadsExtraidos";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ idCuenta: string }> },
) {
  const { idCuenta } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;

  const url = new URL(req.url);
  const limite = Math.min(parseInt(url.searchParams.get("limite") ?? "100", 10), 200);

  const leads = await listarLeadsProspeccion(idCuenta, limite);
  return NextResponse.json({ leads });
}
