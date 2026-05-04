import { NextResponse, type NextRequest } from "next/server";
import {
  crearAssistantLocal,
  listarAssistantsDeCuenta,
} from "@/lib/baseDatos";
import { parsearJSON, verificarAccesoCuenta } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

export async function GET(_req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;

  const assistants = await listarAssistantsDeCuenta(idCuenta);
  return NextResponse.json({ assistants });
}

export async function POST(req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;

  const payload = await parsearJSON<{
    nombre?: unknown;
    prompt_extra?: unknown;
    primer_mensaje?: unknown;
    voz_elevenlabs?: unknown;
    modelo?: unknown;
    max_segundos?: unknown;
    grabar?: unknown;
    es_default?: unknown;
  }>(req);
  if (payload instanceof NextResponse) return payload;

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
