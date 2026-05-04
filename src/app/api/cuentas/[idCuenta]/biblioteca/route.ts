import { NextResponse, type NextRequest } from "next/server";
import {
  crearMedioBiblioteca,
  listarBiblioteca,
  obtenerMedioPorIdentificador,
  type TipoMediaBiblioteca,
} from "@/lib/baseDatos";
import { guardarEnBiblioteca } from "@/lib/baileys/medios";
import { verificarAccesoCuenta } from "@/lib/auth/sesion";
import { verificarRateLimit } from "@/lib/auth/rateLimit";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

const TAMANO_MAX_MB = 50;

const MIME_A_TIPO: Record<string, TipoMediaBiblioteca> = {
  "image/jpeg": "imagen",
  "image/jpg": "imagen",
  "image/png": "imagen",
  "image/gif": "imagen",
  "image/webp": "imagen",
  "video/mp4": "video",
  "video/webm": "video",
  "video/quicktime": "video",
  "audio/mpeg": "audio",
  "audio/mp3": "audio",
  "audio/mp4": "audio",
  "audio/m4a": "audio",
  "audio/ogg": "audio",
  "audio/wav": "audio",
  "audio/webm": "audio",
  "application/pdf": "documento",
};

function detectarTipo(mime: string, nombreArchivo: string): TipoMediaBiblioteca {
  const base = mime.split(";")[0]?.trim().toLowerCase() ?? "";
  if (base in MIME_A_TIPO) return MIME_A_TIPO[base]!;
  if (base.startsWith("audio/")) return "audio";
  if (base.startsWith("image/")) return "imagen";
  if (base.startsWith("video/")) return "video";
  const ext = nombreArchivo.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return "imagen";
  if (["mp4", "webm", "mov"].includes(ext)) return "video";
  if (["mp3", "m4a", "ogg", "wav", "opus"].includes(ext)) return "audio";
  return "documento";
}

/**
 * Detecta tipo real por magic bytes — no se confía en `archivo.type`
 * (header del cliente, falsificable). Devuelve null si no matchea
 * ningún formato permitido.
 */
function detectarTipoPorMagic(b: Buffer): TipoMediaBiblioteca | null {
  if (b.length < 12) return null;
  // imágenes
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "imagen"; // JPEG
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "imagen"; // PNG
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return "imagen"; // GIF
  if (
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) return "imagen"; // WEBP

  // audio
  if (b[0] === 0x4f && b[1] === 0x67 && b[2] === 0x67 && b[3] === 0x53) return "audio"; // OGG/Opus
  if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) return "audio"; // MP3 ID3
  if (b[0] === 0xff && (b[1]! & 0xe0) === 0xe0) return "audio"; // MP3 sin tag
  if (
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x41 && b[10] === 0x56 && b[11] === 0x45
  ) return "audio"; // WAV

  // video / contenedor mp4 (también usado por m4a)
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    // ftyp box: bytes 8-11 indican brand. "M4A " = audio, resto = video
    const brand = b.slice(8, 12).toString("ascii");
    if (brand === "M4A " || brand.startsWith("M4A")) return "audio";
    return "video";
  }
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "video"; // WEBM/MKV

  // documento PDF
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "documento";

  return null;
}

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export async function GET(_req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;
  const medios = await listarBiblioteca(idCuenta);
  return NextResponse.json({ medios });
}

export async function POST(req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;

  const limite = verificarRateLimit(`${acceso.auth.id}:biblioteca-upload`, 30, 60);
  if (limite) return limite;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Esperaba multipart/form-data" },
      { status: 400 },
    );
  }

  const archivo = formData.get("archivo");
  const identificadorRaw =
    typeof formData.get("identificador") === "string"
      ? (formData.get("identificador") as string)
      : "";
  const descripcion =
    typeof formData.get("descripcion") === "string"
      ? (formData.get("descripcion") as string)
      : "";

  if (!(archivo instanceof File)) {
    return NextResponse.json(
      { error: "Falta el archivo" },
      { status: 400 },
    );
  }
  if (archivo.size > TAMANO_MAX_MB * 1024 * 1024) {
    return NextResponse.json(
      { error: `Archivo excede ${TAMANO_MAX_MB}MB` },
      { status: 413 },
    );
  }

  const identificador = slugify(identificadorRaw || archivo.name);
  if (!identificador) {
    return NextResponse.json(
      { error: "Identificador inválido" },
      { status: 400 },
    );
  }
  if (await obtenerMedioPorIdentificador(idCuenta, identificador)) {
    return NextResponse.json(
      { error: `Ya existe un medio con identificador "${identificador}"` },
      { status: 409 },
    );
  }
  if (!descripcion.trim()) {
    return NextResponse.json(
      {
        error:
          "La descripción es obligatoria — el agente la usa para decidir cuándo enviar este medio",
      },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await archivo.arrayBuffer());

  // Validación de tipo REAL por magic bytes — el header `archivo.type`
  // es del cliente y es falsificable. Si no matchea ningún formato
  // permitido, rechazamos.
  const tipoReal = detectarTipoPorMagic(buffer);
  if (!tipoReal) {
    return NextResponse.json(
      { error: "Formato de archivo no permitido o no reconocido" },
      { status: 415 },
    );
  }
  const tipoDeclarado = detectarTipo(archivo.type || "", archivo.name);
  if (tipoDeclarado !== tipoReal) {
    return NextResponse.json(
      {
        error: `Tipo declarado (${tipoDeclarado}) no coincide con el contenido (${tipoReal})`,
      },
      { status: 415 },
    );
  }
  const tipo = tipoReal;
  const ext =
    archivo.name.includes(".") ? archivo.name.split(".").pop() ?? "bin" : "bin";

  const guardado = await guardarEnBiblioteca(idCuenta, buffer, ext);
  const medio = await crearMedioBiblioteca(
    idCuenta,
    identificador,
    tipo,
    guardado.rutaRelativa,
    descripcion.trim(),
  );

  return NextResponse.json({ medio });
}
