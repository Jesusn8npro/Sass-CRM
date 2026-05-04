import { NextResponse, type NextRequest } from "next/server";
import {
  crearEtapa,
  listarEtapas,
  reordenarEtapas,
  sembrarEtapasSiVacias,
} from "@/lib/baseDatos";
import { parsearJSON, verificarAccesoCuenta } from "@/lib/auth/sesion";

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
  const { idCuenta } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;
  // Lazy seed: si la cuenta venía de antes y no tenía etapas, sembramos.
  await sembrarEtapasSiVacias(idCuenta);
  const etapas = await listarEtapas(idCuenta);
  return NextResponse.json({ etapas });
}

export async function POST(req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;

  const payload = await parsearJSON<{
    nombre?: unknown;
    color?: unknown;
    orden_ids?: unknown;
    paso_id?: unknown;
    paso_siguiente_id?: unknown;
    criterio_transicion?: unknown;
    objetivos?: unknown;
    descripcion?: unknown;
    plantilla?: unknown;
  }>(req);
  if (payload instanceof NextResponse) return payload;

  // Reordenar (drag-drop de columnas): payload trae { orden_ids: string[] }
  if (Array.isArray(payload.orden_ids)) {
    const ids = payload.orden_ids.filter(
      (s): s is string => typeof s === "string" && s.length > 0,
    );
    await reordenarEtapas(idCuenta, ids);
    const etapas = await listarEtapas(idCuenta);
    return NextResponse.json({ etapas });
  }

  // Aplicar plantilla pre-armada → crea N etapas de una
  if (typeof payload.plantilla === "string") {
    const { aplicarPlantillaFunnel } = await import("@/lib/plantillasFunnel");
    try {
      const etapas = await aplicarPlantillaFunnel(idCuenta, payload.plantilla);
      return NextResponse.json({ etapas, mensaje: "Plantilla aplicada" });
    } catch (err) {
      return NextResponse.json(
        {
          error:
            err instanceof Error
              ? err.message
              : "Error aplicando plantilla",
        },
        { status: 400 },
      );
    }
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
  const slugify = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9_]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40);
  const opciones = {
    paso_id:
      typeof payload.paso_id === "string" && payload.paso_id.trim()
        ? slugify(payload.paso_id)
        : null,
    paso_siguiente_id:
      typeof payload.paso_siguiente_id === "string" &&
      payload.paso_siguiente_id.trim()
        ? slugify(payload.paso_siguiente_id)
        : null,
    criterio_transicion:
      typeof payload.criterio_transicion === "string"
        ? payload.criterio_transicion.slice(0, 500)
        : "",
    objetivos:
      typeof payload.objetivos === "string"
        ? payload.objetivos.slice(0, 300)
        : "",
    descripcion:
      typeof payload.descripcion === "string"
        ? payload.descripcion.slice(0, 500)
        : "",
  };
  try {
    const etapa = await crearEtapa(idCuenta, nombre, color, opciones);
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
