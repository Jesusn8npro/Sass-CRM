import { NextResponse, type NextRequest } from "next/server";
import {
  crearInversion,
  listarInversiones,
  obtenerCuenta,
  obtenerResumenInversiones,
} from "@/lib/baseDatos";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

function validarId(s: string): number | null {
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
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
  const inversiones = listarInversiones(id);
  const resumen = obtenerResumenInversiones(id);
  return NextResponse.json({ inversiones, resumen });
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

  let payload: {
    concepto?: unknown;
    monto?: unknown;
    moneda?: unknown;
    categoria?: unknown;
    fecha?: unknown;
    notas?: unknown;
  };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const concepto =
    typeof payload.concepto === "string" ? payload.concepto.trim() : "";
  if (!concepto) {
    return NextResponse.json(
      { error: "El concepto es obligatorio" },
      { status: 400 },
    );
  }
  if (typeof payload.monto !== "number" || !Number.isFinite(payload.monto)) {
    return NextResponse.json(
      { error: "El monto debe ser un número" },
      { status: 400 },
    );
  }
  if (payload.monto <= 0) {
    return NextResponse.json(
      { error: "El monto debe ser positivo" },
      { status: 400 },
    );
  }
  const moneda =
    typeof payload.moneda === "string" && payload.moneda.trim()
      ? payload.moneda.trim().toUpperCase().slice(0, 5)
      : "COP";
  const categoria =
    typeof payload.categoria === "string" && payload.categoria.trim()
      ? payload.categoria.trim()
      : null;
  const fecha =
    typeof payload.fecha === "number" && Number.isFinite(payload.fecha)
      ? Math.floor(payload.fecha)
      : Math.floor(Date.now() / 1000);
  const notas =
    typeof payload.notas === "string" && payload.notas.trim()
      ? payload.notas.trim()
      : null;

  const inversion = crearInversion(id, {
    concepto,
    monto: payload.monto,
    moneda,
    categoria,
    fecha,
    notas,
  });
  return NextResponse.json({ inversion }, { status: 201 });
}
