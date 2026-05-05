import { NextResponse, type NextRequest } from "next/server";
import {
  agregarCreditos,
  listarCuentasDeUsuarioAdmin,
  listarPagosUsuario,
  marcarBillingUsuario,
  obtenerSaldo,
  obtenerUsuarioApp,
} from "@/lib/baseDatos";
import { parsearJSON, requerirAdmin } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/usuarios/[id] — detalle del usuario: cuentas, pagos
 * recientes y saldos por cuenta.
 */
export async function GET(_req: NextRequest, { params }: Contexto) {
  const auth = await requerirAdmin();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const usuario = await obtenerUsuarioApp(id);
  if (!usuario) {
    return NextResponse.json(
      { error: "Usuario no encontrado" },
      { status: 404 },
    );
  }

  const cuentas = await listarCuentasDeUsuarioAdmin(id);
  const saldos = await Promise.all(
    cuentas.map(async (c) => ({
      cuenta_id: c.id,
      saldo: await obtenerSaldo(c.id),
    })),
  );
  const pagos = await listarPagosUsuario(id, 50);

  return NextResponse.json({ usuario, cuentas, saldos, pagos });
}

interface CuerpoPatch {
  /** "suspender" | "reactivar" | "dar_saldo" */
  accion: string;
  cuentaId?: string;
  cantidadCreditos?: number;
}

/**
 * PATCH /api/admin/usuarios/[id] — acciones del operador:
 *   - suspender / reactivar → toca usuarios.estado_billing
 *   - dar_saldo → suma créditos a una cuenta específica del usuario
 */
export async function PATCH(req: NextRequest, { params }: Contexto) {
  const auth = await requerirAdmin();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const cuerpo = await parsearJSON<CuerpoPatch>(req);
  if (cuerpo instanceof NextResponse) return cuerpo;

  const usuario = await obtenerUsuarioApp(id);
  if (!usuario) {
    return NextResponse.json(
      { error: "Usuario no encontrado" },
      { status: 404 },
    );
  }

  if (cuerpo.accion === "suspender") {
    await marcarBillingUsuario(id, "suspendido");
    return NextResponse.json({ ok: true });
  }
  if (cuerpo.accion === "reactivar") {
    await marcarBillingUsuario(id, "activo");
    return NextResponse.json({ ok: true });
  }
  if (cuerpo.accion === "dar_saldo") {
    const cantidad = Number(cuerpo.cantidadCreditos);
    if (!cuerpo.cuentaId || !Number.isFinite(cantidad) || cantidad <= 0) {
      return NextResponse.json(
        { error: "cuentaId y cantidadCreditos > 0 requeridos" },
        { status: 400 },
      );
    }
    // Verificamos que la cuenta sea del usuario antes de tocarla.
    const cuentas = await listarCuentasDeUsuarioAdmin(id, true);
    if (!cuentas.find((c) => c.id === cuerpo.cuentaId)) {
      return NextResponse.json(
        { error: "Cuenta no pertenece al usuario" },
        { status: 400 },
      );
    }
    await agregarCreditos(cuerpo.cuentaId, cantidad);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
}
