import { NextResponse, type NextRequest } from "next/server";
import {
  crearEtapa,
  listarEtapas,
  obtenerCuenta,
  reordenarEtapas,
  sembrarEtapasSiVacias,
} from "@/lib/baseDatos";

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

function validarId(idCuenta: string): number | null {
  const id = Number(idCuenta);
  if (!Number.isFinite(id) || id <= 0) return null;
  return id;
}

export async function GET(_req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const id = validarId(idCuenta);
  if (id === null) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  if (!obtenerCuenta(id)) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }
  // Lazy seed: si la cuenta venía de antes y no tenía etapas, sembramos.
  sembrarEtapasSiVacias(id);
  const etapas = listarEtapas(id);
  return NextResponse.json({ etapas });
}

export async function POST(req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const id = validarId(idCuenta);
  if (id === null) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  if (!obtenerCuenta(id)) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }

  let payload: { nombre?: unknown; color?: unknown; orden_ids?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  // Reordenar (drag-drop de columnas): payload trae { orden_ids: number[] }
  if (Array.isArray(payload.orden_ids)) {
    const ids = payload.orden_ids.filter(
      (n): n is number => typeof n === "number" && Number.isFinite(n),
    );
    reordenarEtapas(id, ids);
    return NextResponse.json({ etapas: listarEtapas(id) });
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
    const etapa = crearEtapa(id, nombre, color);
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
