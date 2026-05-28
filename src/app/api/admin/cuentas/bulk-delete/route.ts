import { NextResponse, type NextRequest } from "next/server";
import { eliminarCuentaAdmin, obtenerCuenta } from "@/lib/db/cuentas";
import {
  obtenerSuperAdminPorEmail,
  registrarAccionAdmin,
} from "@/lib/baseDatos";
import { parsearJSON, requerirAdmin } from "@/lib/auth/sesion";
import { obtenerGestor } from "@/lib/baileys/gestor";

export const dynamic = "force-dynamic";

interface Cuerpo {
  ids: string[];
}

/**
 * POST /api/admin/cuentas/bulk-delete — borrado por lotes de cuentas.
 * Tope 50 por request. Desconecta cada socket Baileys antes del DELETE.
 */
export async function POST(req: NextRequest) {
  const auth = await requerirAdmin();
  if (auth instanceof NextResponse) return auth;

  const cuerpo = await parsearJSON<Cuerpo>(req);
  if (cuerpo instanceof NextResponse) return cuerpo;

  const ids = Array.isArray(cuerpo.ids)
    ? cuerpo.ids.filter((x) => typeof x === "string")
    : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "ids vacío" }, { status: 400 });
  }
  if (ids.length > 50) {
    return NextResponse.json(
      { error: "Máximo 50 cuentas por request" },
      { status: 400 },
    );
  }

  const gestor = obtenerGestor();
  let borradas = 0;
  const errores: { id: string; error: string }[] = [];

  for (const id of ids) {
    try {
      const cuenta = await obtenerCuenta(id);
      if (!cuenta) {
        errores.push({ id, error: "no encontrada" });
        continue;
      }
      // Best-effort: desconectar socket si está corriendo
      try {
        await gestor.desconectar(id, /* limpiarAuth */ true);
      } catch (err) {
        console.warn(`[bulk-delete cuentas] socket ${id}:`, err);
      }
      await eliminarCuentaAdmin(id);
      borradas++;
    } catch (err) {
      errores.push({
        id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const sa = await obtenerSuperAdminPorEmail(auth.email);
  if (sa) {
    void registrarAccionAdmin({
      superAdminId: sa.id,
      origen: "panel",
      accion: "cuentas_bulk_delete",
      payload: { intentadas: ids.length, borradas, errores: errores.length },
    });
  }

  return NextResponse.json({
    ok: true,
    borradas,
    intentadas: ids.length,
    errores,
  });
}
