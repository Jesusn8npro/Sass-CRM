import { NextResponse, type NextRequest } from "next/server";
import { verificarAccesoCuenta, parsearJSON } from "@/lib/auth/sesion";
import { db } from "@/lib/db/cliente";

export const dynamic = "force-dynamic";
interface Ctx { params: Promise<{ idCuenta: string }> }

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { idCuenta } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;

  // Solo el owner puede cambiar límites de gasto
  if (acceso.esMiembro) {
    return NextResponse.json({ error: "Solo el dueño puede modificar los límites" }, { status: 403 });
  }

  const body = await parsearJSON<{ limites: Record<string, number> }>(req);
  if (body instanceof NextResponse) return body;
  if (!body?.limites || typeof body.limites !== "object") {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  // Sanitizar: sólo valores numéricos >= 0
  const limites: Record<string, number> = {};
  for (const [k, v] of Object.entries(body.limites)) {
    const n = Number(v);
    if (isFinite(n) && n >= 0) limites[k] = n;
  }

  const { error } = await db()
    .from("cuentas")
    .update({ limites_gasto: limites })
    .eq("id", idCuenta);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, limites });
}
