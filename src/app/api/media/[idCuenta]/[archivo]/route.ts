import { NextResponse, type NextRequest } from "next/server";
import { descargarMediaChat } from "@/lib/baileys/medios";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string; archivo: string }>;
}

/**
 * Sirve archivos multimedia de chats (audio entrante transcrito,
 * imágenes recibidas, etc).
 * Lee de Supabase Storage primero, fallback a disco local legacy.
 */
export async function GET(_req: NextRequest, { params }: Contexto) {
  const { idCuenta, archivo } = await params;
  if (!idCuenta || !archivo) {
    return NextResponse.json({ error: "Ruta inválida" }, { status: 400 });
  }
  if (
    archivo.includes("..") ||
    archivo.includes("/") ||
    archivo.includes("\\")
  ) {
    return NextResponse.json({ error: "Nombre inválido" }, { status: 400 });
  }

  const rutaRelativa = `${idCuenta}/${archivo}`;
  const descargado = await descargarMediaChat(rutaRelativa);
  if (!descargado) {
    return NextResponse.json(
      { error: "Archivo no encontrado" },
      { status: 404 },
    );
  }

  return new NextResponse(new Uint8Array(descargado.buffer), {
    status: 200,
    headers: {
      "Content-Type": descargado.mime,
      "Cache-Control": "private, max-age=3600",
      "Content-Length": String(descargado.buffer.length),
    },
  });
}
