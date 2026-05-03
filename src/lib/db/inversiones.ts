import { db, lanzar } from "./cliente";
import type { Inversion, ResumenInversiones } from "./tipos";

export async function listarInversiones(
  cuentaId: string,
  limite = 200,
): Promise<Inversion[]> {
  const { data, error } = await db()
    .from("inversiones")
    .select("*")
    .eq("cuenta_id", cuentaId)
    .order("fecha", { ascending: false })
    .limit(limite);
  if (error) lanzar(error, "listarInversiones");
  return (data ?? []) as Inversion[];
}

export async function obtenerInversion(id: string): Promise<Inversion | null> {
  const { data, error } = await db()
    .from("inversiones")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) lanzar(error, "obtenerInversion");
  return (data as Inversion) ?? null;
}

export async function crearInversion(
  cuentaId: string,
  datos: {
    concepto: string;
    monto: number;
    moneda?: string;
    categoria?: string | null;
    fecha?: string; // ISO
    notas?: string | null;
  },
): Promise<Inversion> {
  const { data, error } = await db()
    .from("inversiones")
    .insert({
      cuenta_id: cuentaId,
      concepto: datos.concepto,
      monto: datos.monto,
      moneda: datos.moneda ?? "COP",
      categoria: datos.categoria ?? null,
      fecha: datos.fecha ?? new Date().toISOString(),
      notas: datos.notas ?? null,
    })
    .select()
    .single();
  if (error) lanzar(error, "crearInversion");
  return data as Inversion;
}

export async function actualizarInversion(
  id: string,
  cambios: Partial<{
    concepto: string;
    monto: number;
    moneda: string;
    categoria: string | null;
    fecha: string;
    notas: string | null;
  }>,
): Promise<Inversion | null> {
  const { data, error } = await db()
    .from("inversiones")
    .update(cambios)
    .eq("id", id)
    .select()
    .single();
  if (error) lanzar(error, "actualizarInversion");
  return data as Inversion;
}

export async function borrarInversion(id: string): Promise<void> {
  const { error } = await db().from("inversiones").delete().eq("id", id);
  if (error) lanzar(error, "borrarInversion");
}

export async function obtenerResumenInversiones(
  cuentaId: string,
): Promise<ResumenInversiones> {
  const { data, error } = await db()
    .from("inversiones")
    .select("monto, moneda, categoria")
    .eq("cuenta_id", cuentaId);
  if (error) lanzar(error, "obtenerResumenInversiones");
  const por_moneda_map = new Map<string, { total: number; n: number }>();
  const por_cat_map = new Map<string, { total: number; n: number }>();
  for (const row of (data ?? []) as Array<{
    monto: number;
    moneda: string;
    categoria: string | null;
  }>) {
    const monedaKey = row.moneda;
    const m = por_moneda_map.get(monedaKey) ?? { total: 0, n: 0 };
    m.total += Number(row.monto);
    m.n += 1;
    por_moneda_map.set(monedaKey, m);

    const cat = row.categoria || "Sin categoría";
    const catKey = `${cat}|${row.moneda}`;
    const c = por_cat_map.get(catKey) ?? { total: 0, n: 0 };
    c.total += Number(row.monto);
    c.n += 1;
    por_cat_map.set(catKey, c);
  }
  return {
    por_moneda: Array.from(por_moneda_map.entries()).map(([moneda, v]) => ({
      moneda,
      total: v.total,
      n: v.n,
    })),
    por_categoria: Array.from(por_cat_map.entries())
      .map(([k, v]) => {
        const [categoria, moneda] = k.split("|");
        return { categoria, moneda, total: v.total, n: v.n };
      })
      .sort((a, b) => b.total - a.total),
  };
}
