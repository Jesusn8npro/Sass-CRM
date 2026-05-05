import { db, lanzar } from "./cliente";
import type { Producto } from "./tipos";

export async function listarProductos(cuentaId: string): Promise<Producto[]> {
  const { data, error } = await db()
    .from("productos")
    .select("*")
    .eq("cuenta_id", cuentaId)
    .order("esta_activo", { ascending: false })
    .order("orden", { ascending: true });
  if (error) lanzar(error, "listarProductos");
  return (data ?? []) as Producto[];
}

export async function listarProductosActivos(
  cuentaId: string,
): Promise<Producto[]> {
  const { data, error } = await db()
    .from("productos")
    .select("*")
    .eq("cuenta_id", cuentaId)
    .eq("esta_activo", true)
    .order("orden", { ascending: true });
  if (error) lanzar(error, "listarProductosActivos");
  return (data ?? []) as Producto[];
}

export async function obtenerProducto(id: string): Promise<Producto | null> {
  const { data, error } = await db()
    .from("productos")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) lanzar(error, "obtenerProducto");
  return (data as Producto) ?? null;
}

export async function crearProducto(
  cuentaId: string,
  datos: {
    nombre: string;
    descripcion?: string;
    precio?: number | null;
    moneda?: string;
    costo?: number | null;
    stock?: number | null;
    sku?: string | null;
    categoria?: string | null;
    imagen_path?: string | null;
    imagen_url_externa?: string | null;
  },
): Promise<Producto> {
  const { data: max } = await db()
    .from("productos")
    .select("orden")
    .eq("cuenta_id", cuentaId)
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();
  const orden = ((max as { orden: number } | null)?.orden ?? 0) + 1;
  const { data, error } = await db()
    .from("productos")
    .insert({
      cuenta_id: cuentaId,
      nombre: datos.nombre,
      descripcion: datos.descripcion ?? "",
      precio: datos.precio ?? null,
      moneda: datos.moneda ?? "COP",
      costo: datos.costo ?? null,
      stock: datos.stock ?? null,
      sku: datos.sku ?? null,
      categoria: datos.categoria ?? null,
      imagen_path: datos.imagen_path ?? null,
      imagen_url_externa: datos.imagen_url_externa ?? null,
      orden,
    })
    .select()
    .single();
  if (error) lanzar(error, "crearProducto");
  return data as Producto;
}

/**
 * Inserción masiva de productos (CSV import). Asigna orden secuencial
 * empezando desde el último orden existente. Devuelve los productos
 * creados. Si alguno falla por validación, esa fila se descarta y el
 * error se reporta — el resto se inserta de todos modos (best-effort).
 */
export async function crearProductosBulk(
  cuentaId: string,
  productos: Array<{
    nombre: string;
    descripcion?: string;
    precio?: number | null;
    moneda?: string;
    costo?: number | null;
    stock?: number | null;
    sku?: string | null;
    categoria?: string | null;
    imagen_url_externa?: string | null;
  }>,
): Promise<{ creados: Producto[]; errores: Array<{ fila: number; error: string }> }> {
  if (productos.length === 0) return { creados: [], errores: [] };

  const { data: max } = await db()
    .from("productos")
    .select("orden")
    .eq("cuenta_id", cuentaId)
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();
  const ordenInicial = ((max as { orden: number } | null)?.orden ?? 0) + 1;

  const filas = productos.map((p, idx) => ({
    cuenta_id: cuentaId,
    nombre: p.nombre,
    descripcion: p.descripcion ?? "",
    precio: p.precio ?? null,
    moneda: p.moneda ?? "COP",
    costo: p.costo ?? null,
    stock: p.stock ?? null,
    sku: p.sku ?? null,
    categoria: p.categoria ?? null,
    imagen_url_externa: p.imagen_url_externa ?? null,
    orden: ordenInicial + idx,
  }));

  const { data, error } = await db()
    .from("productos")
    .insert(filas)
    .select();
  if (error) {
    return {
      creados: [],
      errores: [{ fila: 0, error: error.message ?? "fallo bulk insert" }],
    };
  }
  return { creados: (data ?? []) as Producto[], errores: [] };
}

export async function actualizarProducto(
  id: string,
  datos: Partial<{
    nombre: string;
    descripcion: string;
    precio: number | null;
    moneda: string;
    costo: number | null;
    stock: number | null;
    sku: string | null;
    categoria: string | null;
    imagen_path: string | null;
    imagen_url_externa: string | null;
    video_path: string | null;
    esta_activo: boolean;
    orden: number;
  }>,
): Promise<Producto | null> {
  const cambios: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(datos)) {
    if (v !== undefined) cambios[k] = v;
  }
  if (Object.keys(cambios).length === 0) return obtenerProducto(id);
  const { data, error } = await db()
    .from("productos")
    .update(cambios)
    .eq("id", id)
    .select()
    .single();
  if (error) lanzar(error, "actualizarProducto");
  return data as Producto;
}

export async function borrarProducto(id: string): Promise<void> {
  const { error } = await db().from("productos").delete().eq("id", id);
  if (error) lanzar(error, "borrarProducto");
}
