import { NextResponse, type NextRequest } from "next/server";
import path from "node:path";
import fs from "node:fs";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string; archivo: string }>;
}

function mimePorExtension(archivo: string): string {
  const ext = archivo.split(".").pop()?.toLowerCase() ?? "";
  const mapa: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    mp4: "video/mp4",
    webm: "video/webm",
    ogg: "audio/ogg",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    m4a: "audio/mp4",
    pdf: "application/pdf",
  };
  return mapa[ext] ?? "application/octet-stream";
}

export async function GET(_req: NextRequest, { params }: Contexto) {
  const { idCuenta, archivo } = await params;

  // Validación: idCuenta debe ser numérico, archivo no debe contener traversal
  const cuentaId = Number(idCuenta);
  if (!Number.isFinite(cuentaId) || cuentaId <= 0) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  if (
    !archivo ||
    archivo.includes("..") ||
    archivo.includes("/") ||
    archivo.includes("\\")
  ) {
    return NextResponse.json({ error: "Nombre inválido" }, { status: 400 });
  }

  const ruta = path.resolve(
    process.cwd(),
    "data",
    "media",
    String(cuentaId),
    archivo,
  );

  // Verificación adicional: el path resuelto debe estar dentro de data/media/{id}/
  const baseEsperado = path.resolve(
    process.cwd(),
    "data",
    "media",
    String(cuentaId),
  );
  if (!ruta.startsWith(baseEsperado + path.sep) && ruta !== baseEsperado) {
    return NextResponse.json({ error: "Path inválido" }, { status: 400 });
  }

  if (!fs.existsSync(ruta)) {
    return NextResponse.json(
      { error: "Archivo no encontrado" },
      { status: 404 },
    );
  }

  const buffer = fs.readFileSync(ruta);
  const mime = mimePorExtension(archivo);
  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Cache-Control": "private, max-age=3600",
      "Content-Length": String(buffer.length),
    },
  });
}
