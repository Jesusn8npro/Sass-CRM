/**
 * Chat web del Patrón con Marco — alternativa al WhatsApp.
 *
 * GET  → devuelve el historial completo de la conversación del Patrón
 *        con Marco (últimos 100 mensajes).
 * POST → recibe { mensaje }, guarda el mensaje + respuesta de Marco
 *        en la DB y devuelve la respuesta.
 *
 * La conversación se crea automáticamente en la cuenta panel admin
 * con un teléfono virtual `web:<email>` para que cada super-admin
 * tenga su propio hilo aislado. Reusa la tabla `mensajes` existente,
 * por eso el historial es persistente entre sesiones.
 *
 * Si Baileys / WhatsApp falla por conflictos de conexión, este canal
 * SIEMPRE funciona porque no depende del bot — solo de la API.
 */
import { NextRequest, NextResponse } from "next/server";
import { parsearJSON, requerirAdmin } from "@/lib/auth/sesion";
import {
  obtenerCuentaPanelAdmin,
  obtenerOCrearConversacion,
  insertarMensaje,
  obtenerHistorialReciente,
  obtenerSuperAdminPorEmail,
  registrarAccionAdmin,
} from "@/lib/baseDatos";
import { conversarConAdminNL } from "@/lib/admin/conversacionAdmin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function telefonoVirtualWeb(email: string): string {
  return `web:${email.toLowerCase().trim()}`;
}

export async function GET() {
  const auth = await requerirAdmin();
  if (auth instanceof NextResponse) return auth;

  const cuenta = await obtenerCuentaPanelAdmin();
  if (!cuenta) {
    return NextResponse.json({
      hay_cuenta_admin: false,
      mensajes: [],
    });
  }

  const conversacion = await obtenerOCrearConversacion(
    cuenta.id,
    telefonoVirtualWeb(auth.email),
    auth.email,
    `web-chat:${auth.email}`,
  );

  const historial = await obtenerHistorialReciente(conversacion.id, 100);

  return NextResponse.json({
    hay_cuenta_admin: true,
    conversacion_id: conversacion.id,
    mensajes: historial
      .filter((m) => m.rol !== "sistema" && (m.contenido ?? "").length > 0)
      .map((m) => ({
        id: m.id,
        rol: m.rol,
        contenido: m.contenido,
        creado_en: m.creado_en,
      })),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requerirAdmin();
  if (auth instanceof NextResponse) return auth;

  const body = await parsearJSON<{ mensaje?: unknown }>(req);
  if (body instanceof NextResponse) return body;

  const mensaje =
    typeof body.mensaje === "string" ? body.mensaje.trim() : "";
  if (mensaje.length === 0) {
    return NextResponse.json(
      { error: "El mensaje está vacío" },
      { status: 400 },
    );
  }
  if (mensaje.length > 4000) {
    return NextResponse.json(
      { error: "Mensaje demasiado largo (máx 4.000 caracteres)" },
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

  const superAdmin = await obtenerSuperAdminPorEmail(auth.email);
  if (!superAdmin) {
    return NextResponse.json(
      {
        error:
          "Tu email no está registrado como super-admin en la tabla super_admins.",
      },
      { status: 403 },
    );
  }

  // 1) Conversación virtual única por email admin
  const conversacion = await obtenerOCrearConversacion(
    cuenta.id,
    telefonoVirtualWeb(auth.email),
    auth.email,
    `web-chat:${auth.email}`,
  );

  // 2) Guardar el mensaje del usuario
  await insertarMensaje(cuenta.id, conversacion.id, "usuario", mensaje, {
    tipo: "texto",
    media_path: null,
    wa_msg_id: null,
  });

  // 3) Llamar a Marco con tool calling (mismo motor que WhatsApp)
  const inicio = Date.now();
  let respuestaMarco = "";
  let toolsUsadas: string[] = [];
  let errorMsg: string | null = null;

  try {
    const r = await conversarConAdminNL({
      conversacionId: conversacion.id,
      textoEntrante: mensaje,
      superAdmin,
    });
    respuestaMarco = r.respuesta;
    toolsUsadas = r.nombresTools;
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[api/admin/chat] error en conversarConAdminNL:", err);
    respuestaMarco = construirMensajeError(errorMsg);
  }

  // 4) Guardar la respuesta de Marco
  await insertarMensaje(cuenta.id, conversacion.id, "asistente", respuestaMarco, {
    tipo: "texto",
    media_path: null,
    wa_msg_id: null,
  });

  const ms = Date.now() - inicio;

  // 5) Audit log
  void registrarAccionAdmin({
    superAdminId: superAdmin.id,
    origen: "panel",
    accion: "chat_web",
    payload: {
      mensaje: mensaje.slice(0, 500),
      conversacion_id: conversacion.id,
    },
    resultado: {
      ms,
      tools: toolsUsadas,
      respuesta_chars: respuestaMarco.length,
    },
    error: errorMsg,
  });

  return NextResponse.json({
    ok: true,
    respuesta: respuestaMarco,
    ms,
    tools: toolsUsadas,
    conversacion_id: conversacion.id,
  });
}

function construirMensajeError(errorMsg: string): string {
  const lower = errorMsg.toLowerCase();
  if (
    lower.includes("invalid x-api-key") ||
    lower.includes("authentication_error") ||
    lower.includes("invalid_api_key") ||
    lower.includes("incorrect api key") ||
    lower.includes("401")
  ) {
    return "❌ La API key del motor IA no es válida. Verificá las variables OPENAI_API_KEY o ANTHROPIC_API_KEY en Easy Panel.";
  }
  if (lower.includes("rate_limit") || lower.includes("429")) {
    return "⏳ Llegamos al rate limit. Probá de nuevo en 30 segundos.";
  }
  if (lower.includes("insufficient") || lower.includes("credit_balance")) {
    return "💳 Se acabó el saldo del proveedor IA. Recargá créditos.";
  }
  return `❌ No pude procesar el mensaje. Detalle: ${errorMsg.slice(0, 200)}`;
}
