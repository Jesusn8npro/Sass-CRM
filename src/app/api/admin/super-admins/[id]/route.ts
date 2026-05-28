import { NextResponse, type NextRequest } from "next/server";
import {
  actualizarSuperAdminAdmin,
  eliminarSuperAdminAdmin,
  obtenerSuperAdminPorEmail,
  registrarAccionAdmin,
} from "@/lib/baseDatos";
import { parsearJSON, requerirAdmin } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ id: string }>;
}

interface CuerpoPatch {
  email?: string;
  telefono_whatsapp?: string;
  nombre?: string | null;
  activo?: boolean;
}

/** PATCH — Editar campos del super-admin. */
export async function PATCH(req: NextRequest, { params }: Contexto) {
  const auth = await requerirAdmin();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const cuerpo = await parsearJSON<CuerpoPatch>(req);
  if (cuerpo instanceof NextResponse) return cuerpo;

  try {
    const actualizado = await actualizarSuperAdminAdmin(id, cuerpo);
    const sa = await obtenerSuperAdminPorEmail(auth.email);
    if (sa) {
      void registrarAccionAdmin({
        superAdminId: sa.id,
        origen: "panel",
        accion: "super_admin_editar",
        payload: { id, cambios: Object.keys(cuerpo) },
      });
    }
    return NextResponse.json({ ok: true, item: actualizado });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("23505") || msg.toLowerCase().includes("duplicate")) {
      return NextResponse.json(
        { error: "Email o teléfono ya en uso por otro super-admin" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

/** DELETE — Elimina el super-admin. No se permite borrarte a vos mismo. */
export async function DELETE(_req: NextRequest, { params }: Contexto) {
  const auth = await requerirAdmin();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  // Protección: no permitir que el admin se borre a sí mismo de la tabla
  // de super_admins (si su email matchea con el de la fila).
  const sa = await obtenerSuperAdminPorEmail(auth.email);
  if (sa && sa.id === id) {
    return NextResponse.json(
      { error: "No podés borrarte a vos mismo de super-admins" },
      { status: 400 },
    );
  }

  await eliminarSuperAdminAdmin(id);
  if (sa) {
    void registrarAccionAdmin({
      superAdminId: sa.id,
      origen: "panel",
      accion: "super_admin_eliminar",
      payload: { id_eliminado: id },
    });
  }
  return NextResponse.json({ ok: true });
}
