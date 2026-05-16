import { NextResponse, type NextRequest } from "next/server";
import { parsearJSON, verificarAccesoCuenta } from "@/lib/auth/sesion";
import { verificarRateLimit } from "@/lib/auth/rateLimit";
import { insertarMensaje } from "@/lib/db/mensajes";
import { encolarBandejaSalida } from "@/lib/db/bandejaSalida";
import { obtenerConversacionPorId } from "@/lib/db/conversaciones";
import { db } from "@/lib/db/cliente";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

interface BroadcastPayload {
  conversacionIds?: unknown;
  texto?: unknown;
  programadoPara?: unknown;
}

export async function GET(_req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;

  const { data, error } = await db()
    .from("broadcast_logs")
    .select("id, texto, total_destinatarios, total_enviados, total_fallos, estado, programado_para, creado_en")
    .eq("cuenta_id", idCuenta)
    .order("creado_en", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ logs: data ?? [] });
}

export async function POST(req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;
  const { auth } = acceso;

  const limite = verificarRateLimit(`${auth.id}:broadcast`, 3, 3600);
  if (limite) return limite;

  const payload = await parsearJSON<BroadcastPayload>(req);
  if (payload instanceof NextResponse) return payload;

  const texto = typeof payload.texto === "string" ? payload.texto.trim() : "";
  if (!texto) {
    return NextResponse.json({ error: "El texto no puede estar vacío" }, { status: 400 });
  }
  if (texto.length > 4096) {
    return NextResponse.json({ error: "El texto supera los 4096 caracteres" }, { status: 400 });
  }

  if (!Array.isArray(payload.conversacionIds) || payload.conversacionIds.length === 0) {
    return NextResponse.json({ error: "Debe seleccionar al menos un destinatario" }, { status: 400 });
  }
  if (payload.conversacionIds.length > 500) {
    return NextResponse.json({ error: "Máximo 500 destinatarios por broadcast" }, { status: 400 });
  }

  const conversacionIds = payload.conversacionIds as string[];

  // Si viene programadoPara, guardar como pendiente sin enviar ahora.
  const programadoParaRaw = payload.programadoPara;
  if (programadoParaRaw && typeof programadoParaRaw === "string") {
    const fechaProgramada = new Date(programadoParaRaw);
    if (isNaN(fechaProgramada.getTime()) || fechaProgramada <= new Date()) {
      return NextResponse.json({ error: "La fecha programada debe ser futura" }, { status: 400 });
    }
    await db()
      .from("broadcast_logs")
      .insert({
        cuenta_id: idCuenta,
        usuario_id: auth.id,
        texto,
        total_destinatarios: conversacionIds.length,
        total_enviados: 0,
        total_fallos: 0,
        estado: "pendiente",
        programado_para: fechaProgramada.toISOString(),
        conversacion_ids: conversacionIds,
      });
    return NextResponse.json({ ok: true, programado: true, programadoPara: fechaProgramada.toISOString() });
  }

  // Envío inmediato
  let enviados = 0;
  let fallos = 0;

  for (const convId of conversacionIds) {
    try {
      const conv = await obtenerConversacionPorId(convId);
      if (!conv || conv.cuenta_id !== idCuenta) {
        fallos++;
        continue;
      }
      await insertarMensaje(idCuenta, convId, "humano", texto);
      await encolarBandejaSalida(idCuenta, convId, conv.telefono, texto);
      enviados++;
    } catch {
      fallos++;
    }
  }

  void db()
    .from("broadcast_logs")
    .insert({
      cuenta_id: idCuenta,
      usuario_id: auth.id,
      texto,
      total_destinatarios: conversacionIds.length,
      total_enviados: enviados,
      total_fallos: fallos,
      estado: "completado",
      conversacion_ids: conversacionIds,
    })
    .then(() => {});

  return NextResponse.json({ ok: true, enviados, fallos });
}
