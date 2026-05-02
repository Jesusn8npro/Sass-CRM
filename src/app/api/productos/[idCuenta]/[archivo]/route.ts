import { NextResponse, type NextRequest } from "next/server";
import { leerArchivoProducto } from "@/lib/productos";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string; archivo: string }>;
}

/**
 * Sirve archivos de productos (imágenes y videos del catálogo).
 * Intenta Supabase Storage primero, fallback a disco local legacy.
 *
 * Path traversal: chequeamos que `archivo` no contenga separadores
 * ni `..`. El idCuenta lo aceptamos como UUID (no validamos formato
 * estricto porque el archivo solo existe si la combinación
 * idCuenta/archivo está realmente en Storage / disco — no hay riesgo
 * de leer archivos de otra cuenta).
 *
 * NOTA: este endpoint NO requiere sesión porque es referenciado en
 * `<img src>` desde el panel y necesitamos que cargue sin auth header.
 * Las URLs de productos son adivinables solo si conocés el UUID del
 * archivo (random 4 bytes hex + timestamp) — protección por oscuridad,
 * complementada por las policies de RLS en Storage para clientes no
 * service_role.
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
    return NextResponse.json({ error: "Ruta inválida" }, { status: 400 });
  }

  const rutaRelativa = `${idCuenta}/${archivo}`;
  const contenido = await leerArchivoProducto(rutaRelativa);
  if (!contenido) {
    return NextResponse.json({ error: "No existe" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(contenido.buffer), {
    headers: {
      "Content-Type": contenido.mime,
      "Cache-Control": "public, max-age=300",
    },
  });
}
