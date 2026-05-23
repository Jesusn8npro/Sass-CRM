import { NextResponse } from "next/server";
import { requerirAdmin } from "@/lib/auth/sesion";
import { obtenerBlogConfig } from "@/lib/db/blogConfig";
import { ejecutarGeneracionBlog } from "@/lib/blog/ejecutarGeneracion";
import { registrarRunCron } from "@/lib/db/blogCronRuns";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST() {
  const auth = await requerirAdmin();
  if (auth instanceof NextResponse) return auth;

  let config;
  try {
    config = await obtenerBlogConfig();
  } catch {
    config = null;
  }

  try {
    const resultado = await ejecutarGeneracionBlog({
      longitud: (config?.longitud ?? "medio") as "corto" | "medio" | "largo",
      tierPortada: (config?.tier_portada ?? "pro") as "pro" | "estandar",
      modoImagenes: (config?.modo_imagenes ?? "completo") as "sin-imagenes" | "solo-portada" | "completo",
      temaManual: config?.tema_manual ?? undefined,
    });
    void registrarRunCron({
      resultado: "publicado",
      disparado_por: "manual",
      slug_articulo: resultado.slug,
      titulo_articulo: resultado.titulo,
      categoria: resultado.categoria,
      ms_total: resultado.ms_total,
      error_mensaje: null,
    });
    return NextResponse.json(resultado);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    void registrarRunCron({
      resultado: "error",
      disparado_por: "manual",
      slug_articulo: null,
      titulo_articulo: null,
      categoria: null,
      ms_total: null,
      error_mensaje: msg,
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
