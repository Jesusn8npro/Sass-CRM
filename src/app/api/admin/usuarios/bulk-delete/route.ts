import { NextResponse, type NextRequest } from "next/server";
import {
  obtenerSuperAdminPorEmail,
  obtenerUsuarioApp,
  registrarAccionAdmin,
} from "@/lib/baseDatos";
import { eliminarUsuarioAdmin } from "@/lib/db/usuarios";
import { parsearJSON, requerirAdmin } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Cuerpo {
  ids: string[];
}

/**
 * POST /api/admin/usuarios/bulk-delete — borra una lista de usuarios.
 * Tope de 50 por request. Excluye el propio admin si viene en la lista.
 * Devuelve cuántos se borraron y cuáles fallaron.
 */
export async function POST(req: NextRequest) {
  const auth = await requerirAdmin();
  if (auth instanceof NextResponse) return auth;

  const cuerpo = await parsearJSON<Cuerpo>(req);
  if (cuerpo instanceof NextResponse) return cuerpo;

  const ids = Array.isArray(cuerpo.ids) ? cuerpo.ids.filter((x) => typeof x === "string") : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "ids vacío" }, { status: 400 });
  }
  if (ids.length > 50) {
    return NextResponse.json(
      { error: "Máximo 50 usuarios por request" },
      { status: 400 },
    );
  }

  const idsValidos = ids.filter((id) => id !== auth.id);
  const omitidoPropio = idsValidos.length !== ids.length;

  let borrados = 0;
  const errores: { id: string; error: string }[] = [];
  for (const id of idsValidos) {
    try {
      const u = await obtenerUsuarioApp(id);
      if (!u) {
        errores.push({ id, error: "no encontrado" });
        continue;
      }
      await eliminarUsuarioAdmin(id);
      borrados++;
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
      accion: "usuarios_bulk_delete",
      payload: { intentados: idsValidos.length, borrados, errores: errores.length },
    });
  }

  return NextResponse.json({
    ok: true,
    borrados,
    intentados: idsValidos.length,
    errores,
    omitidoPropio,
  });
}
