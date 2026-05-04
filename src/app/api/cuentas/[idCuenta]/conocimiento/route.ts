import { NextResponse, type NextRequest } from "next/server";
import {
  crearConocimiento,
  listarConocimientoDeCuenta,
} from "@/lib/baseDatos";
import { parsearJSON, verificarAccesoCuenta } from "@/lib/auth/sesion";
import { indexarEntrada } from "@/lib/rag/indexar";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

export async function GET(_req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;
  const entradas = await listarConocimientoDeCuenta(idCuenta);
  return NextResponse.json({ entradas });
}

export async function POST(req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;

  const payload = await parsearJSON<{
    titulo?: unknown;
    contenido?: unknown;
    categoria?: unknown;
    esta_activo?: unknown;
  }>(req);
  if (payload instanceof NextResponse) return payload;

  const titulo = typeof payload.titulo === "string" ? payload.titulo.trim() : "";
  const contenido =
    typeof payload.contenido === "string" ? payload.contenido : "";
  const categoria =
    typeof payload.categoria === "string" && payload.categoria.trim()
      ? payload.categoria
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9_]+/g, "_")
          .slice(0, 30)
      : "general";
  const esta_activo =
    typeof payload.esta_activo === "boolean" ? payload.esta_activo : true;
  if (!titulo) {
    return NextResponse.json(
      { error: "El título es obligatorio" },
      { status: 400 },
    );
  }

  const entrada = await crearConocimiento(idCuenta, titulo, contenido, {
    categoria,
    esta_activo,
  });

  // Indexar para RAG en background — no bloqueamos la respuesta. Si
  // falla (por ej OpenAI rate limit), el log queda pero el user recibe
  // OK y la entrada igual queda creada (modo dump como fallback).
  void indexarEntrada({
    conocimientoId: entrada.id,
    cuentaId: idCuenta,
    titulo: entrada.titulo,
    contenido: entrada.contenido,
  }).catch((err) => {
    console.error("[conocimiento] indexar fallo (no bloqueante):", err);
  });

  return NextResponse.json({ entrada });
}
