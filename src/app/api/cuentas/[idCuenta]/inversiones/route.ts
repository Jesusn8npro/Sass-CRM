import { NextResponse, type NextRequest } from "next/server";
import {
  crearInversion,
  listarInversiones,
  obtenerCuenta,
  obtenerResumenInversiones,
} from "@/lib/baseDatos";
import { requerirSesion } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

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
  const inversiones = await listarInversiones(idCuenta);
  const resumen = await obtenerResumenInversiones(idCuenta);
  return NextResponse.json({ inversiones, resumen });
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
  // fecha como ISO string del cliente; si no llega, la firma usa now().
  const fecha =
    typeof payload.fecha === "string" && payload.fecha.trim()
      ? payload.fecha
      : undefined;
  const notas =
    typeof payload.notas === "string" && payload.notas.trim()
      ? payload.notas.trim()
      : null;

  const inversion = await crearInversion(idCuenta, {
    concepto,
    monto: payload.monto,
    moneda,
    categoria,
    fecha,
    notas,
  });
  return NextResponse.json({ inversion }, { status: 201 });
}
