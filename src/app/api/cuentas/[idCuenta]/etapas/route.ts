import { NextResponse, type NextRequest } from "next/server";
import {
  crearEtapa,
  listarEtapas,
  obtenerCuenta,
  reordenarEtapas,
  sembrarEtapasSiVacias,
} from "@/lib/baseDatos";
import { requerirSesion } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

// Misma paleta que etiquetas para que pillas y columnas combinen.
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

export async function GET(_req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta } = await params;
  if (!idCuenta) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }
  // Lazy seed: si la cuenta venía de antes y no tenía etapas, sembramos.
  await sembrarEtapasSiVacias(idCuenta);
  const etapas = await listarEtapas(idCuenta);
  return NextResponse.json({ etapas });
}

export async function POST(req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta } = await params;
  if (!idCuenta) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }

  let payload: { nombre?: unknown; color?: unknown; orden_ids?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  // Reordenar (drag-drop de columnas): payload trae { orden_ids: string[] }
  if (Array.isArray(payload.orden_ids)) {
    const ids = payload.orden_ids.filter(
      (s): s is string => typeof s === "string" && s.length > 0,
    );
    await reordenarEtapas(idCuenta, ids);
    const etapas = await listarEtapas(idCuenta);
    return NextResponse.json({ etapas });
  }

  // Crear nueva etapa
  const nombre =
    typeof payload.nombre === "string" ? payload.nombre.trim() : "";
  if (!nombre) {
    return NextResponse.json(
      { error: "El nombre es obligatorio" },
      { status: 400 },
    );
  }
  const color =
    typeof payload.color === "string" && COLORES_VALIDOS.has(payload.color)
      ? payload.color
      : "zinc";
  try {
    const etapa = await crearEtapa(idCuenta, nombre, color);
    return NextResponse.json({ etapa }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error && err.message.includes("UNIQUE")
            ? "Ya existe una etapa con ese nombre"
            : "Error creando etapa",
      },
      { status: 400 },
    );
  }
}
