import { NextResponse, type NextRequest } from "next/server";
import {
  actualizarProducto,
  obtenerCuenta,
  obtenerProducto,
} from "@/lib/baseDatos";
import { borrarVideoProducto, guardarVideoProducto } from "@/lib/productos";
import { requerirSesion } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string; idProducto: string }>;
}

const BYTES_MAX = 50 * 1024 * 1024; // 50MB

export async function POST(req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta, idProducto } = await params;
  if (!idCuenta || !idProducto) {
    return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
  }
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }
  const prod = await obtenerProducto(idProducto);
  if (!prod || prod.cuenta_id !== idCuenta) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Form-data inválido" }, { status: 400 });
  }

  const archivo = formData.get("archivo");
  if (!(archivo instanceof Blob)) {
    return NextResponse.json(
      { error: "Falta el archivo de video" },
      { status: 400 },
    );
  }
  if (archivo.size === 0) {
    return NextResponse.json({ error: "Video vacío" }, { status: 400 });
  }
  if (archivo.size > BYTES_MAX) {
    return NextResponse.json(
      {
        error: `Video demasiado grande (máx ${BYTES_MAX / 1024 / 1024}MB)`,
      },
      { status: 413 },
    );
  }
  const mime = (archivo as File).type ?? "";
  if (!mime.startsWith("video/")) {
    return NextResponse.json(
      { error: "El archivo debe ser un video (mp4, webm, mov)" },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await archivo.arrayBuffer());
  const nombreOriginal = (archivo as File).name ?? "video.mp4";

  // Borrar el video previo si había
  await borrarVideoProducto(prod.video_path);

  const guardado = await guardarVideoProducto(
    idCuenta,
    buffer,
    nombreOriginal,
    mime,
  );

  const actualizado = await actualizarProducto(idProducto, {
    video_path: guardado.rutaRelativa,
  });
  return NextResponse.json({ producto: actualizado });
}

export async function DELETE(_req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta, idProducto } = await params;
  if (!idCuenta || !idProducto) {
    return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
  }
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }
  const prod = await obtenerProducto(idProducto);
  if (!prod || prod.cuenta_id !== idCuenta) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }
  await borrarVideoProducto(prod.video_path);
  const actualizado = await actualizarProducto(idProducto, {
    video_path: null,
  });
  return NextResponse.json({ producto: actualizado });
}
