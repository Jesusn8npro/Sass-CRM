import { NextResponse, type NextRequest } from "next/server";
import {
  actualizarLlamadaPorCallId,
  borrarLlamada,
  obtenerCuenta,
  obtenerLlamadaPorId,
  type EstadoLlamada,
} from "@/lib/baseDatos";
import { obtenerLlamada } from "@/lib/vapi";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string; idLlamada: string }>;
}

function validarIds(ic: string, il: string) {
  const idCuenta = Number(ic);
  const idLlamada = Number(il);
  if (
    !Number.isFinite(idCuenta) ||
    idCuenta <= 0 ||
    !Number.isFinite(idLlamada) ||
    idLlamada <= 0
  ) {
    return null;
  }
  return { idCuenta, idLlamada };
}

function mapearEstado(estadoVapi: string | undefined): EstadoLlamada {
  switch (estadoVapi) {
    case "queued":
    case "ringing":
      return "sonando";
    case "in-progress":
      return "en_curso";
    case "ended":
      return "completada";
    case "forwarding":
      return "en_curso";
    default:
      return "iniciando";
  }
}

/**
 * GET trae la llamada local. Si la llamada está en estado activo y la
 * cuenta tiene API key, refresca contra Vapi para tener el último estado.
 */
export async function GET(_req: NextRequest, { params }: Contexto) {
  const { idCuenta, idLlamada } = await params;
  const ids = validarIds(idCuenta, idLlamada);
  if (!ids) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const cuenta = obtenerCuenta(ids.idCuenta);
  if (!cuenta) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }
  const llamada = obtenerLlamadaPorId(ids.idLlamada);
  if (!llamada || llamada.cuenta_id !== ids.idCuenta) {
    return NextResponse.json({ error: "Llamada no encontrada" }, { status: 404 });
  }

  // Si la llamada está activa y tenemos API key, intentamos refrescar.
  const activos: EstadoLlamada[] = ["iniciando", "sonando", "en_curso"];
  if (activos.includes(llamada.estado) && cuenta.vapi_api_key) {
    try {
      const c = await obtenerLlamada(cuenta.vapi_api_key, llamada.vapi_call_id);
      const transcripcion = c.transcript ?? c.artifact?.transcript;
      const audio = c.recordingUrl ?? c.artifact?.recordingUrl;
      const resumen = c.summary ?? c.analysis?.summary;
      actualizarLlamadaPorCallId(llamada.vapi_call_id, {
        estado: mapearEstado(c.status),
        transcripcion: transcripcion ?? undefined,
        audio_url: audio ?? undefined,
        resumen: resumen ?? undefined,
        costo_usd: typeof c.cost === "number" ? c.cost : undefined,
        terminada_en: c.endedAt
          ? Math.floor(new Date(c.endedAt).getTime() / 1000)
          : undefined,
        duracion_seg:
          c.startedAt && c.endedAt
            ? Math.max(
                0,
                Math.floor(
                  (new Date(c.endedAt).getTime() -
                    new Date(c.startedAt).getTime()) /
                    1000,
                ),
              )
            : undefined,
      });
    } catch (err) {
      console.error("[llamadas] refresh Vapi falló:", err);
    }
  }

  const fresca = obtenerLlamadaPorId(ids.idLlamada);
  return NextResponse.json({ llamada: fresca });
}

export async function DELETE(_req: NextRequest, { params }: Contexto) {
  const { idCuenta, idLlamada } = await params;
  const ids = validarIds(idCuenta, idLlamada);
  if (!ids) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const llamada = obtenerLlamadaPorId(ids.idLlamada);
  if (!llamada || llamada.cuenta_id !== ids.idCuenta) {
    return NextResponse.json({ error: "Llamada no encontrada" }, { status: 404 });
  }
  borrarLlamada(ids.idLlamada);
  return NextResponse.json({ ok: true });
}
