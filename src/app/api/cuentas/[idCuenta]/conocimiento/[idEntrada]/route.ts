import { NextResponse, type NextRequest } from "next/server";
import {
  actualizarConocimiento,
  borrarConocimiento,
  listarConocimientoDeCuenta,
  obtenerCuenta,
} from "@/lib/baseDatos";
import { requerirSesion } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string; idEntrada: string }>;
}

export async function PATCH(req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta, idEntrada } = await params;
  if (!idCuenta || !idEntrada) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }

  const entradas = await listarConocimientoDeCuenta(idCuenta);
  const entrada = entradas.find((e) => e.id === idEntrada);
  if (!entrada) {
    return NextResponse.json(
      { error: "Entrada no encontrada" },
      { status: 404 },
    );
  }

  let payload: {
    titulo?: unknown;
    contenido?: unknown;
    orden?: unknown;
    categoria?: unknown;
    esta_activo?: unknown;
  };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

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
  return NextResponse.json({ entrada: actualizada });
}

export async function DELETE(_req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta, idEntrada } = await params;
  if (!idCuenta || !idEntrada) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
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
