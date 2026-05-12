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
  crearCuenta,
  obtenerSuperAdminPorEmail,
  registrarAccionAdmin,
} from "@/lib/baseDatos";
import { arrancarBotEnProceso } from "@/lib/bot/cicloVida";

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

  // Modo A: crear cuenta nueva + marcarla como panel admin atómicamente.
  // El admin no tiene límite de plan (esUsuarioAdmin bypassa el check),
  // así que skip el rate-limit de cuentas que tiene /api/cuentas.
  if (body.crear_nueva === true) {
    const etiqueta =
      typeof body.etiqueta === "string" && body.etiqueta.trim().length > 0
        ? body.etiqueta.trim()
        : "Agente Admin del Patrón";
    const nueva = await crearCuenta(auth.id, etiqueta, null, null);
    await marcarCuentaComoPanelAdmin(nueva.id);

    // El bot Baileys descubre la cuenta nueva en su próximo tick.
    // arrancarBotEnProceso es idempotente — si ya está corriendo no
    // duplica nada, pero asegura que el ciclo de vida esté activo para
    // que genere el QR pronto.
    void arrancarBotEnProceso().catch((err) =>
      console.error("[api/admin/agente-admin] arrancar bot:", err),
    );

    const sa = await obtenerSuperAdminPorEmail(auth.email);
    if (sa) {
      void registrarAccionAdmin({
        superAdminId: sa.id,
        origen: "panel",
        accion: "agente_admin_crear_y_marcar",
        payload: { etiqueta },
        resultado: { cuenta_id: nueva.id },
      });
    }

    return NextResponse.json({
      ok: true,
      creada: true,
      cuenta_panel_admin: {
        id: nueva.id,
        etiqueta: nueva.etiqueta,
        telefono: nueva.telefono,
        estado: nueva.estado,
      },
      url_qr: `/app/cuentas/${nueva.id}/whatsapp`,
    });
  }

  // Modo B: marcar una cuenta existente como panel admin.
  const cuentaId = typeof body.cuenta_id === "string" ? body.cuenta_id : "";
  if (!cuentaId) {
    return NextResponse.json(
      { error: "cuenta_id requerido (o crear_nueva: true)" },
      { status: 400 },
    );
  }

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
    creada: false,
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
