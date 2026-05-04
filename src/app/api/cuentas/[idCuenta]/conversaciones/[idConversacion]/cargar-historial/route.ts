import { NextResponse, type NextRequest } from "next/server";
import {
  obtenerConversacionPorId,
  obtenerMensajeMasViejoConWaId,
} from "@/lib/baseDatos";
import { verificarAccesoCuenta } from "@/lib/auth/sesion";
import { obtenerGestor } from "@/lib/baileys/gestor";
import { pedirMasHistorialConversacion } from "@/lib/baileys/manejador";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string; idConversacion: string }>;
}

/**
 * Pide a WhatsApp más mensajes anteriores al más viejo que tenemos
 * de esta conversación. Los mensajes llegan async vía
 * 'messaging-history.set' y se guardan automáticamente.
 *
 * Body opcional: { cantidad?: number }  // 1..50, default 50
 *
 * Respuesta: { ok: true, req_id, esperando_mensajes: number }
 *   o       : { ok: false, error: string }
 */
export async function POST(req: NextRequest, { params }: Contexto) {
  const { idCuenta, idConversacion } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;
  const { cuenta } = acceso;
  if (!idConversacion) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const conv = await obtenerConversacionPorId(idConversacion);
  if (!conv || conv.cuenta_id !== idCuenta) {
    return NextResponse.json(
      { error: "Conversación no encontrada" },
      { status: 404 },
    );
  }
  if (cuenta.estado !== "conectado") {
    return NextResponse.json(
      { error: "La cuenta no está conectada a WhatsApp." },
      { status: 409 },
    );
  }

  let cantidad = 50;
  try {
    const body = (await req.json()) as { cantidad?: unknown } | null;
    if (body && typeof body.cantidad === "number") {
      cantidad = Math.min(50, Math.max(1, Math.floor(body.cantidad)));
    }
  } catch {
    // sin body: usamos default
  }

  const masViejo = await obtenerMensajeMasViejoConWaId(idConversacion);
  if (!masViejo || !masViejo.wa_msg_id) {
    return NextResponse.json(
      {
        error:
          "No hay mensajes con ID de WhatsApp en esta conversación todavía. Esperá a que llegue al menos un mensaje.",
      },
      { status: 409 },
    );
  }

  const sock = obtenerGestor().obtenerSocket(idCuenta);
  if (!sock) {
    return NextResponse.json(
      { error: "El bot no tiene socket activo para esta cuenta." },
      { status: 503 },
    );
  }

  const jid = conv.jid_wa ?? `${conv.telefono}@s.whatsapp.net`;
  try {
    const reqId = await pedirMasHistorialConversacion(
      sock,
      { id: masViejo.wa_msg_id, remoteJid: jid, fromMe: false },
      masViejo.creado_en,
      cantidad,
    );
    return NextResponse.json({
      ok: true,
      req_id: reqId,
      esperando_mensajes: cantidad,
    });
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        ok: false,
        error: `WhatsApp rechazó la petición: ${detalle.slice(0, 200)}`,
      },
      { status: 502 },
    );
  }
}
