import { NextResponse, type NextRequest } from "next/server";
import { obtenerInfoVoz } from "@/lib/elevenlabs";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idVoz: string }>;
}

/**
 * Devuelve metadata de una voz incluyendo preview_url (MP3 público).
 * El front lo reproduce con <audio src={preview_url} />.
 * No consume créditos: ElevenLabs sirve el preview gratis.
 */
export async function GET(_req: NextRequest, { params }: Contexto) {
  const { idVoz } = await params;
  if (!idVoz.trim()) {
    return NextResponse.json({ error: "voice_id vacío" }, { status: 400 });
  }
  try {
    const info = await obtenerInfoVoz(idVoz);
    return NextResponse.json(info);
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: detalle.slice(0, 500) },
      { status: 502 },
    );
  }
}
