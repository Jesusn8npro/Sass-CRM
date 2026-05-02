import { NextResponse, type NextRequest } from "next/server";
import {
  actualizarLlamadaPorCallId,
  borrarLlamada,
  obtenerCuenta,
  obtenerLlamadaPorId,
  type EstadoLlamada,
} from "@/lib/baseDatos";
import { obtenerLlamada } from "@/lib/vapi";
import { requerirSesion } from "@/lib/auth/sesion";
import { resolverCredencialesVapi } from "@/lib/vapi-credenciales";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string; idLlamada: string }>;
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
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta, idLlamada } = await params;
  if (!idCuenta || !idLlamada) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }
  const llamada = await obtenerLlamadaPorId(idLlamada);
  if (!llamada || llamada.cuenta_id !== idCuenta) {
    return NextResponse.json({ error: "Llamada no encontrada" }, { status: 404 });
  }

  // Si la llamada está activa y tenemos API key (cuenta o env), intentamos refrescar.
  const activos: EstadoLlamada[] = ["iniciando", "sonando", "en_curso"];
  const cred = resolverCredencialesVapi(cuenta);
  if (activos.includes(llamada.estado) && cred.apiKey) {
    try {
      const c = await obtenerLlamada(cred.apiKey, llamada.vapi_call_id);
      const transcripcion = c.transcript ?? c.artifact?.transcript;
      const audio = c.recordingUrl ?? c.artifact?.recordingUrl;
      const resumen = c.summary ?? c.analysis?.summary;
      await actualizarLlamadaPorCallId(llamada.vapi_call_id, {
        estado: mapearEstado(c.status),
        transcripcion: transcripcion ?? undefined,
        audio_url: audio ?? undefined,
        resumen: resumen ?? undefined,
        costo_usd: typeof c.cost === "number" ? c.cost : undefined,
        terminada_en: c.endedAt
          ? new Date(c.endedAt).toISOString()
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

  const fresca = await obtenerLlamadaPorId(idLlamada);
  return NextResponse.json({ llamada: fresca });
}

export async function DELETE(_req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta, idLlamada } = await params;
  if (!idCuenta || !idLlamada) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }
  const llamada = await obtenerLlamadaPorId(idLlamada);
  if (!llamada || llamada.cuenta_id !== idCuenta) {
    return NextResponse.json({ error: "Llamada no encontrada" }, { status: 404 });
  }
  await borrarLlamada(idLlamada);
  return NextResponse.json({ ok: true });
}
