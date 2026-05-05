import { NextResponse, type NextRequest } from "next/server";
import { listarPagosPaginado, type EstadoPago } from "@/lib/baseDatos";
import { requerirAdmin } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

const ESTADOS_VALIDOS: EstadoPago[] = [
  "pendiente",
  "aprobado",
  "fallido",
  "reembolsado",
  "cancelado",
];

/**
 * GET /api/admin/pagos — historial paginado.
 * Query: estado, desde (ISO), hasta (ISO), pagina, limite
 */
export async function GET(req: NextRequest) {
  const auth = await requerirAdmin();
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const limite = Math.min(
    Math.max(parseInt(url.searchParams.get("limite") ?? "20", 10) || 20, 1),
    100,
  );
  const pagina = Math.max(parseInt(url.searchParams.get("pagina") ?? "1", 10) || 1, 1);
  const offset = (pagina - 1) * limite;

  const estadoRaw = url.searchParams.get("estado");
  const estado = ESTADOS_VALIDOS.includes(estadoRaw as EstadoPago)
    ? (estadoRaw as EstadoPago)
    : undefined;

  const { pagos, total } = await listarPagosPaginado({
    estado,
    desde: url.searchParams.get("desde") ?? undefined,
    hasta: url.searchParams.get("hasta") ?? undefined,
    offset,
    limite,
  });

  return NextResponse.json({
    pagos,
    total,
    pagina,
    limite,
    paginas: Math.max(1, Math.ceil(total / limite)),
  });
}
