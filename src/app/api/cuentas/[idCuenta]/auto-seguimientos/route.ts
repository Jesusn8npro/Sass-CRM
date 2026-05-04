import { NextResponse, type NextRequest } from "next/server";
import {
  actualizarCuenta,
  listarPasosAutoSeguimiento,
  obtenerCuenta,
  reemplazarPasosAutoSeguimiento,
} from "@/lib/baseDatos";
import { requerirSesion } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

interface PasoBody {
  minutos_despues: number;
  mensaje: string;
}

interface BodyPut {
  activo: boolean;
  pasos: PasoBody[];
}

/**
 * GET /api/cuentas/[idCuenta]/auto-seguimientos
 * Devuelve { activo, pasos[] }
 */
export async function GET(_req: NextRequest, { params }: Contexto) {
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

  const pasos = await listarPasosAutoSeguimiento(idCuenta);
  return NextResponse.json({
    activo: !!cuenta.auto_seguimiento_activo,
    pasos: pasos.map((p) => ({
      orden: p.orden,
      minutos_despues: p.minutos_despues,
      mensaje: p.mensaje,
    })),
  });
}

/**
 * PUT /api/cuentas/[idCuenta]/auto-seguimientos
 * Body: { activo, pasos: [{ minutos_despues, mensaje }] }
 *
 * Reemplaza la config completa: actualiza el toggle de la cuenta y
 * los pasos. Más simple que tener endpoints separados por paso —
 * la cantidad de pasos por cuenta es chica (1-5 típicamente).
 */
export async function PUT(req: NextRequest, { params }: Contexto) {
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

  let body: BodyPut;
  try {
    body = (await req.json()) as BodyPut;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  if (typeof body.activo !== "boolean") {
    return NextResponse.json(
      { error: "activo_invalido" },
      { status: 400 },
    );
  }
  if (!Array.isArray(body.pasos)) {
    return NextResponse.json({ error: "pasos_invalido" }, { status: 400 });
  }
  if (body.pasos.length > 10) {
    return NextResponse.json(
      { error: "demasiados_pasos", mensaje: "Máximo 10 pasos" },
      { status: 400 },
    );
  }

  // Si está activando pero no tiene pasos, no tiene sentido
  if (body.activo && body.pasos.length === 0) {
    return NextResponse.json(
      {
        error: "sin_pasos",
        mensaje: "Para activar auto-seguimientos necesitás definir al menos 1 paso",
      },
      { status: 400 },
    );
  }

  try {
    await reemplazarPasosAutoSeguimiento(
      idCuenta,
      body.pasos.map((p, i) => ({
        orden: i + 1,
        minutos_despues: Math.floor(p.minutos_despues),
        mensaje: p.mensaje,
      })),
    );
    await actualizarCuenta(idCuenta, {
      auto_seguimiento_activo: body.activo,
    } as Parameters<typeof actualizarCuenta>[1]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      {
        error: "error_guardando",
        mensaje: err instanceof Error ? err.message : String(err),
      },
      { status: 400 },
    );
  }
}
