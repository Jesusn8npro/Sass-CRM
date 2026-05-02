import { NextResponse, type NextRequest } from "next/server";
import {
  encolarBandejaSalida,
  insertarMensaje,
  obtenerConversacionPorId,
  obtenerCuenta,
  type TipoMensaje,
} from "@/lib/baseDatos";
import { guardarMediaSubido } from "@/lib/baileys/medios";
import { asegurarFormatoVoz } from "@/lib/baileys/conversion";
import { requerirSesion } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string; idConversacion: string }>;
}

const MIME_A_TIPO: Record<string, TipoMensaje> = {
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

const EXT_A_TIPO: Record<string, TipoMensaje> = {
  jpg: "imagen",
  jpeg: "imagen",
  png: "imagen",
  gif: "imagen",
  webp: "imagen",
  mp4: "video",
  webm: "video",
  mov: "video",
  mp3: "audio",
  m4a: "audio",
  ogg: "audio",
  opus: "audio",
  wav: "audio",
  pdf: "documento",
};

function detectarTipo(mime: string, nombreArchivo: string): TipoMensaje {
  // 1) Strip codec parameter (ej: "audio/webm;codecs=opus" → "audio/webm")
  const mimeBase = mime.split(";")[0]?.trim().toLowerCase() ?? "";
  if (mimeBase in MIME_A_TIPO) return MIME_A_TIPO[mimeBase]!;

  // 2) Check por categoría general (audio/*, video/*, image/*)
  if (mimeBase.startsWith("audio/")) return "audio";
  if (mimeBase.startsWith("image/")) return "imagen";
  if (mimeBase.startsWith("video/")) return "video";

  // 3) Fallback por extensión del nombre del archivo
  const ext = nombreArchivo.split(".").pop()?.toLowerCase() ?? "";
  if (ext in EXT_A_TIPO) return EXT_A_TIPO[ext]!;

  // 4) No reconocido → documento
  return "documento";
}

// WhatsApp tope ~64MB para video; usamos 50MB para tener margen de seguridad
// y evitar timeouts de upload desde el navegador.
const TAMANO_MAX_MB = 50;

export async function POST(req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta, idConversacion } = await params;
  if (!idCuenta || !idConversacion) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }
  const conv = await obtenerConversacionPorId(idConversacion);
  if (!conv || conv.cuenta_id !== idCuenta) {
    return NextResponse.json(
      { error: "Conversación no encontrada" },
      { status: 404 },
    );
  }

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
  const caption =
    typeof formData.get("caption") === "string"
      ? (formData.get("caption") as string)
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

  const mime = archivo.type || "application/octet-stream";
  const tipo: TipoMensaje = detectarTipo(mime, archivo.name);

  const buffer = Buffer.from(await archivo.arrayBuffer());
  const extension =
    archivo.name.includes(".")
      ? archivo.name.split(".").pop() ?? "bin"
      : tipo === "imagen"
      ? "jpg"
      : tipo === "video"
      ? "mp4"
      : tipo === "audio"
      ? "mp3"
      : "bin";

  const guardado = guardarMediaSubido(idCuenta, buffer, extension);

  // Si es audio, convertir a OGG/Opus para que WhatsApp lo reconozca
  // como nota de voz. Sin esta conversión, los WebM/Opus de Chrome
  // llegan a WhatsApp como "este audio ya no está disponible".
  let mediaPathFinal = guardado.rutaRelativa;
  if (tipo === "audio") {
    console.log(
      `[multimedia] convirtiendo audio: ${guardado.nombreArchivo} (${buffer.length} bytes)`,
    );
    try {
      const convertido = await asegurarFormatoVoz(guardado.rutaAbsoluta);
      if (convertido.nombre !== guardado.nombreArchivo) {
        mediaPathFinal = `${idCuenta}/${convertido.nombre}`;
        console.log(
          `[multimedia] ✓ convertido a OGG/Opus: ${convertido.nombre}`,
        );
      } else {
        console.warn(
          `[multimedia] ⚠ asegurarFormatoVoz devolvió mismo archivo (no se convirtió)`,
        );
      }
    } catch (err) {
      console.error("[multimedia] ✗ falló conversión audio:", err);
    }
  }

  await insertarMensaje(idCuenta, idConversacion, "humano", caption, {
    tipo,
    media_path: mediaPathFinal,
  });

  await encolarBandejaSalida(idCuenta, idConversacion, conv.telefono, caption, {
    tipo,
    media_path: mediaPathFinal,
  });

  return NextResponse.json({
    ok: true,
    tipo,
    media_path: mediaPathFinal,
  });
}
