import { NextResponse, type NextRequest } from "next/server";
import {
  crearAssistantLocal,
  listarAssistantsDeCuenta,
  obtenerCuenta,
} from "@/lib/baseDatos";
import { requerirSesion } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

export async function GET(_req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta } = await params;
  if (!idCuenta) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }

  const assistants = await listarAssistantsDeCuenta(idCuenta);
  return NextResponse.json({ assistants });
}

export async function POST(req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta } = await params;
  if (!idCuenta) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }

  let payload: {
    nombre?: unknown;
    prompt_extra?: unknown;
    primer_mensaje?: unknown;
    voz_elevenlabs?: unknown;
    modelo?: unknown;
    max_segundos?: unknown;
    grabar?: unknown;
    es_default?: unknown;
  };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const nombre =
    typeof payload.nombre === "string" ? payload.nombre.trim() : "";
  if (!nombre) {
    return NextResponse.json(
      { error: "El nombre es obligatorio" },
      { status: 400 },
    );
  }

  const assistant = await crearAssistantLocal(idCuenta, {
    nombre,
    prompt_extra:
      typeof payload.prompt_extra === "string"
        ? payload.prompt_extra
        : undefined,
    primer_mensaje:
      typeof payload.primer_mensaje === "string"
        ? payload.primer_mensaje
        : undefined,
    voz_elevenlabs:
      typeof payload.voz_elevenlabs === "string"
        ? payload.voz_elevenlabs
        : payload.voz_elevenlabs === null
        ? null
        : undefined,
    modelo:
      typeof payload.modelo === "string" ? payload.modelo : undefined,
    max_segundos:
      typeof payload.max_segundos === "number"
        ? Math.max(30, Math.min(3600, Math.floor(payload.max_segundos)))
        : undefined,
    grabar: typeof payload.grabar === "boolean" ? payload.grabar : undefined,
    es_default:
      typeof payload.es_default === "boolean" ? payload.es_default : false,
  });

  return NextResponse.json({ assistant });
}
