import { NextResponse, type NextRequest } from "next/server";
import { eliminarCuentaAdmin, obtenerCuenta } from "@/lib/db/cuentas";
import {
  obtenerSuperAdminPorEmail,
  registrarAccionAdmin,
} from "@/lib/baseDatos";
import { requerirAdmin } from "@/lib/auth/sesion";
import { obtenerGestor } from "@/lib/baileys/gestor";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/admin/cuentas/[id] — borrado profundo de UNA cuenta del
 * SaaS. Antes del DELETE, intenta desconectar la sesión Baileys activa
 * (si la hay) para evitar que un socket huérfano siga corriendo después
 * de que su fila desaparezca.
 */
export async function DELETE(_req: NextRequest, { params }: Contexto) {
  const auth = await requerirAdmin();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const cuenta = await obtenerCuenta(id);
  if (!cuenta) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }

  // Best-effort: desconectar el socket Baileys si estaba corriendo.
  try {
    const gestor = obtenerGestor();
    await gestor.desconectar(id, /* limpiarAuth */ true);
  } catch (err) {
    console.warn("[admin/cuentas DELETE] no se pudo desconectar socket:", err);
  }

  await eliminarCuentaAdmin(id);

  const sa = await obtenerSuperAdminPorEmail(auth.email);
  if (sa) {
    void registrarAccionAdmin({
      superAdminId: sa.id,
      origen: "panel",
      accion: "cuenta_eliminar",
      payload: { cuenta_id: id, etiqueta: cuenta.etiqueta },
    });
  }
  return NextResponse.json({ ok: true });
}
