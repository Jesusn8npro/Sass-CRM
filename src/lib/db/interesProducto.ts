import { db, lanzar } from "./cliente";
import { listarProductos } from "./productos";
import type {
  InteresConProducto,
  InteresProducto,
  InteresadoEnProducto,
  ModoConversacion,
  ProductoTop,
} from "./tipos";

export async function registrarInteresEnProducto(
  conversacionId: string,
  productoId: string,
  cuentaId: string,
): Promise<void> {
  const ahoraIso = new Date().toISOString();
  const { data: existente } = await db()
    .from("conversacion_productos_interes")
    .select("veces")
    .eq("conversacion_id", conversacionId)
    .eq("producto_id", productoId)
    .maybeSingle();
  if (existente) {
    const { error } = await db()
      .from("conversacion_productos_interes")
      .update({
        veces: (existente as { veces: number }).veces + 1,
        ultimo_interes_en: ahoraIso,
      })
      .eq("conversacion_id", conversacionId)
      .eq("producto_id", productoId);
    if (error) lanzar(error, "registrarInteresEnProducto.update");
  } else {
    const { error } = await db()
      .from("conversacion_productos_interes")
      .insert({
        conversacion_id: conversacionId,
        producto_id: productoId,
        cuenta_id: cuentaId,
        ultimo_interes_en: ahoraIso,
        veces: 1,
      });
    if (error) lanzar(error, "registrarInteresEnProducto.insert");
  }
}

export async function listarInteresDeConversacion(
  conversacionId: string,
): Promise<InteresConProducto[]> {
  const { data, error } = await db()
    .from("conversacion_productos_interes")
    .select("*, productos (nombre, precio, moneda, imagen_path, stock)")
    .eq("conversacion_id", conversacionId)
    .order("ultimo_interes_en", { ascending: false });
  if (error) lanzar(error, "listarInteresDeConversacion");
  return (
    (data ?? []) as Array<
      InteresProducto & {
        productos: {
          nombre: string;
          precio: number | null;
          moneda: string;
          imagen_path: string | null;
          stock: number | null;
        };
      }
    >
  ).map((r) => ({
    ...r,
    nombre: r.productos.nombre,
    precio: r.productos.precio,
    moneda: r.productos.moneda,
    imagen_path: r.productos.imagen_path,
    stock: r.productos.stock,
  }));
}

export async function listarInteresadosEnProducto(
  productoId: string,
): Promise<InteresadoEnProducto[]> {
  const { data, error } = await db()
    .from("conversacion_productos_interes")
    .select("*, conversaciones (nombre, telefono, modo, necesita_humano)")
    .eq("producto_id", productoId)
    .order("ultimo_interes_en", { ascending: false });
  if (error) lanzar(error, "listarInteresadosEnProducto");
  return (
    (data ?? []) as Array<
      InteresProducto & {
        conversaciones: {
          nombre: string | null;
          telefono: string;
          modo: ModoConversacion;
          necesita_humano: boolean;
        };
      }
    >
  ).map((r) => ({
    ...r,
    nombre_contacto: r.conversaciones.nombre,
    telefono: r.conversaciones.telefono,
    modo: r.conversaciones.modo,
    necesita_humano: r.conversaciones.necesita_humano,
  }));
}

export async function listarTopProductos(
  cuentaId: string,
  limite = 10,
): Promise<ProductoTop[]> {
  const productos = await listarProductos(cuentaId);
  if (productos.length === 0) return [];
  const { data: intereses } = await db()
    .from("conversacion_productos_interes")
    .select("producto_id, conversacion_id, veces")
    .eq("cuenta_id", cuentaId);
  const stats = new Map<
    string,
    { conversaciones: Set<string>; menciones: number }
  >();
  for (const row of (intereses ?? []) as Array<{
    producto_id: string;
    conversacion_id: string;
    veces: number;
  }>) {
    const s = stats.get(row.producto_id) ?? {
      conversaciones: new Set<string>(),
      menciones: 0,
    };
    s.conversaciones.add(row.conversacion_id);
    s.menciones += row.veces;
    stats.set(row.producto_id, s);
  }
  return productos
    .map((p) => {
      const s = stats.get(p.id);
      return {
        id: p.id,
        nombre: p.nombre,
        precio: p.precio,
        moneda: p.moneda,
        stock: p.stock,
        conversaciones_interesadas: s?.conversaciones.size ?? 0,
        total_menciones: s?.menciones ?? 0,
      };
    })
    .sort((a, b) => b.conversaciones_interesadas - a.conversaciones_interesadas)
    .slice(0, limite);
}
