/**
 * Seguimiento MANUAL por conversación (botón "Seguimiento" del chat).
 *
 * POST { accion: "borrador" }            → genera y devuelve un borrador (NO envía).
 * POST { accion: "enviar", mensaje }     → envía el mensaje aprobado a ESA conversación.
 *
 * Es 100% manual: el dueño dispara cada uno a propósito. No hay envío masivo.
 */
import { NextResponse, type NextRequest } from "next/server";
import { parsearJSON, verificarAccesoCuenta } from "@/lib/auth/sesion";
import { generarBorradorSeguimiento } from "@/lib/seguimiento/borradorManual";
import { encolarBandejaSalida, insertarMensaje } from "@/lib/baseDatos";
import { db } from "@/lib/db/cliente";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string; idConversacion: string }>;
}

export async function POST(req: NextRequest, { params }: Contexto) {
  const { idCuenta, idConversacion } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;

  const payload = await parsearJSON<{ accion?: unknown; mensaje?: unknown }>(req);
  if (payload instanceof NextResponse) return payload;
  const accion = typeof payload.accion === "string" ? payload.accion : "";

  if (accion === "borrador") {
    const r = await generarBorradorSeguimiento(idCuenta, idConversacion);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    return NextResponse.json({ borrador: r.borrador });
  }

  if (accion === "enviar") {
    const mensaje =
      typeof payload.mensaje === "string" ? payload.mensaje.trim() : "";
    if (!mensaje) {
      return NextResponse.json({ error: "El mensaje está vacío." }, { status: 400 });
    }
    if (mensaje.length > 1500) {
      return NextResponse.json(
        { error: "El mensaje es demasiado largo (máx 1500 caracteres)." },
        { status: 400 },
      );
    }

    const { data: convRaw } = await db()
      .from("conversaciones")
      .select("id, telefono")
      .eq("id", idConversacion)
      .eq("cuenta_id", idCuenta)
      .maybeSingle();
    const conv = convRaw as { id: string; telefono: string } | null;
    if (!conv) {
      return NextResponse.json(
        { error: "Conversación no encontrada." },
        { status: 404 },
      );
    }

    // Registramos como mensaje del agente y lo encolamos para que Baileys
    // lo envíe a ESA persona. No tocamos el modo de la conversación.
    await insertarMensaje(idCuenta, conv.id, "asistente", mensaje);
    await encolarBandejaSalida(idCuenta, conv.id, conv.telefono, mensaje);

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json(
    { error: "Acción inválida. Usá 'borrador' o 'enviar'." },
    { status: 400 },
  );
}
