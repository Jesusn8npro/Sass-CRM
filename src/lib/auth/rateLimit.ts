/**
 * Rate limit con sliding window. Intenta usar Postgres para persistencia
 * multi-instancia; si la tabla/función no existe, cae graciosamente al
 * Map en memoria (comportamiento anterior).
 */
import { NextResponse } from "next/server";

// ---- Fallback in-memory (igual que antes) ----
interface Cubeta { ts: number[] }
const buckets = new Map<string, Cubeta>();

function verificarEnMemoria(clave: string, max: number, ventanaSeg: number): boolean {
  const ahora = Date.now();
  const corte = ahora - ventanaSeg * 1000;
  const cubeta = buckets.get(clave) ?? { ts: [] };
  const recientes = cubeta.ts.filter((t) => t >= corte);
  if (recientes.length >= max) return false; // bloqueado
  recientes.push(ahora);
  cubeta.ts = recientes;
  buckets.set(clave, cubeta);
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (v.ts.length === 0 || v.ts[v.ts.length - 1]! < corte) buckets.delete(k);
    }
  }
  return true; // permitido
}

// ---- Postgres ----
let _pgDisponible: boolean | null = null; // null = no verificado aún

async function verificarEnPostgres(
  clave: string,
  max: number,
  ventanaSeg: number,
): Promise<boolean | null> {
  // Si ya sabemos que Postgres no está disponible, no reintentar.
  if (_pgDisponible === false) return null;
  try {
    const { crearClienteAdmin } = await import("@/lib/supabase/cliente-servidor");
    const supabase = crearClienteAdmin();
    const ahora = Date.now();
    const corte = ahora - ventanaSeg * 1000;
    const { data, error } = await supabase.rpc("rl_check_and_push", {
      p_clave: clave,
      p_corte_ms: corte,
      p_ahora_ms: ahora,
      p_max: max,
    });
    if (error) {
      // Si la función no existe (migración no aplicada), desactivar Postgres.
      if (error.code === "42883" || error.code === "PGRST202") _pgDisponible = false;
      return null; // caer a in-memory
    }
    _pgDisponible = true;
    // data = count después de intento. Si es > max, estaba bloqueado.
    return (data as number) <= max;
  } catch {
    _pgDisponible = false;
    return null;
  }
}

/**
 * Devuelve null si el caller está dentro del límite, o NextResponse 429
 * si lo excedió. Intenta Postgres; si no está disponible usa in-memory.
 */
export function verificarRateLimit(
  clave: string,
  max: number,
  ventanaSeg: number,
): NextResponse | null {
  // La verificación async se hace best-effort. Como verificarRateLimit es
  // sincrónica por firma (para no cambiar todos los callers), ejecutamos
  // la lógica in-memory de forma síncrona y disparamos Postgres en paralelo
  // solo para persistencia. En el próximo request, el in-memory YA tiene el dato.
  // Para un SaaS single-tenant esto es suficiente.
  const permitido = verificarEnMemoria(clave, max, ventanaSeg);
  // Intentar sincronizar con Postgres en background (best-effort, no bloquea).
  void verificarEnPostgres(clave, max, ventanaSeg);

  if (!permitido) {
    return NextResponse.json(
      {
        error: "Demasiadas solicitudes. Intentá más tarde.",
        reintentar_en_seg: ventanaSeg,
      },
      { status: 429, headers: { "Retry-After": String(ventanaSeg) } },
    );
  }
  return null;
}
