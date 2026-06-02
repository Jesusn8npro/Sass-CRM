import { NextResponse, type NextRequest } from "next/server";
import { verificarAccesoCuenta, parsearJSON } from "@/lib/auth/sesion";
import {
  listarLeadsChatWeb,
  obtenerTokenChatWeb,
  generarTokenChatWeb,
} from "@/lib/db/leadsChatWeb";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET — leads de la cuenta + token actual del widget. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ idCuenta: string }> },
) {
  const { idCuenta } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;

  const estado = new URL(req.url).searchParams.get("estado") || undefined;
  const [leads, token] = await Promise.all([
    listarLeadsChatWeb(idCuenta, estado || undefined),
    obtenerTokenChatWeb(idCuenta),
  ]);
  return NextResponse.json({ leads, token });
}

/** POST { accion: "generar_token" } — genera o rota el token del widget. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ idCuenta: string }> },
) {
  const { idCuenta } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;

  const body = await parsearJSON<{ accion?: string }>(req);
  if (body instanceof NextResponse) return body;

  if (body.accion === "generar_token") {
    const token = await generarTokenChatWeb(idCuenta);
    return NextResponse.json({ ok: true, token });
  }
  return NextResponse.json({ error: "accion_invalida" }, { status: 400 });
}
