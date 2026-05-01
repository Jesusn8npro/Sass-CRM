import { NextResponse, type NextRequest } from "next/server";
import { obtenerCuenta } from "@/lib/baseDatos";
import { generarAudioTTS } from "@/lib/elevenlabs";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

/**
 * Diagnóstico: genera un audio corto con la voz configurada en la
 * cuenta y reporta éxito o el error exacto de ElevenLabs.
 */
export async function POST(_req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const id = Number(idCuenta);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const cuenta = obtenerCuenta(id);
  if (!cuenta) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }

  const voz = cuenta.voz_elevenlabs?.trim() ?? "";
  if (!voz) {
    return NextResponse.json(
      {
        error:
          "Esta cuenta no tiene Voice ID configurado. Pegá uno arriba y guardá.",
      },
      { status: 400 },
    );
  }
  if (!process.env.ELEVENLABS_API_KEY) {
    return NextResponse.json(
      {
        error:
          "Falta ELEVENLABS_API_KEY en .env.local. Reiniciá el panel después de agregarla.",
      },
      { status: 500 },
    );
  }

  try {
    const inicio = Date.now();
    const tts = await generarAudioTTS(
      "Hola, esta es una prueba de la voz configurada.",
      voz,
    );
    const ms = Date.now() - inicio;
    return NextResponse.json({
      ok: true,
      voice_id: voz,
      bytes: tts.buffer.length,
      latencia_ms: ms,
    });
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: detalle.slice(0, 500) },
      { status: 502 },
    );
  }
}
