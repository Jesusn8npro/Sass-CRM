import { NextResponse, type NextRequest } from "next/server";
import {
  contarChunksDeCuenta,
  listarConocimientoDeCuenta,
  obtenerCuenta,
} from "@/lib/baseDatos";
import { requerirSesion } from "@/lib/auth/sesion";
import { reindexarCuenta } from "@/lib/rag/indexar";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300; // PDFs grandes pueden tardar 1-2 min

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

/**
 * POST /api/cuentas/[idCuenta]/conocimiento/reindexar
 *
 * Re-genera embeddings para TODAS las entradas activas de la cuenta.
 * Útil para:
 *  - Backfill al activar RAG por primera vez (entradas viejas que no
 *    tenían chunks).
 *  - Re-procesamiento si cambiaste el modelo de embedding.
 *  - Recuperar de un fallo masivo (rate limit OpenAI, etc).
 *
 * Operación pesada — corre sincrono y devuelve el resumen.
 */
export async function POST(_req: NextRequest, { params }: Contexto) {
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

  const entradas = await listarConocimientoDeCuenta(idCuenta);
  const resumen = await reindexarCuenta(
    idCuenta,
    entradas.map((e) => ({
      id: e.id,
      titulo: e.titulo,
      contenido: e.contenido,
      esta_activo: e.esta_activo,
    })),
  );

  return NextResponse.json({
    ok: true,
    ...resumen,
    chunks_totales_en_db: await contarChunksDeCuenta(idCuenta),
  });
}

/**
 * GET — devuelve el estado actual del índice (cuántos chunks).
 */
export async function GET(_req: NextRequest, { params }: Contexto) {
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

  const [entradas, chunks] = await Promise.all([
    listarConocimientoDeCuenta(idCuenta),
    contarChunksDeCuenta(idCuenta),
  ]);

  return NextResponse.json({
    entradas_activas: entradas.filter((e) => e.esta_activo).length,
    chunks_indexados: chunks,
    rag_activo: chunks > 0,
  });
}
