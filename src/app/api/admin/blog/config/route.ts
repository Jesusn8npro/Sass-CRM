import { NextResponse, type NextRequest } from "next/server";
import { requerirAdmin } from "@/lib/auth/sesion";
import { obtenerBlogConfig, actualizarBlogConfig } from "@/lib/db/blogConfig";

const _g = global as typeof global & {
  __cronBlogSlotsHoy?: Set<string>;
  __cronBlogDiaHoy?: number;
};

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requerirAdmin();
  if (auth instanceof NextResponse) return auth;

  const config = await obtenerBlogConfig();
  return NextResponse.json(config);
}

export async function PATCH(request: NextRequest) {
  const auth = await requerirAdmin();
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const cambios: Record<string, unknown> = {};

  if (typeof body.activo === "boolean") cambios.activo = body.activo;

  if (Array.isArray(body.horas)) {
    const horas = body.horas.filter((h: unknown) => typeof h === "number" && h >= 0 && h <= 23);
    if (horas.length === 0) {
      return NextResponse.json({ error: "Debe haber al menos una hora configurada" }, { status: 400 });
    }
    cambios.horas = [...new Set(horas as number[])].sort((a, b) => a - b);
  }

  if (Array.isArray(body.dias_semana)) {
    const dias = body.dias_semana.filter((d: unknown) => typeof d === "number" && d >= 0 && d <= 6);
    if (dias.length === 0) {
      return NextResponse.json({ error: "Debe haber al menos un día habilitado" }, { status: 400 });
    }
    cambios.dias_semana = [...new Set(dias as number[])].sort((a, b) => a - b);
  }

  if (typeof body.minutos === "number" && body.minutos >= 0 && body.minutos <= 59) {
    cambios.minutos = Math.floor(body.minutos);
  }

  if (typeof body.tema_manual === "string") {
    cambios.tema_manual = body.tema_manual.trim() || null;
  }

  if (typeof body.max_por_dia === "number" && body.max_por_dia >= 1 && body.max_por_dia <= 10) {
    cambios.max_por_dia = Math.floor(body.max_por_dia);
  }

  if (["corto", "medio", "largo"].includes(body.longitud)) cambios.longitud = body.longitud;
  if (["pro", "estandar"].includes(body.tier_portada)) cambios.tier_portada = body.tier_portada;
  if (["sin-imagenes", "solo-portada", "completo"].includes(body.modo_imagenes)) {
    cambios.modo_imagenes = body.modo_imagenes;
  }

  if (Object.keys(cambios).length === 0) {
    return NextResponse.json({ error: "Sin campos válidos" }, { status: 400 });
  }

  const config = await actualizarBlogConfig(cambios);

  // Al guardar nueva config, limpiar slots para que el nuevo horario pueda disparar
  _g.__cronBlogSlotsHoy = new Set();
  _g.__cronBlogDiaHoy = undefined;

  return NextResponse.json(config);
}
