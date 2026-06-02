import { NextResponse, type NextRequest } from "next/server";
import { requerirAdmin } from "@/lib/auth/sesion";
import {
  obtenerSolicitudAcademia,
  marcarSolicitudAcademia,
} from "@/lib/db/solicitudesAcademia";
import { obtenerGestor } from "@/lib/baileys/gestor";
import { log } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Celular colombiano de 10 dígitos sin indicativo → anteponer 57. Si ya trae
// indicativo (>=11 dígitos) se respeta tal cual.
function normalizarTelefono(tel: string): string {
  const d = (tel || "").replace(/\D/g, "");
  if (d.length === 10 && d.startsWith("3")) return "57" + d;
  return d;
}

/**
 * POST /api/admin/solicitudes-academia/[id]
 * body: { accion: "enviar" | "descartar", mensaje?: string }
 *
 * - enviar: manda el WhatsApp por la cuenta ACADEMIA_ID_CUENTA (Baileys) y marca enviado.
 * - descartar: marca la solicitud como descartada (sin enviar nada).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requerirAdmin();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  let body: { accion?: string; mensaje?: string } = {};
  try { body = await req.json(); } catch { /* body opcional */ }

  const sol = await obtenerSolicitudAcademia(id);
  if (!sol) return NextResponse.json({ error: "no_encontrada" }, { status: 404 });

  if (body.accion === "descartar") {
    await marcarSolicitudAcademia(id, "descartado");
    return NextResponse.json({ ok: true });
  }

  // accion === "enviar"
  const idCuenta = process.env.ACADEMIA_ID_CUENTA || "";
  if (!idCuenta) {
    return NextResponse.json(
      { error: "config_faltante", detalle: "Define ACADEMIA_ID_CUENTA con el id de la cuenta de WhatsApp que envía." },
      { status: 500 },
    );
  }

  const mensaje = (body.mensaje?.trim() || sol.mensaje_sugerido || "").trim();
  if (!mensaje) return NextResponse.json({ error: "mensaje_vacio" }, { status: 400 });

  const sock = obtenerGestor().obtenerSocket(idCuenta);
  if (!sock) {
    await marcarSolicitudAcademia(id, "error", "El WhatsApp de la cuenta no está conectado");
    return NextResponse.json({ error: "wa_desconectado" }, { status: 409 });
  }

  const numero = normalizarTelefono(sol.whatsapp);
  if (numero.length < 10) {
    await marcarSolicitudAcademia(id, "error", "Número de WhatsApp inválido");
    return NextResponse.json({ error: "telefono_invalido" }, { status: 400 });
  }

  try {
    await sock.sendMessage(`${numero}@s.whatsapp.net`, { text: mensaje });
    await marcarSolicitudAcademia(id, "enviado");
    return NextResponse.json({ ok: true });
  } catch (e) {
    log.error({ err: String(e), id }, "[academia] fallo envío WhatsApp");
    await marcarSolicitudAcademia(id, "error", String(e));
    return NextResponse.json({ error: "fallo_envio", detalle: String(e) }, { status: 500 });
  }
}
