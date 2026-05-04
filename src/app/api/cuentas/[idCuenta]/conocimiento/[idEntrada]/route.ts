import { NextResponse, type NextRequest } from "next/server";
import {
  actualizarConocimiento,
  borrarConocimiento,
  listarConocimientoDeCuenta,
} from "@/lib/baseDatos";
import { parsearJSON, verificarAccesoCuenta } from "@/lib/auth/sesion";
import { indexarEntrada } from "@/lib/rag/indexar";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Contexto {
  params: Promise<{ idCuenta: string; idEntrada: string }>;
}

export async function PATCH(req: NextRequest, { params }: Contexto) {
  const { idCuenta, idEntrada } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;
  if (!idEntrada) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const entradas = await listarConocimientoDeCuenta(idCuenta);
  const entrada = entradas.find((e) => e.id === idEntrada);
  if (!entrada) {
    return NextResponse.json(
      { error: "Entrada no encontrada" },
      { status: 404 },
    );
  }

  const payload = await parsearJSON<{
    titulo?: unknown;
    contenido?: unknown;
    orden?: unknown;
    categoria?: unknown;
    esta_activo?: unknown;
  }>(req);
  if (payload instanceof NextResponse) return payload;

  const titulo =
    typeof payload.titulo === "string" ? payload.titulo : undefined;
  const contenido =
    typeof payload.contenido === "string" ? payload.contenido : undefined;
  const orden =
    typeof payload.orden === "number" ? payload.orden : undefined;
  const categoria =
    typeof payload.categoria === "string" && payload.categoria.trim()
      ? payload.categoria
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9_]+/g, "_")
          .slice(0, 30)
      : undefined;
  const esta_activo =
    typeof payload.esta_activo === "boolean" ? payload.esta_activo : undefined;

  const actualizada = await actualizarConocimiento(idEntrada, {
    titulo,
    contenido,
    orden,
    categoria,
    esta_activo,
  });
  if (!actualizada) {
    return NextResponse.json(
      { error: "No se pudo actualizar" },
      { status: 500 },
    );
  }

  // Re-indexar si cambio titulo o contenido (no si solo cambio
  // categoria/orden/activo).
  if (titulo !== undefined || contenido !== undefined) {
    void indexarEntrada({
      conocimientoId: actualizada.id,
      cuentaId: idCuenta,
      titulo: actualizada.titulo,
      contenido: actualizada.contenido,
    }).catch((err) => {
      console.error("[conocimiento] re-indexar fallo (no bloqueante):", err);
    });
  }

  return NextResponse.json({ entrada: actualizada });
}

export async function DELETE(_req: NextRequest, { params }: Contexto) {
  const { idCuenta, idEntrada } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;
  if (!idEntrada) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const entradas = await listarConocimientoDeCuenta(idCuenta);
  const entrada = entradas.find((e) => e.id === idEntrada);
  if (!entrada) {
    return NextResponse.json(
      { error: "Entrada no encontrada" },
      { status: 404 },
    );
  }
  await borrarConocimiento(idEntrada);
  return NextResponse.json({ ok: true });
}
