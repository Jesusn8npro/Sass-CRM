import { db, lanzar } from "./cliente";

export type ProveedorMetering =
  | "openai"
  | "vapi"
  | "elevenlabs"
  | "whisper"
  | "gemini"
  | "apify";

export interface RegistroMetering {
  cuenta_id: string;
  proveedor: ProveedorMetering;
  modelo?: string | null;
  tokens_in?: number;
  tokens_out?: number;
  caracteres?: number;
  segundos?: number;
  costo_usd?: number;
  costo_creditos?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Registra un evento de consumo de servicio externo. Fire-and-forget:
 * los errores se loggean pero nunca rompen el flujo de la llamada
 * principal. Cuando la migración 07 esté aplicada en la DB del cliente,
 * el insert empieza a funcionar; si la tabla no existe aún (proyecto
 * legacy), el catch lo absorbe sin fallar.
 */
export function registrarUso(reg: RegistroMetering): void {
  void (async () => {
    try {
      const { error } = await db()
        .from("metering_uso")
        .insert({
          cuenta_id: reg.cuenta_id,
          proveedor: reg.proveedor,
          modelo: reg.modelo ?? null,
          tokens_in: reg.tokens_in ?? 0,
          tokens_out: reg.tokens_out ?? 0,
          caracteres: reg.caracteres ?? 0,
          segundos: reg.segundos ?? 0,
          costo_usd: reg.costo_usd ?? 0,
          costo_creditos: reg.costo_creditos ?? 0,
          metadata: reg.metadata ?? {},
        });
      if (error) {
        // Si la tabla no existe (migración no aplicada), no spam.
        if (error.code !== "42P01") {
          console.warn("[metering] insert falló:", error.message);
        }
      }
    } catch (err) {
      console.warn("[metering] excepción no fatal:", err);
    }
  })();
}

export async function listarUsoMes(
  cuentaId: string,
  desde: string,
): Promise<{ proveedor: string; costo_usd: number; eventos: number }[]> {
  const { data, error } = await db()
    .from("metering_uso")
    .select("proveedor, costo_usd")
    .eq("cuenta_id", cuentaId)
    .gte("creado_en", desde);
  if (error) lanzar(error, "listarUsoMes");

  const acc = new Map<string, { costo_usd: number; eventos: number }>();
  for (const fila of (data ?? []) as { proveedor: string; costo_usd: number }[]) {
    const cur = acc.get(fila.proveedor) ?? { costo_usd: 0, eventos: 0 };
    cur.costo_usd += Number(fila.costo_usd ?? 0);
    cur.eventos += 1;
    acc.set(fila.proveedor, cur);
  }
  return Array.from(acc.entries()).map(([proveedor, v]) => ({ proveedor, ...v }));
}

/**
 * (ADMIN) Suma global de costo IA en una ventana, agrupada por proveedor.
 * Si la tabla aún no existe en este proyecto (migración no aplicada),
 * devuelve [] silenciosamente para no romper el dashboard.
 */
export async function listarUsoMesGlobal(
  desde: string,
): Promise<{ proveedor: string; costo_usd: number; eventos: number }[]> {
  const { data, error } = await db()
    .from("metering_uso")
    .select("proveedor, costo_usd")
    .gte("creado_en", desde);
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return [];
    lanzar(error, "listarUsoMesGlobal");
  }
  const acc = new Map<string, { costo_usd: number; eventos: number }>();
  for (const fila of (data ?? []) as { proveedor: string; costo_usd: number }[]) {
    const cur = acc.get(fila.proveedor) ?? { costo_usd: 0, eventos: 0 };
    cur.costo_usd += Number(fila.costo_usd ?? 0);
    cur.eventos += 1;
    acc.set(fila.proveedor, cur);
  }
  return Array.from(acc.entries()).map(([proveedor, v]) => ({ proveedor, ...v }));
}

/**
 * (ADMIN) Suma de costo IA total en una ventana de tiempo.
 */
export async function sumaCostoIaGlobal(desde: string): Promise<number> {
  const lista = await listarUsoMesGlobal(desde);
  return lista.reduce((acc, l) => acc + l.costo_usd, 0);
}
