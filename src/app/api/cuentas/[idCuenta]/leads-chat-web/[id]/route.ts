import { NextResponse, type NextRequest } from "next/server";
import { verificarAccesoCuenta, parsearJSON } from "@/lib/auth/sesion";
import { obtenerLeadChatWeb, marcarLeadChatWeb } from "@/lib/db/leadsChatWeb";
import { obtenerOCrearConversacion, cambiarModo } from "@/lib/db";
import { obtenerGestor } from "@/lib/baileys/gestor";
import { enviarParteTexto } from "@/lib/baileys/manejadorEnvio";
import { log } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Celular colombiano de 10 dígitos sin indicativo → anteponer 57. Si ya trae
// indicativo (>=11 dígitos) se respeta.
function normalizarTelefono(tel: string): string {
  const d = (tel || "").replace(/\D/g, "");
  if (d.length === 10 && d.startsWith("3")) return "57" + d;
  return d;
}

/**
 * POST /api/cuentas/[idCuenta]/leads-chat-web/[id]
 * body: { accion: "enviar" | "descartar", mensaje?: string }
 *
 * - enviar: manda el WhatsApp por la PROPIA cuenta (Baileys) y marca enviado.
 * - descartar: marca descartado.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ idCuenta: string; id: string }> },
) {
  const { idCuenta, id } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;

  const body = await parsearJSON<{ accion?: string; mensaje?: string }>(req);
  if (body instanceof NextResponse) return body;

  const lead = await obtenerLeadChatWeb(idCuenta, id);
  if (!lead) return NextResponse.json({ error: "no_encontrado" }, { status: 404 });

  if (body.accion === "descartar") {
    await marcarLeadChatWeb(idCuenta, id, "descartado");
    return NextResponse.json({ ok: true });
  }

  // accion === "enviar"
  const mensaje = (body.mensaje?.trim() || lead.mensaje_sugerido || "").trim();
  if (!mensaje) return NextResponse.json({ error: "mensaje_vacio" }, { status: 400 });
  if (!lead.whatsapp) return NextResponse.json({ error: "lead_sin_whatsapp" }, { status: 400 });

  const sock = obtenerGestor().obtenerSocket(idCuenta);
  if (!sock) {
    await marcarLeadChatWeb(idCuenta, id, "error", "El WhatsApp de la cuenta no está conectado");
    return NextResponse.json({ error: "wa_desconectado" }, { status: 409 });
  }

  const numero = normalizarTelefono(lead.whatsapp);
  if (numero.length < 10) {
    await marcarLeadChatWeb(idCuenta, id, "error", "Número de WhatsApp inválido");
    return NextResponse.json({ error: "telefono_invalido" }, { status: 400 });
  }

  try {
    // Enviar COMO IA (no operador): vía conversación + enviarParteTexto, y dejar
    // la conversación en modo IA para que el agente siga la charla con el lead.
    const jid = `${numero}@s.whatsapp.net`;
    const conv = await obtenerOCrearConversacion(idCuenta, numero, lead.nombre, jid);
    await cambiarModo(conv.id, "IA");
    await enviarParteTexto(sock, idCuenta, conv.id, jid, mensaje, "[chat-web]", "1", 0);
    await marcarLeadChatWeb(idCuenta, id, "enviado");
    return NextResponse.json({ ok: true });
  } catch (e) {
    log.error({ err: String(e), id }, "[chat-web] fallo envío WhatsApp");
    await marcarLeadChatWeb(idCuenta, id, "error", String(e));
    return NextResponse.json({ error: "fallo_envio", detalle: String(e) }, { status: 500 });
  }
}
