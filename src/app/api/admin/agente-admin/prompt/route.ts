/**
 * GET  /api/admin/agente-admin/prompt → devuelve el prompt activo del agente.
 * POST /api/admin/agente-admin/prompt → guarda un prompt custom en la cuenta
 *                                       panel admin actual (cuenta.prompt_sistema).
 *
 * El prompt se guarda en el campo existente `cuentas.prompt_sistema` de la
 * cuenta marcada como `es_panel_admin = true`. Si el body trae `prompt`
 * vacío, se "resetea" guardando string vacío — el bot va a caer al
 * default hardcoded.
 */
import { NextRequest, NextResponse } from "next/server";
import { requerirAdmin } from "@/lib/auth/sesion";
import {
  obtenerCuentaPanelAdmin,
  actualizarCuenta,
  obtenerSuperAdminPorEmail,
  registrarAccionAdmin,
} from "@/lib/baseDatos";
import { SYSTEM_PROMPT_ADMIN_DEFAULT } from "@/lib/admin/conversacionAdmin";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requerirAdmin();
  if (auth instanceof NextResponse) return auth;

  const cuenta = await obtenerCuentaPanelAdmin();
  if (!cuenta) {
    return NextResponse.json({
      hay_cuenta_admin: false,
      prompt_activo: SYSTEM_PROMPT_ADMIN_DEFAULT,
      prompt_custom: "",
      es_default: true,
      cuenta_etiqueta: null,
    });
  }

  const custom = cuenta.prompt_sistema?.trim() ?? "";
  return NextResponse.json({
    hay_cuenta_admin: true,
    prompt_activo: custom.length > 0 ? custom : SYSTEM_PROMPT_ADMIN_DEFAULT,
    prompt_custom: custom,
    prompt_default: SYSTEM_PROMPT_ADMIN_DEFAULT,
    es_default: custom.length === 0,
    cuenta_etiqueta: cuenta.etiqueta,
    cuenta_id: cuenta.id,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requerirAdmin();
  if (auth instanceof NextResponse) return auth;

  let body: { prompt?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body no es JSON" }, { status: 400 });
  }

  const promptNuevo = typeof body.prompt === "string" ? body.prompt.trim() : "";

  if (promptNuevo.length > 0 && promptNuevo.length < 50) {
    return NextResponse.json(
      { error: "El prompt es demasiado corto (mínimo 50 caracteres)." },
      { status: 400 },
    );
  }
  if (promptNuevo.length > 20000) {
    return NextResponse.json(
      { error: "El prompt es demasiado largo (máximo 20.000 caracteres)." },
      { status: 400 },
    );
  }

  const cuenta = await obtenerCuentaPanelAdmin();
  if (!cuenta) {
    return NextResponse.json(
      {
        error:
          "No hay cuenta panel admin configurada. Marcá una primero en /app/admin/agente-admin.",
      },
      { status: 400 },
    );
  }

  await actualizarCuenta(cuenta.id, { prompt_sistema: promptNuevo });

  const sa = await obtenerSuperAdminPorEmail(auth.email);
  if (sa) {
    void registrarAccionAdmin({
      superAdminId: sa.id,
      origen: "panel",
      accion: "agente_admin_prompt_actualizar",
      payload: {
        cuenta_id: cuenta.id,
        chars_nuevos: promptNuevo.length,
        reseteado_a_default: promptNuevo.length === 0,
      },
      resultado: null,
    });
  }

  return NextResponse.json({
    ok: true,
    es_default: promptNuevo.length === 0,
    prompt_activo:
      promptNuevo.length > 0 ? promptNuevo : SYSTEM_PROMPT_ADMIN_DEFAULT,
  });
}
