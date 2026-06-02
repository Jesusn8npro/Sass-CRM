import { NextResponse, type NextRequest } from "next/server";
import { obtenerCuentaPorTokenChatWeb, crearLeadChatWeb, marcarLeadChatWeb } from "@/lib/db/leadsChatWeb";
import { obtenerGestor } from "@/lib/baileys/gestor";
import { log } from "@/lib/logger";

// Celular colombiano de 10 dígitos sin indicativo → anteponer 57.
function normalizarTelefono(tel: string): string {
  const d = (tel || "").replace(/\D/g, "");
  if (d.length === 10 && d.startsWith("3")) return "57" + d;
  return d;
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Llamado desde el sitio del CLIENTE (cross-origin) → CORS abierto. La seguridad
// la da el token por cuenta, no el origen.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-chat-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/**
 * POST /api/chat-web/lead  (PÚBLICO)
 *
 * Ingesta de leads desde el chat/formulario web de un cliente. Se autentica con
 * el token_chat_web de la cuenta (header `x-chat-token` o body.token). Guarda el
 * lead en la cuenta correspondiente. Está en la allowlist de webhooks (proxy.ts).
 */
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400, headers: CORS });
  }

  const token = String(req.headers.get("x-chat-token") || body?.token || "").trim();
  const cuentaId = await obtenerCuentaPorTokenChatWeb(token);
  if (!cuentaId) {
    return NextResponse.json({ error: "token_invalido" }, { status: 401, headers: CORS });
  }

  const lead = body?.lead ?? body ?? {};
  const whatsapp = String(lead.whatsapp || lead.telefono || lead.phone || "").trim() || null;
  const email = String(lead.email || lead.correo || "").trim() || null;
  const nombre = String(lead.nombre || lead.name || "").trim() || null;

  if (!whatsapp && !email) {
    return NextResponse.json({ error: "falta_contacto", detalle: "Se requiere whatsapp o email" }, { status: 400, headers: CORS });
  }

  try {
    const creado = await crearLeadChatWeb({
      cuenta_id: cuentaId,
      nombre,
      email,
      whatsapp,
      interes: lead.interes || lead.que_quiere_aprender || lead.producto || null,
      mensaje: lead.mensaje || lead.message || lead.consulta || null,
      origen_url: lead.origen_url || lead.url || req.headers.get("origin") || null,
      mensaje_sugerido: body?.sugerencia_mensaje || lead.mensaje_sugerido || null,
      extra: body,
    });

    // Autoenvío opcional: si quien ingresa el lead pide `auto_enviar` y hay WhatsApp,
    // mandamos el mensaje al instante por el WhatsApp (Baileys) de ESA cuenta.
    let autoenviado = false;
    if (body?.auto_enviar === true && whatsapp) {
      const sock = obtenerGestor().obtenerSocket(cuentaId);
      const numero = normalizarTelefono(whatsapp);
      const texto = (creado.mensaje_sugerido || "").trim();
      if (sock && numero.length >= 10 && texto) {
        try {
          await sock.sendMessage(`${numero}@s.whatsapp.net`, { text: texto });
          await marcarLeadChatWeb(cuentaId, creado.id, "enviado");
          autoenviado = true;
        } catch (e) {
          await marcarLeadChatWeb(cuentaId, creado.id, "error", String(e));
          log.error({ err: String(e), id: creado.id }, "[chat-web:lead] fallo autoenvío");
        }
      }
    }

    return NextResponse.json({ ok: true, id: creado.id, autoenviado }, { headers: CORS });
  } catch (e) {
    log.error({ err: String(e) }, "[chat-web:lead] error guardando lead");
    return NextResponse.json({ error: "error_interno" }, { status: 500, headers: CORS });
  }
}
