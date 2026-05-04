import { NextResponse, type NextRequest } from "next/server";
import { verificarAccesoCuenta, parsearJSON } from "@/lib/auth/sesion";
import { verificarRateLimit } from "@/lib/auth/rateLimit";
import { obtenerPreset } from "@/lib/imagenes/presets";
import { generarImagenProducto } from "@/lib/imagenes/orquestador";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

interface BodyRequest {
  prompt?: string;
  preset_id?: string;
  ruta_imagen_base?: string | null;
}

/**
 * POST /api/cuentas/[idCuenta]/imagenes/generar
 * Body: { prompt? | preset_id?, ruta_imagen_base? }
 *
 * Descuenta créditos, genera con Nano Banana, sube al bucket biblioteca.
 */
export async function POST(req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;
  const { auth } = acceso;

  const limite = verificarRateLimit(`${auth.id}:imagenes-generar`, 20, 60);
  if (limite) return limite;

  const body = await parsearJSON<BodyRequest>(req);
  if (body instanceof NextResponse) return body;

  let promptFinal: string;
  if (body.preset_id) {
    const preset = obtenerPreset(body.preset_id);
    if (!preset) {
      return NextResponse.json({ error: "preset_invalido" }, { status: 400 });
    }
    promptFinal = preset.prompt;
  } else if (body.prompt && body.prompt.trim().length > 5) {
    promptFinal = body.prompt.trim();
  } else {
    return NextResponse.json({ error: "falta_prompt_o_preset" }, { status: 400 });
  }

  try {
    const r = await generarImagenProducto({
      cuentaId: idCuenta,
      prompt: promptFinal,
      rutaImagenBase: body.ruta_imagen_base ?? null,
    });
    if (r instanceof NextResponse) return r;
    return NextResponse.json({
      ok: true,
      ruta: `biblio:${r.rutaRelativa}`,
      bytes: r.bytes,
    });
  } catch (err) {
    console.error("[imagenes:generar]", err);
    return NextResponse.json({ error: "error_generando" }, { status: 500 });
  }
}
