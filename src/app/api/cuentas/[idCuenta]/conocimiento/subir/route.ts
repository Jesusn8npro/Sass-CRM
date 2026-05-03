import { NextResponse, type NextRequest } from "next/server";
import { crearConocimiento, obtenerCuenta } from "@/lib/baseDatos";
import { requerirSesion } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";
// PDF parsing puede ser pesado — corremos en runtime nodejs explícito
export const runtime = "nodejs";

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

const MAX_TAMAÑO = 10 * 1024 * 1024; // 10 MB para PDFs grandes
const EXT_PERMITIDAS = [".txt", ".md", ".markdown", ".pdf", ".docx"];

/** Extrae texto plano de un buffer según su extensión.
 * Devuelve string vacío si no se pudo o el archivo está vacío. */
async function extraerTexto(
  buffer: Buffer,
  ext: string,
  nombre: string,
): Promise<string> {
  try {
    if (ext === ".txt" || ext === ".md" || ext === ".markdown") {
      return buffer.toString("utf-8");
    }
    if (ext === ".pdf") {
      // Import dinámico — pdf-parse trae binarios pesados, solo se carga
      // cuando alguien sube un PDF.
      const mod = await import("pdf-parse");
      const pdfParse = (mod as { default?: typeof mod } & typeof mod).default ?? mod;
      const result = (await (pdfParse as unknown as (b: Buffer) => Promise<{ text: string }>)(
        buffer,
      )) as { text: string };
      return result.text ?? "";
    }
    if (ext === ".docx") {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      return result.value ?? "";
    }
    return "";
  } catch (err) {
    console.error(`[conocimiento.subir] error parseando ${nombre}:`, err);
    return "";
  }
}

/** POST /api/cuentas/[idCuenta]/conocimiento/subir
 *
 * Acepta multipart/form-data con:
 *   - archivo (File): .txt / .md / .pdf / .docx
 *   - categoria (string opcional, default "general")
 *
 * Crea una entrada de conocimiento por archivo subido. Cada formato se
 * parsea con la librería apropiada (pdf-parse, mammoth) — al final
 * todo se guarda como texto plano en `conocimiento.contenido`. */
export async function POST(req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta } = await params;
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Cuerpo no es multipart válido" },
      { status: 400 },
    );
  }

  const archivo = formData.get("archivo");
  const categoriaRaw = formData.get("categoria");
  if (!(archivo instanceof File)) {
    return NextResponse.json(
      { error: "Falta el archivo en el campo 'archivo'" },
      { status: 400 },
    );
  }

  const nombre = archivo.name;
  const ext = nombre.toLowerCase().slice(nombre.lastIndexOf("."));
  if (!EXT_PERMITIDAS.includes(ext)) {
    return NextResponse.json(
      {
        error: `Formato no soportado. Permitidos: ${EXT_PERMITIDAS.join(", ")}`,
      },
      { status: 400 },
    );
  }

  if (archivo.size > MAX_TAMAÑO) {
    return NextResponse.json(
      { error: `Archivo muy grande (máx ${Math.round(MAX_TAMAÑO / 1024 / 1024)}MB)` },
      { status: 413 },
    );
  }

  const buffer = Buffer.from(await archivo.arrayBuffer());
  const contenido = (await extraerTexto(buffer, ext, nombre)).trim();
  if (!contenido) {
    return NextResponse.json(
      {
        error:
          ext === ".pdf" || ext === ".docx"
            ? `No se pudo extraer texto del ${ext}. Verificá que el archivo tenga texto seleccionable (no solo imágenes escaneadas).`
            : "Archivo vacío",
      },
      { status: 400 },
    );
  }

  const tituloAuto = nombre
    .replace(/\.(txt|md|markdown|pdf|docx)$/i, "")
    .slice(0, 80);
  const categoria =
    typeof categoriaRaw === "string" && categoriaRaw.trim()
      ? categoriaRaw
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9_]+/g, "_")
          .slice(0, 30)
      : "general";

  const entrada = await crearConocimiento(
    idCuenta,
    tituloAuto || "Documento",
    contenido,
    { categoria, esta_activo: true },
  );

  return NextResponse.json({
    entrada,
    mensaje: `Documento "${tituloAuto}" subido (${contenido.length} caracteres extraídos del ${ext}).`,
  });
}
