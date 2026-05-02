import { NextResponse, type NextRequest } from "next/server";
import {
  actualizarProducto,
  obtenerCuenta,
  obtenerProducto,
} from "@/lib/baseDatos";
import { borrarImagenProducto, guardarImagenProducto } from "@/lib/productos";
import { requerirSesion } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string; idProducto: string }>;
}

const BYTES_MAX = 8 * 1024 * 1024; // 8MB

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
      { error: "Falta el archivo de imagen" },
      { status: 400 },
    );
  }
  if (archivo.size === 0) {
    return NextResponse.json({ error: "Imagen vacía" }, { status: 400 });
  }
  if (archivo.size > BYTES_MAX) {
    return NextResponse.json(
      { error: `Imagen demasiado grande (máx ${BYTES_MAX / 1024 / 1024}MB)` },
      { status: 413 },
    );
  }
  const mime = (archivo as File).type ?? "";
  if (!mime.startsWith("image/")) {
    return NextResponse.json(
      { error: "El archivo debe ser una imagen (jpg, png, webp)" },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await archivo.arrayBuffer());
  const nombreOriginal = (archivo as File).name ?? "imagen.jpg";

  // Borrar la imagen previa si había
  await borrarImagenProducto(prod.imagen_path);

  const guardado = await guardarImagenProducto(
    idCuenta,
    buffer,
    nombreOriginal,
    mime,
  );

  const actualizado = await actualizarProducto(idProducto, {
    imagen_path: guardado.rutaRelativa,
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
  await borrarImagenProducto(prod.imagen_path);
  const actualizado = await actualizarProducto(idProducto, {
    imagen_path: null,
  });
  return NextResponse.json({ producto: actualizado });
}
