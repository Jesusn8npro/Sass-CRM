import path from "node:path";
import fs from "node:fs";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string; archivo: string }>;
}

const directorioBase = path.resolve(process.cwd(), "data", "productos");

function mimeDeExtension(p: string): string {
  const ext = p.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/jpeg";
}

export async function GET(_req: NextRequest, { params }: Contexto) {
  const { idCuenta, archivo } = await params;
  // Path traversal guard: nada de ".." ni separadores
  if (
    !/^\d+$/.test(idCuenta) ||
    archivo.includes("..") ||
    archivo.includes("/") ||
    archivo.includes("\\")
  ) {
    return NextResponse.json({ error: "Ruta inválida" }, { status: 400 });
  }
  const ruta = path.join(directorioBase, idCuenta, archivo);
  if (!ruta.startsWith(directorioBase)) {
    return NextResponse.json({ error: "Ruta inválida" }, { status: 400 });
  }
  if (!fs.existsSync(ruta)) {
    return NextResponse.json({ error: "No existe" }, { status: 404 });
  }
  const contenido = fs.readFileSync(ruta);
  return new NextResponse(new Uint8Array(contenido), {
    headers: {
      "Content-Type": mimeDeExtension(archivo),
      "Cache-Control": "public, max-age=300",
    },
  });
}
