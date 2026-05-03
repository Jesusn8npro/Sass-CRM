import { NextResponse, type NextRequest } from "next/server";
import {
  actualizarEtapa,
  borrarEtapa,
  obtenerCuenta,
  obtenerEtapa,
} from "@/lib/baseDatos";
import { requerirSesion } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string; idEtapa: string }>;
}

const COLORES_VALIDOS = new Set([
  "zinc",
  "rojo",
  "ambar",
  "amarillo",
  "esmeralda",
  "azul",
  "violeta",
  "rosa",
]);

export async function PATCH(req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta, idEtapa } = await params;
  if (!idCuenta || !idEtapa) {
    return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
  }
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }
  const etapa = await obtenerEtapa(idEtapa);
  if (!etapa || etapa.cuenta_id !== idCuenta) {
    return NextResponse.json({ error: "Etapa no encontrada" }, { status: 404 });
  }

  let payload: {
    nombre?: unknown;
    color?: unknown;
    orden?: unknown;
    paso_id?: unknown;
    paso_siguiente_id?: unknown;
    criterio_transicion?: unknown;
    objetivos?: unknown;
    descripcion?: unknown;
  };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const slugify = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9_]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40);

  const nombre =
    typeof payload.nombre === "string" && payload.nombre.trim()
      ? payload.nombre.trim()
      : undefined;
  const color =
    typeof payload.color === "string" && COLORES_VALIDOS.has(payload.color)
      ? payload.color
      : undefined;
  const orden =
    typeof payload.orden === "number" && Number.isFinite(payload.orden)
      ? payload.orden
      : undefined;
  const paso_id =
    typeof payload.paso_id === "string"
      ? payload.paso_id.trim()
        ? slugify(payload.paso_id)
        : null
      : undefined;
  const paso_siguiente_id =
    typeof payload.paso_siguiente_id === "string"
      ? payload.paso_siguiente_id.trim()
        ? slugify(payload.paso_siguiente_id)
        : null
      : undefined;
  const criterio_transicion =
    typeof payload.criterio_transicion === "string"
      ? payload.criterio_transicion.slice(0, 500)
      : undefined;
  const objetivos =
    typeof payload.objetivos === "string"
      ? payload.objetivos.slice(0, 300)
      : undefined;
  const descripcion =
    typeof payload.descripcion === "string"
      ? payload.descripcion.slice(0, 500)
      : undefined;

  const actualizada = await actualizarEtapa(idEtapa, {
    nombre,
    color,
    orden,
    paso_id,
    paso_siguiente_id,
    criterio_transicion,
    objetivos,
    descripcion,
  });
  return NextResponse.json({ etapa: actualizada });
}

export async function DELETE(_req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta, idEtapa } = await params;
  if (!idCuenta || !idEtapa) {
    return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
  }
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }
  const etapa = await obtenerEtapa(idEtapa);
  if (!etapa || etapa.cuenta_id !== idCuenta) {
    return NextResponse.json({ error: "Etapa no encontrada" }, { status: 404 });
  }
  await borrarEtapa(idEtapa);
  return NextResponse.json({ ok: true });
}
