/**
 * GET /api/v1/conversaciones/[idCuenta]
 *
 * Endpoint público de la API v1. Lista las últimas N conversaciones
 * de la cuenta.
 *
 * Query: `?limite=50` (default 50, máx 200).
 *
 * Auth: header `Authorization: Bearer sk_live_...` scopeada a `idCuenta`.
 */
import { NextResponse, type NextRequest } from "next/server";
import { listarConversaciones } from "@/lib/baseDatos";
import { verificarApiKey } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

export async function GET(req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const auth = await verificarApiKey(req);
  if (auth instanceof NextResponse) return auth;

  if (auth.cuenta.id !== idCuenta) {
    return NextResponse.json(
      { error: "Esta API key no tiene acceso a esa cuenta" },
      { status: 403 },
    );
  }

  if (!auth.apiKey.permisos.includes("read")) {
    return NextResponse.json(
      { error: "Esta API key no tiene permiso de lectura" },
      { status: 403 },
    );
  }

  const limiteRaw = req.nextUrl.searchParams.get("limite");
  const limiteParsed = limiteRaw ? parseInt(limiteRaw, 10) : 50;
  const limite = Math.max(
    1,
    Math.min(200, Number.isFinite(limiteParsed) ? limiteParsed : 50),
  );

  const todas = await listarConversaciones(idCuenta);
  const conversaciones = todas.slice(0, limite).map((c) => ({
    id: c.id,
    telefono: c.telefono,
    nombre: c.nombre,
    modo: c.modo,
    necesita_humano: c.necesita_humano,
    estado_lead: c.estado_lead,
    lead_score: c.lead_score,
    etapa_id: c.etapa_id,
    ultimo_mensaje_en: c.ultimo_mensaje_en,
    vista_previa: c.vista_previa_ultimo_mensaje,
  }));

  return NextResponse.json({ conversaciones, total: todas.length });
}
