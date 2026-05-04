/**
 * Rate limit en memoria (por proceso) — sliding window.
 *
 * Suficiente para una sola instancia del SaaS. Cuando se escale
 * horizontal va a hacer falta migrar a Postgres/Redis: la firma del
 * helper es estable para no tener que tocar los handlers en ese momento.
 */
import { NextResponse } from "next/server";

interface Cubeta {
  ts: number[];
}

const buckets = new Map<string, Cubeta>();

/**
 * Devuelve null si el caller está dentro de límite, o NextResponse 429
 * con mensaje legible si lo excedió.
 *
 * @param clave id estable del caller (p.ej. `${userId}:imagenes-generar`)
 * @param max cantidad máxima permitida en la ventana
 * @param ventanaSeg ancho de ventana en segundos
 */
export function verificarRateLimit(
  clave: string,
  max: number,
  ventanaSeg: number,
): NextResponse | null {
  const ahora = Date.now();
  const corte = ahora - ventanaSeg * 1000;
  const cubeta = buckets.get(clave) ?? { ts: [] };

  // Drop entradas viejas
  const recientes = cubeta.ts.filter((t) => t >= corte);
  if (recientes.length >= max) {
    const primero = recientes[0]!;
    const reintentarEn = Math.max(1, Math.ceil((primero + ventanaSeg * 1000 - ahora) / 1000));
    return NextResponse.json(
      {
        error: "Demasiadas solicitudes. Intentá más tarde.",
        reintentar_en_seg: reintentarEn,
      },
      { status: 429, headers: { "Retry-After": String(reintentarEn) } },
    );
  }

  recientes.push(ahora);
  cubeta.ts = recientes;
  buckets.set(clave, cubeta);

  // GC eventual: si crece mucho, limpiamos cubetas vacías
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (v.ts.length === 0 || v.ts[v.ts.length - 1]! < corte) buckets.delete(k);
    }
  }
  return null;
}
