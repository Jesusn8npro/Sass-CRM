import { NextResponse, type NextRequest } from "next/server";
import { descargarBiblioteca } from "@/lib/baileys/medios";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string; archivo: string }>;
}

/**
 * Sirve archivos de biblioteca (medios reutilizables del bot).
 * Lee de Supabase Storage primero, fallback a disco local legacy.
 *
 * Sin auth: las URLs solo son adivinables si conocés el UUID del
 * archivo (random hex + timestamp). El panel solo las renderiza
 * para conversaciones del usuario logueado.
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
  const descargado = await descargarBiblioteca(rutaRelativa);
  if (!descargado) {
    return NextResponse.json(
      { error: "Archivo no encontrado" },
      { status: 404 },
    );
  }

  return new NextResponse(new Uint8Array(descargado.buffer), {
    headers: {
      "Content-Type": descargado.mime,
      "Cache-Control": "private, max-age=3600",
      "Content-Length": String(descargado.buffer.length),
    },
  });
}
