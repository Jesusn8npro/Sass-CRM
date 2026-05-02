import { NextResponse, type NextRequest } from "next/server";
import {
  crearMedioBiblioteca,
  listarBiblioteca,
  obtenerCuenta,
  obtenerMedioPorIdentificador,
  type TipoMediaBiblioteca,
} from "@/lib/baseDatos";
import { guardarEnBiblioteca } from "@/lib/baileys/medios";
import { requerirSesion } from "@/lib/auth/sesion";

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
  const medios = await listarBiblioteca(idCuenta);
  return NextResponse.json({ medios });
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

  const tipo = detectarTipo(archivo.type || "", archivo.name);
  const buffer = Buffer.from(await archivo.arrayBuffer());
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
