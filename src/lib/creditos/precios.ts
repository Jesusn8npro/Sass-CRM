/**
 * Tabla central de precios por acción que consume créditos.
 *
 * Regla: 1 crédito = $0.10 USD valor cliente. El costo real (lo que
 * pagás vos al proveedor) está en `costo_usd` y se loggea en
 * uso_creditos.costo_usd para tu análisis de margen.
 *
 * Cuando agregues una acción nueva (ej: nuevo actor de Apify), agregala
 * acá ANTES de cablearla en el endpoint. El tipo `TipoConsumo` se
 * deriva de las llaves, así que TypeScript te obliga a usar valores
 * existentes.
 */

export const PRECIOS_CREDITOS = {
  // ==========================================================
  // Apify — lead gen
  // ==========================================================
  /** 1 lead de Google Maps con email y teléfono. Apify ≈ $0.01 c/u. */
  apify_lead: { creditos: 1, costo_usd_aprox: 0.01 },

  // ==========================================================
  // Generación de imágenes
  // ==========================================================
  /** 1 imagen Nano Banana (Gemini 2.5 Flash Image). Google ≈ $0.039. */
  imagen_nano_banana: { creditos: 1, costo_usd_aprox: 0.039 },

  /** Failover: 1 imagen Flux Kontext via fal.ai. fal ≈ $0.025. */
  imagen_flux_kontext: { creditos: 1, costo_usd_aprox: 0.025 },
} as const;

export type TipoConsumoCreditos = keyof typeof PRECIOS_CREDITOS;

export interface PrecioCreditos {
  creditos: number;
  costo_usd_aprox: number;
}

export function obtenerPrecio(tipo: TipoConsumoCreditos): PrecioCreditos {
  return PRECIOS_CREDITOS[tipo];
}

/**
 * Etiqueta legible para mostrar en la UI del historial de uso.
 * Si el `tipo` viene de la DB y no coincide con ninguna llave actual
 * (porque borraste una acción del catálogo), devuelve el tipo crudo.
 */
const ETIQUETAS: Record<string, string> = {
  apify_lead: "Lead extraído",
  imagen_nano_banana: "Imagen generada",
  imagen_flux_kontext: "Imagen generada (Flux)",
};

export function etiquetaTipoConsumo(tipo: string): string {
  return ETIQUETAS[tipo] ?? tipo;
}
