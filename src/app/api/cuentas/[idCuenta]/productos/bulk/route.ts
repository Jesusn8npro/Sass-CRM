import { NextResponse, type NextRequest } from "next/server";
import { crearProductosBulk } from "@/lib/baseDatos";
import { parsearJSON, verificarAccesoCuenta } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

interface FilaInput {
  nombre?: unknown;
  descripcion?: unknown;
  precio?: unknown;
  moneda?: unknown;
  stock?: unknown;
  sku?: unknown;
  categoria?: unknown;
  imagen_url_externa?: unknown;
}

interface FilaSaneada {
  nombre: string;
  descripcion: string;
  precio: number | null;
  moneda: string;
  stock: number | null;
  sku: string | null;
  categoria: string | null;
  imagen_url_externa: string | null;
}

const MAX_PRODUCTOS = 500;

function sanearFila(p: FilaInput): { fila: FilaSaneada } | { error: string } {
  const nombre = typeof p.nombre === "string" ? p.nombre.trim() : "";
  if (nombre.length < 2) return { error: "nombre muy corto (>=2 chars)" };
  if (nombre.length > 140) return { error: "nombre muy largo (<=140 chars)" };

  const descripcion =
    typeof p.descripcion === "string" ? p.descripcion.trim().slice(0, 2000) : "";

  let precio: number | null = null;
  if (p.precio !== undefined && p.precio !== null && p.precio !== "") {
    const n =
      typeof p.precio === "number"
        ? p.precio
        : typeof p.precio === "string"
          ? Number(p.precio.replace(/[^\d.-]/g, ""))
          : NaN;
    if (!Number.isFinite(n)) return { error: "precio no numérico" };
    precio = n;
  }

  let moneda = "COP";
  if (typeof p.moneda === "string" && p.moneda.trim()) {
    moneda = p.moneda.trim().toUpperCase().slice(0, 8);
  }

  let stock: number | null = null;
  if (p.stock !== undefined && p.stock !== null && p.stock !== "") {
    const n =
      typeof p.stock === "number"
        ? p.stock
        : typeof p.stock === "string"
          ? Number(p.stock)
          : NaN;
    if (!Number.isFinite(n)) return { error: "stock no numérico" };
    stock = Math.max(0, Math.floor(n));
  }

  const sku =
    typeof p.sku === "string" && p.sku.trim()
      ? p.sku.trim().slice(0, 80)
      : null;
  const categoria =
    typeof p.categoria === "string" && p.categoria.trim()
      ? p.categoria.trim().slice(0, 80)
      : null;

  let imagen_url_externa: string | null = null;
  if (typeof p.imagen_url_externa === "string" && p.imagen_url_externa.trim()) {
    const u = p.imagen_url_externa.trim();
    if (!/^https?:\/\//i.test(u)) {
      return { error: "imagen_url_externa debe empezar con http:// o https://" };
    }
    imagen_url_externa = u.slice(0, 1024);
  }

  return {
    fila: {
      nombre,
      descripcion,
      precio,
      moneda,
      stock,
      sku,
      categoria,
      imagen_url_externa,
    },
  };
}

export async function POST(req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;

  const payload = await parsearJSON<{ productos?: unknown }>(req);
  if (payload instanceof NextResponse) return payload;

  if (!Array.isArray(payload.productos)) {
    return NextResponse.json(
      { error: "Falta el array `productos`" },
      { status: 400 },
    );
  }
  if (payload.productos.length === 0) {
    return NextResponse.json(
      { error: "El array `productos` está vacío" },
      { status: 400 },
    );
  }
  if (payload.productos.length > MAX_PRODUCTOS) {
    return NextResponse.json(
      {
        error: `Máximo ${MAX_PRODUCTOS} productos por request (recibidos ${payload.productos.length})`,
      },
      { status: 400 },
    );
  }

  const validos: FilaSaneada[] = [];
  const errores: Array<{ fila: number; error: string }> = [];
  for (let i = 0; i < payload.productos.length; i++) {
    const item = payload.productos[i];
    if (!item || typeof item !== "object") {
      errores.push({ fila: i, error: "fila no es un objeto" });
      continue;
    }
    const r = sanearFila(item as FilaInput);
    if ("error" in r) {
      errores.push({ fila: i, error: r.error });
    } else {
      validos.push(r.fila);
    }
  }

  if (validos.length === 0) {
    return NextResponse.json({ creados: 0, errores });
  }

  const { creados, errores: erroresBulk } = await crearProductosBulk(
    idCuenta,
    validos,
  );
  // Errores devueltos por crearProductosBulk son a nivel del insert (no por
  // fila). Los anexamos como fila=-1 para que el cliente los vea.
  for (const e of erroresBulk) {
    errores.push({ fila: -1, error: e.error });
  }

  return NextResponse.json({ creados: creados.length, errores });
}
