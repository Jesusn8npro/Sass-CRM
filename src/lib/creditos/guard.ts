/**
 * Helper para route handlers que consumen créditos. Patrón:
 *
 *   const guard = await requerirCreditos(idCuenta, "imagen_nano_banana");
 *   if (guard instanceof NextResponse) return guard;
 *   // si llegamos acá, ya descontamos los créditos atómicamente.
 *   try {
 *     const out = await llamarApiPaga();
 *     return NextResponse.json({ ok: true, out });
 *   } catch (err) {
 *     await guard.refund();    // reintegrar si la API falló
 *     throw err;
 *   }
 */
import { NextResponse } from "next/server";
import { agregarCreditos, descontarCreditos } from "../db/creditos";
import {
  obtenerPrecio,
  type TipoConsumoCreditos,
} from "./precios";

export interface GuardCreditos {
  /** Cantidad de créditos efectivamente descontada. */
  creditos: number;
  /** Costo USD aproximado para tu margen tracking. */
  costoUsd: number;
  /** Reintegra los créditos si la API que ibas a llamar falló. */
  refund: () => Promise<void>;
  /** Re-loggea con metadata enriquecida tras éxito (opcional). */
  loggearMetadata: (meta: Record<string, unknown>) => Promise<void>;
}

export async function requerirCreditos(
  cuentaId: string,
  tipo: TipoConsumoCreditos,
  opciones?: { metadataInicial?: Record<string, unknown> },
): Promise<GuardCreditos | NextResponse> {
  const precio = obtenerPrecio(tipo);
  const ok = await descontarCreditos(cuentaId, tipo, precio.creditos, {
    costoUsd: precio.costo_usd_aprox,
    metadata: opciones?.metadataInicial ?? {},
  });
  if (!ok) {
    return NextResponse.json(
      {
        error: "creditos_insuficientes",
        mensaje: `Te quedaste sin créditos. Recargá desde la página de Créditos.`,
        requeridos: precio.creditos,
      },
      { status: 402 },
    );
  }
  return {
    creditos: precio.creditos,
    costoUsd: precio.costo_usd_aprox,
    refund: async () => {
      await agregarCreditos(cuentaId, precio.creditos);
    },
    // Para enriquecer el log post-éxito (ej: prompt usado, output url).
    // Implementación simple: no actualizamos la fila ya escrita por
    // descontarCreditos — agregamos otra "movimiento 0" si hace falta.
    loggearMetadata: async () => {
      /* opcional, no-op por ahora — DB ya tiene el descuento */
    },
  };
}
