import { NextResponse, type NextRequest } from "next/server";
import {
  agregarCreditos,
  listarCuentasDeUsuarioAdmin,
  listarPagosUsuario,
  marcarBillingUsuario,
  obtenerSaldo,
  obtenerUsuarioApp,
  obtenerSuperAdminPorEmail,
  registrarAccionAdmin,
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
  /** "suspender" | "reactivar" | "dar_saldo" | "set_cuentas_extra" */
  accion: string;
  cuentaId?: string;
  cantidadCreditos?: number;
  /** Para set_cuentas_extra: cantidad nueva de cuentas extra (0-100). */
  cuentasExtra?: number;
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
    const sa = await obtenerSuperAdminPorEmail(auth.email);
    if (sa) {
      void registrarAccionAdmin({
        superAdminId: sa.id,
        origen: "panel",
        accion: "usuario_suspender",
        payload: { usuario_id: id },
      });
    }
    return NextResponse.json({ ok: true });
  }
  if (cuerpo.accion === "reactivar") {
    await marcarBillingUsuario(id, "activo");
    const sa = await obtenerSuperAdminPorEmail(auth.email);
    if (sa) {
      void registrarAccionAdmin({
        superAdminId: sa.id,
        origen: "panel",
        accion: "usuario_reactivar",
        payload: { usuario_id: id },
      });
    }
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
    const sa = await obtenerSuperAdminPorEmail(auth.email);
    if (sa) {
      void registrarAccionAdmin({
        superAdminId: sa.id,
        origen: "panel",
        accion: "usuario_dar_saldo",
        payload: { usuario_id: id, cuenta_id: cuerpo.cuentaId, cantidad },
      });
    }
    return NextResponse.json({ ok: true });
  }
  if (cuerpo.accion === "set_cuentas_extra") {
    const extra = Number(cuerpo.cuentasExtra);
    if (!Number.isFinite(extra) || extra < 0 || extra > 100) {
      return NextResponse.json(
        { error: "cuentasExtra debe ser un entero entre 0 y 100" },
        { status: 400 },
      );
    }
    const { setCuentasExtraAdmin } = await import("@/lib/db/usuarios");
    const actualizado = await setCuentasExtraAdmin(id, Math.floor(extra));
    const sa = await obtenerSuperAdminPorEmail(auth.email);
    if (sa) {
      void registrarAccionAdmin({
        superAdminId: sa.id,
        origen: "panel",
        accion: "usuario_set_cuentas_extra",
        payload: { usuario_id: id, cuentas_extra: Math.floor(extra) },
      });
    }
    return NextResponse.json({ ok: true, usuario: actualizado });
  }

  return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
}
