import { NextResponse, type NextRequest } from "next/server";
import { descargarMediaChat } from "@/lib/baileys/medios";
import { verificarAccesoCuenta } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string; archivo: string }>;
}

/**
 * Sirve archivos multimedia de chats. Requiere sesión + ownership de la
 * cuenta. Antes era público — abría a cualquiera con UUID adivinable
 * los audios/imágenes privados de los contactos.
 */
export async function GET(_req: NextRequest, { params }: Contexto) {
  const { idCuenta, archivo } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;

  if (!archivo || archivo.includes("..") || archivo.includes("/") || archivo.includes("\\")) {
    return NextResponse.json({ error: "Nombre inválido" }, { status: 400 });
  }

  const descargado = await descargarMediaChat(`${idCuenta}/${archivo}`);
  if (!descargado) {
    return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
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
