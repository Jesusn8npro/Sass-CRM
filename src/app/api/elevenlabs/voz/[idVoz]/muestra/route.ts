import { NextResponse, type NextRequest } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { generarAudioTTS } from "@/lib/elevenlabs";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idVoz: string }>;
}

const TEXTO_MUESTRA =
  "Hola, esta es una muestra de mi voz. Espero que te guste el resultado.";

const DIR_CACHE = path.resolve(process.cwd(), "data", "samples");

/**
 * Genera (o devuelve cacheado) un MP3 de muestra en español para la voz.
 * Usado como fallback cuando preview_url está vacío (típico apenas
 * clonás una voz — ElevenLabs tarda 1-3 min en generar el preview).
 *
 * Costo: ~70 caracteres × tu plan. Cacheamos en disco por voice_id
 * para que el segundo click no gaste créditos.
 */
export async function GET(_req: NextRequest, { params }: Contexto) {
  const { idVoz } = await params;
  const limpio = idVoz.trim();
  if (!limpio || !/^[A-Za-z0-9]+$/.test(limpio)) {
    return NextResponse.json({ error: "voice_id inválido" }, { status: 400 });
  }

  const rutaCache = path.join(DIR_CACHE, `${limpio}.mp3`);

  try {
    if (existsSync(rutaCache)) {
      const cached = await fs.readFile(rutaCache);
      return new NextResponse(new Uint8Array(cached), {
        headers: {
          "Content-Type": "audio/mpeg",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    const tts = await generarAudioTTS(TEXTO_MUESTRA, limpio);
    await fs.mkdir(DIR_CACHE, { recursive: true });
    await fs.writeFile(rutaCache, tts.buffer);
    return new NextResponse(new Uint8Array(tts.buffer), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: detalle.slice(0, 500) },
      { status: 502 },
    );
  }
}
