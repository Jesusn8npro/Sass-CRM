import { NextResponse, type NextRequest } from "next/server";
import { actualizarCuenta, obtenerCuenta } from "@/lib/baseDatos";
import { clonarVoz } from "@/lib/elevenlabs";
import { requerirSesion } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

const BYTES_MAX = 30 * 1024 * 1024; // 30MB — IVC acepta archivos grandes

/**
 * Recibe un archivo de audio (multipart) + nombre, lo manda a
 * ElevenLabs /v1/voices/add (Instant Voice Cloning) y guarda el
 * voice_id resultante como voz_elevenlabs de la cuenta.
 * Requiere plan Starter+ en ElevenLabs.
 */
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
  if (!process.env.ELEVENLABS_API_KEY) {
    return NextResponse.json(
      { error: "Falta ELEVENLABS_API_KEY en .env.local" },
      { status: 500 },
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Form-data inválido" }, { status: 400 });
  }

  const archivo = formData.get("archivo");
  const nombre = (formData.get("nombre") as string | null)?.trim() ?? "";
  const descripcion =
    (formData.get("descripcion") as string | null)?.trim() ?? "";

  if (!nombre) {
    return NextResponse.json(
      { error: "Falta el nombre de la voz" },
      { status: 400 },
    );
  }
  if (!(archivo instanceof Blob)) {
    return NextResponse.json(
      { error: "Falta el archivo de audio" },
      { status: 400 },
    );
  }
  if (archivo.size === 0) {
    return NextResponse.json({ error: "Audio vacío" }, { status: 400 });
  }
  if (archivo.size > BYTES_MAX) {
    return NextResponse.json(
      { error: `Audio demasiado grande (máx ${BYTES_MAX / 1024 / 1024}MB)` },
      { status: 413 },
    );
  }

  const buffer = Buffer.from(await archivo.arrayBuffer());
  const tipoMime =
    typeof (archivo as File).type === "string" && (archivo as File).type
      ? (archivo as File).type
      : "audio/mpeg";
  const nombreArchivoOriginal =
    typeof (archivo as File).name === "string" && (archivo as File).name
      ? (archivo as File).name
      : "muestra.mp3";

  try {
    const resultado = await clonarVoz(
      nombre,
      { buffer, nombreArchivo: nombreArchivoOriginal, tipoMime },
      descripcion || undefined,
    );

    // Auto-asignamos la voz clonada como la voz de la cuenta.
    const actualizada = await actualizarCuenta(idCuenta, {
      voz_elevenlabs: resultado.voice_id,
    });

    return NextResponse.json(
      { voice_id: resultado.voice_id, cuenta: actualizada },
      { status: 201 },
    );
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: detalle.slice(0, 500) },
      { status: 502 },
    );
  }
}
