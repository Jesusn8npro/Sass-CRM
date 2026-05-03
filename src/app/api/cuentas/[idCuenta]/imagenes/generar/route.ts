import { NextResponse, type NextRequest } from "next/server";
import { obtenerCuenta } from "@/lib/baseDatos";
import { requerirSesion } from "@/lib/auth/sesion";
import { obtenerPreset } from "@/lib/imagenes/presets";
import { generarImagenProducto } from "@/lib/imagenes/orquestador";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // Buffer + ffmpeg-static no funcionan en edge

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

interface BodyRequest {
  /** Texto libre o id de preset. Al menos uno de los dos. */
  prompt?: string;
  preset_id?: string;
  /** Path interno de la imagen base (formato "biblio:UUID/file" o "UUID/file"). */
  ruta_imagen_base?: string | null;
}

/**
 * POST /api/cuentas/[idCuenta]/imagenes/generar
 * Body: { prompt? | preset_id?, ruta_imagen_base? }
 *
 * Descuenta créditos, genera con Nano Banana, sube al bucket biblioteca,
 * devuelve la ruta. El cliente la enchufa en producto.imagen_url o lo
 * que quiera.
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

  let body: BodyRequest;
  try {
    body = (await req.json()) as BodyRequest;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  let promptFinal: string;
  if (body.preset_id) {
    const preset = obtenerPreset(body.preset_id);
    if (!preset) {
      return NextResponse.json(
        { error: "preset_invalido" },
        { status: 400 },
      );
    }
    promptFinal = preset.prompt;
  } else if (body.prompt && body.prompt.trim().length > 5) {
    promptFinal = body.prompt.trim();
  } else {
    return NextResponse.json(
      { error: "falta_prompt_o_preset" },
      { status: 400 },
    );
  }

  try {
    const r = await generarImagenProducto({
      cuentaId: idCuenta,
      prompt: promptFinal,
      rutaImagenBase: body.ruta_imagen_base ?? null,
    });
    if (r instanceof NextResponse) return r; // p.ej. 402 sin créditos

    return NextResponse.json({
      ok: true,
      ruta: `biblio:${r.rutaRelativa}`,
      bytes: r.bytes,
    });
  } catch (err) {
    console.error("[imagenes:generar]", err);
    const mensaje = err instanceof Error ? err.message : "Error generando";
    return NextResponse.json(
      { error: "error_generando", mensaje },
      { status: 500 },
    );
  }
}
