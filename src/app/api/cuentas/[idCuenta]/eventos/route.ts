import { NextResponse, type NextRequest } from "next/server";
import { verificarAccesoCuenta } from "@/lib/auth/sesion";
import {
  listarEventosNegocio,
  regenerarTokenEventos,
} from "@/lib/db/eventosNegocio";

export const dynamic = "force-dynamic";

/**
 * GET /api/cuentas/[idCuenta]/eventos
 *
 * Devuelve el token de disparadores y los últimos eventos recibidos, para
 * que el dueño arme sus triggers y vea si están llegando.
 *
 * El token SÍ se devuelve en claro: es el dueño de la cuenta mirando su
 * propia integración, igual que una API key en cualquier panel. El acceso
 * ya lo validó verificarAccesoCuenta.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ idCuenta: string }> },
) {
  const { idCuenta } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;
  const { cuenta } = acceso;

  const eventos = await listarEventosNegocio(idCuenta, 30);
  return NextResponse.json({
    token: cuenta.token_eventos ?? null,
    activos: cuenta.eventos_negocio_activos !== false,
    telefonoOperador: cuenta.telefono_operador_privado ?? null,
    alertasOperador: cuenta.operador_privado_alertas === true,
    eventos,
  });
}

/**
 * POST /api/cuentas/[idCuenta]/eventos — genera un token nuevo.
 *
 * Invalida el anterior: hay que actualizarlo en los triggers del negocio.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ idCuenta: string }> },
) {
  const { idCuenta } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;

  const token = await regenerarTokenEventos(idCuenta);
  return NextResponse.json({ token });
}
