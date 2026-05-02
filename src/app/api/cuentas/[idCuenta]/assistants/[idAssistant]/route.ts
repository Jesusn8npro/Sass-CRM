import { NextResponse, type NextRequest } from "next/server";
import {
  actualizarAssistantLocal,
  borrarAssistantLocal,
  obtenerAssistantLocal,
  obtenerCuenta,
} from "@/lib/baseDatos";
import { requerirSesion } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string; idAssistant: string }>;
}

async function verificar(
  idCuenta: string,
  idAssistant: string,
  authId: string,
) {
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== authId) return { error: "404 cuenta" };
  const a = await obtenerAssistantLocal(idAssistant);
  if (!a || a.cuenta_id !== idCuenta) return { error: "404 assistant" };
  return { cuenta, assistant: a };
}

export async function GET(_req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;
  const { idCuenta, idAssistant } = await params;
  const v = await verificar(idCuenta, idAssistant, auth.id);
  if ("error" in v) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  return NextResponse.json({ assistant: v.assistant });
}

export async function PATCH(req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;
  const { idCuenta, idAssistant } = await params;
  const v = await verificar(idCuenta, idAssistant, auth.id);
  if ("error" in v) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const cambios: Parameters<typeof actualizarAssistantLocal>[1] = {};
  if (typeof payload.nombre === "string") cambios.nombre = payload.nombre.trim();
  if (typeof payload.prompt_extra === "string")
    cambios.prompt_extra = payload.prompt_extra;
  if (typeof payload.primer_mensaje === "string")
    cambios.primer_mensaje = payload.primer_mensaje;
  if (typeof payload.voz_elevenlabs === "string")
    cambios.voz_elevenlabs = payload.voz_elevenlabs;
  if (payload.voz_elevenlabs === null) cambios.voz_elevenlabs = null;
  if (typeof payload.modelo === "string") cambios.modelo = payload.modelo;
  if (typeof payload.max_segundos === "number")
    cambios.max_segundos = Math.max(
      30,
      Math.min(3600, Math.floor(payload.max_segundos)),
    );
  if (typeof payload.grabar === "boolean") cambios.grabar = payload.grabar;
  if (typeof payload.es_default === "boolean")
    cambios.es_default = payload.es_default;
  if (typeof payload.esta_activo === "boolean")
    cambios.esta_activo = payload.esta_activo;

  const actualizado = await actualizarAssistantLocal(idAssistant, cambios);
  return NextResponse.json({ assistant: actualizado });
}

export async function DELETE(_req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;
  const { idCuenta, idAssistant } = await params;
  const v = await verificar(idCuenta, idAssistant, auth.id);
  if ("error" in v) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  await borrarAssistantLocal(idAssistant);
  return NextResponse.json({ ok: true });
}
