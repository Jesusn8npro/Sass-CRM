/**
 * Endpoint para el panel admin: gestiona qué cuenta del SaaS funciona
 * como canal admin global (`es_panel_admin = true`).
 *
 *   GET  /api/admin/agente-admin  → estado actual (cuenta marcada o null)
 *   POST /api/admin/agente-admin  → body: { cuenta_id } marca esa cuenta
 *                                    (desmarca cualquier otra automáticamente)
 *   DELETE /api/admin/agente-admin → desmarca la cuenta panel admin actual
 *                                    (deja al SaaS sin canal admin)
 */
import { NextRequest, NextResponse } from "next/server";
import { requerirAdmin } from "@/lib/auth/sesion";
import {
  obtenerCuentaPanelAdmin,
  marcarCuentaComoPanelAdmin,
  desmarcarCuentaComoPanelAdmin,
  obtenerCuenta,
  obtenerSuperAdminPorEmail,
  registrarAccionAdmin,
} from "@/lib/baseDatos";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requerirAdmin();
  if (auth instanceof NextResponse) return auth;

  const cuenta = await obtenerCuentaPanelAdmin();
  return NextResponse.json({
    cuenta_panel_admin: cuenta
      ? {
          id: cuenta.id,
          etiqueta: cuenta.etiqueta,
          telefono: cuenta.telefono,
          estado: cuenta.estado,
        }
      : null,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requerirAdmin();
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body no es JSON" }, { status: 400 });
  }

  const cuentaId = typeof body.cuenta_id === "string" ? body.cuenta_id : "";
  if (!cuentaId) {
    return NextResponse.json(
      { error: "cuenta_id requerido" },
      { status: 400 },
    );
  }

  // Validar que la cuenta exista
  const cuenta = await obtenerCuenta(cuentaId);
  if (!cuenta) {
    return NextResponse.json(
      { error: "Cuenta no encontrada" },
      { status: 404 },
    );
  }
  if (cuenta.esta_archivada) {
    return NextResponse.json(
      { error: "No podés marcar una cuenta archivada" },
      { status: 400 },
    );
  }

  await marcarCuentaComoPanelAdmin(cuentaId);

  const sa = await obtenerSuperAdminPorEmail(auth.email);
  if (sa) {
    void registrarAccionAdmin({
      superAdminId: sa.id,
      origen: "panel",
      accion: "agente_admin_marcar",
      payload: { cuenta_id: cuentaId, etiqueta: cuenta.etiqueta },
      resultado: null,
    });
  }

  return NextResponse.json({
    ok: true,
    cuenta_panel_admin: {
      id: cuenta.id,
      etiqueta: cuenta.etiqueta,
      telefono: cuenta.telefono,
      estado: cuenta.estado,
    },
  });
}

export async function DELETE() {
  const auth = await requerirAdmin();
  if (auth instanceof NextResponse) return auth;

  const actual = await obtenerCuentaPanelAdmin();
  if (!actual) {
    return NextResponse.json({ ok: true, ya_estaba_desmarcada: true });
  }
  await desmarcarCuentaComoPanelAdmin(actual.id);

  const sa = await obtenerSuperAdminPorEmail(auth.email);
  if (sa) {
    void registrarAccionAdmin({
      superAdminId: sa.id,
      origen: "panel",
      accion: "agente_admin_desmarcar",
      payload: { cuenta_id: actual.id, etiqueta: actual.etiqueta },
      resultado: null,
    });
  }

  return NextResponse.json({ ok: true });
}
