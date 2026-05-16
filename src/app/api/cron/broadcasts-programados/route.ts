import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db/cliente";
import { insertarMensaje } from "@/lib/db/mensajes";
import { encolarBandejaSalida } from "@/lib/db/bandejaSalida";
import { obtenerConversacionPorId } from "@/lib/db/conversaciones";
import { log } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

interface BroadcastLog {
  id: string;
  cuenta_id: string;
  usuario_id: string;
  texto: string;
  conversacion_ids: string[];
  total_destinatarios: number;
}

/**
 * POST /api/cron/broadcasts-programados
 * Protegido por x-cron-secret. Ejecutar cada 5-15 minutos via EasyPanel cron.
 * Busca broadcasts con estado='pendiente' cuyo programado_para ya pasó y los envía.
 */
export async function POST(request: NextRequest) {
  const esperado = process.env.CRON_SECRET?.trim();
  if (!esperado) {
    log.warn("[cron:broadcasts] CRON_SECRET no configurada");
    return NextResponse.json({ error: "CRON_SECRET no configurada" }, { status: 500 });
  }
  if (request.headers.get("x-cron-secret") !== esperado) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: pendientes, error } = await db()
    .from("broadcast_logs")
    .select("id, cuenta_id, usuario_id, texto, conversacion_ids, total_destinatarios")
    .eq("estado", "pendiente")
    .lte("programado_para", new Date().toISOString())
    .limit(20);

  if (error) {
    log.error({ err: error }, "[cron:broadcasts] error al buscar pendientes");
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!pendientes || pendientes.length === 0) {
    return NextResponse.json({ ok: true, ejecutados: 0 });
  }

  let ejecutados = 0;

  for (const bc of pendientes as BroadcastLog[]) {
    const ids: string[] = Array.isArray(bc.conversacion_ids) ? bc.conversacion_ids : [];
    let enviados = 0;
    let fallos = 0;

    // Marcar como ejecutando para evitar doble-fire si el cron se solapa
    await db()
      .from("broadcast_logs")
      .update({ estado: "completado" })
      .eq("id", bc.id)
      .eq("estado", "pendiente");

    for (const convId of ids) {
      try {
        const conv = await obtenerConversacionPorId(convId);
        if (!conv || conv.cuenta_id !== bc.cuenta_id) {
          fallos++;
          continue;
        }
        await insertarMensaje(bc.cuenta_id, convId, "humano", bc.texto);
        await encolarBandejaSalida(bc.cuenta_id, convId, conv.telefono, bc.texto);
        enviados++;
      } catch {
        fallos++;
      }
    }

    await db()
      .from("broadcast_logs")
      .update({ total_enviados: enviados, total_fallos: fallos })
      .eq("id", bc.id);

    log.info({ id: bc.id, enviados, fallos }, "[cron:broadcasts] broadcast ejecutado");
    ejecutados++;
  }

  return NextResponse.json({ ok: true, ejecutados });
}
