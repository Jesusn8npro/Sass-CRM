import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Endpoint público de versión — para verificar QUÉ commit está corriendo en
 * producción. Si al pegar /api/version el "version" NO coincide con el último
 * commit, el deploy quedó atrás (EasyPanel no actualizó el código).
 *
 * Subí este número a mano en cada cambio importante que quieras verificar.
 */
const VERSION = "cero-invencion-busqueda-2026-06-02-v4";

export function GET() {
  return NextResponse.json({
    version: VERSION,
    desplegado_en: new Date().toISOString(),
  });
}
