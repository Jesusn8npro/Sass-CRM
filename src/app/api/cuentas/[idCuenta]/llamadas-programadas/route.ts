import { NextResponse, type NextRequest } from "next/server";
import {
  crearLlamadaProgramada,
  listarLlamadasProgramadasDeCuenta,
  obtenerAssistantLocal,
  obtenerConversacionPorId,
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
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }
  const llamadas = await listarLlamadasProgramadasDeCuenta(idCuenta);
  return NextResponse.json({ llamadas });
}

export async function POST(req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta } = await params;
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }

  let payload: {
    conversacion_id?: unknown;
    assistant_id?: unknown;
    telefono_destino?: unknown;
    motivo?: unknown;
    programada_para?: unknown;
  };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const programadaPara =
    typeof payload.programada_para === "string"
      ? payload.programada_para
      : null;
  if (!programadaPara) {
    return NextResponse.json(
      { error: "programada_para es obligatorio (ISO 8601)" },
      { status: 400 },
    );
  }
  const ts = new Date(programadaPara).getTime();
  if (!Number.isFinite(ts)) {
    return NextResponse.json(
      { error: "programada_para no es una fecha válida" },
      { status: 400 },
    );
  }
  if (ts < Date.now() + 60_000) {
    return NextResponse.json(
      { error: "La fecha debe ser al menos 1 minuto a futuro" },
      { status: 400 },
    );
  }
  if (ts > Date.now() + 365 * 86_400_000) {
    return NextResponse.json(
      { error: "La fecha no puede ser más de 1 año a futuro" },
      { status: 400 },
    );
  }

  // Conversación obligatoria por ahora (sin conv no podemos resolver
  // el teléfono ni inyectar contexto).
  const idConv =
    typeof payload.conversacion_id === "string"
      ? payload.conversacion_id
      : null;
  if (!idConv) {
    return NextResponse.json(
      { error: "conversacion_id es obligatorio" },
      { status: 400 },
    );
  }
  const conv = await obtenerConversacionPorId(idConv);
  if (!conv || conv.cuenta_id !== idCuenta) {
    return NextResponse.json(
      { error: "Conversación no encontrada para esta cuenta" },
      { status: 404 },
    );
  }

  // Validar assistant si viene
  const idAss =
    typeof payload.assistant_id === "string" && payload.assistant_id
      ? payload.assistant_id
      : null;
  if (idAss) {
    const a = await obtenerAssistantLocal(idAss);
    if (!a || a.cuenta_id !== idCuenta) {
      return NextResponse.json(
        { error: "Assistant no encontrado para esta cuenta" },
        { status: 404 },
      );
    }
  }

  const llamada = await crearLlamadaProgramada(idCuenta, {
    conversacion_id: idConv,
    assistant_id: idAss,
    telefono_destino:
      typeof payload.telefono_destino === "string"
        ? payload.telefono_destino
        : null,
    motivo: typeof payload.motivo === "string" ? payload.motivo : null,
    origen: "humano",
    programada_para: new Date(programadaPara).toISOString(),
  });

  return NextResponse.json({ llamada });
}
