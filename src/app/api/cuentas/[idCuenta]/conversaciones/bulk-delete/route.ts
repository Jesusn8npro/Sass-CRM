import { NextResponse, type NextRequest } from "next/server";
import {
  borrarConversaciones,
  obtenerCuenta,
} from "@/lib/baseDatos";
import { requerirSesion } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

interface BodyRequest {
  ids: string[];
}

/**
 * POST /api/cuentas/[idCuenta]/conversaciones/bulk-delete
 * Body: { ids: string[] }
 *
 * Borra varias conversaciones a la vez. La cascada de las FK
 * (mensajes, bandeja_salida, etiquetas, etc) se encarga de limpiar
 * todo lo asociado.
 */
export async function POST(req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta } = await params;
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json(
      { error: "cuenta_no_encontrada" },
      { status: 404 },
    );
  }

  let body: BodyRequest;
  try {
    body = (await req.json()) as BodyRequest;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return NextResponse.json(
      { error: "ids_vacio", mensaje: "Pasá al menos un ID" },
      { status: 400 },
    );
  }
  if (body.ids.length > 500) {
    return NextResponse.json(
      { error: "demasiados_ids", mensaje: "Máximo 500 por request" },
      { status: 400 },
    );
  }

  const borradas = await borrarConversaciones(idCuenta, body.ids);
  return NextResponse.json({ ok: true, borradas });
}
