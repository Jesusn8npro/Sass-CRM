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
import { eliminarUsuarioAdmin, setRolUsuarioAdmin } from "@/lib/db/usuarios";
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

  const [usuario, cuentas, pagos] = await Promise.all([
    obtenerUsuarioApp(id),
    listarCuentasDeUsuarioAdmin(id),
    listarPagosUsuario(id, 50),
  ]);
  if (!usuario) {
    return NextResponse.json(
      { error: "Usuario no encontrado" },
      { status: 404 },
    );
  }

  const saldos = await Promise.all(
    cuentas.map(async (c) => ({
      cuenta_id: c.id,
      saldo: await obtenerSaldo(c.id),
    })),
  );

  return NextResponse.json({ usuario, cuentas, saldos, pagos });
}

interface CuerpoPatch {
  /** "suspender" | "reactivar" | "dar_saldo" | "set_cuentas_extra" | "set_rol" */
  accion: string;
  cuentaId?: string;
  cantidadCreditos?: number;
  /** Para set_cuentas_extra: cantidad nueva de cuentas extra (0-100). */
  cuentasExtra?: number;
  /** Para set_rol: 'cliente' | 'admin_plataforma'. */
  rol?: "cliente" | "admin_plataforma";
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
    const [, sa] = await Promise.all([
      marcarBillingUsuario(id, "suspendido"),
      obtenerSuperAdminPorEmail(auth.email),
    ]);
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
    const [, sa] = await Promise.all([
      marcarBillingUsuario(id, "activo"),
      obtenerSuperAdminPorEmail(auth.email),
    ]);
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
  if (cuerpo.accion === "set_rol") {
    const rolNuevo = cuerpo.rol;
    if (rolNuevo !== "cliente" && rolNuevo !== "admin_plataforma") {
      return NextResponse.json(
        { error: "rol debe ser 'cliente' o 'admin_plataforma'" },
        { status: 400 },
      );
    }
    if (id === auth.id && rolNuevo === "cliente") {
      return NextResponse.json(
        { error: "No podés removerte el rol admin a vos mismo" },
        { status: 400 },
      );
    }
    await setRolUsuarioAdmin(id, rolNuevo);
    const sa = await obtenerSuperAdminPorEmail(auth.email);
    if (sa) {
      void registrarAccionAdmin({
        superAdminId: sa.id,
        origen: "panel",
        accion: "usuario_set_rol",
        payload: { usuario_id: id, rol: rolNuevo },
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

/**
 * DELETE /api/admin/usuarios/[id] — borrado profundo del usuario:
 * cascadea a cuentas → mensajes/conversaciones/pagos/etc. Operación
 * irreversible. No se permite auto-borrado.
 */
export async function DELETE(_req: NextRequest, { params }: Contexto) {
  const auth = await requerirAdmin();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  if (id === auth.id) {
    return NextResponse.json(
      { error: "No podés borrarte a vos mismo" },
      { status: 400 },
    );
  }

  const usuario = await obtenerUsuarioApp(id);
  if (!usuario) {
    return NextResponse.json(
      { error: "Usuario no encontrado" },
      { status: 404 },
    );
  }

  await eliminarUsuarioAdmin(id);

  const sa = await obtenerSuperAdminPorEmail(auth.email);
  if (sa) {
    void registrarAccionAdmin({
      superAdminId: sa.id,
      origen: "panel",
      accion: "usuario_eliminar",
      payload: { usuario_id: id, email: usuario.email },
    });
  }
  return NextResponse.json({ ok: true });
}
