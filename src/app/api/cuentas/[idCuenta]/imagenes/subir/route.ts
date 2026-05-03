import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { obtenerCuenta } from "@/lib/baseDatos";
import { requerirSesion } from "@/lib/auth/sesion";
import { subirArchivo } from "@/lib/supabase/almacenamiento";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

const MAX_MB = 10;
const MIME_OK = ["image/jpeg", "image/png", "image/webp"];

/**
 * POST /api/cuentas/[idCuenta]/imagenes/subir
 *
 * Upload simple para usar como imagen base de generación. Sube al
 * bucket `biblioteca` y devuelve la ruta. NO crea fila en
 * medios_biblioteca (es uso transitorio para image-to-image).
 */
export async function POST(req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta } = await params;
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json(
      { error: "cuenta_no_encontrada" },
      { status: 404 },
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "esperaba_multipart_form_data" },
      { status: 400 },
    );
  }

  const archivo = formData.get("archivo");
  if (!(archivo instanceof File)) {
    return NextResponse.json({ error: "falta_archivo" }, { status: 400 });
  }
  if (archivo.size > MAX_MB * 1024 * 1024) {
    return NextResponse.json(
      { error: "archivo_muy_grande", mensaje: `Máximo ${MAX_MB}MB` },
      { status: 413 },
    );
  }
  if (!MIME_OK.includes(archivo.type)) {
    return NextResponse.json(
      { error: "tipo_invalido", mensaje: "Solo JPG, PNG o WebP" },
      { status: 400 },
    );
  }

  const ext = archivo.type.split("/")[1] === "jpeg" ? "jpg" : archivo.type.split("/")[1] ?? "jpg";
  const nombre = `base_${Date.now()}_${crypto.randomBytes(4).toString("hex")}.${ext}`;
  const buffer = Buffer.from(await archivo.arrayBuffer());

  const { ruta } = await subirArchivo(
    "biblioteca",
    idCuenta,
    nombre,
    buffer,
    archivo.type,
  );

  return NextResponse.json({ ok: true, ruta });
}
