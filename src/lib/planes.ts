/**
 * Definición central de planes y límites del SaaS.
 *
 * Cada plan tiene cuotas que se aplican en endpoints (ej: límite de
 * cuentas WhatsApp por usuario). Los límites se enforcen del lado
 * servidor — el front solo los muestra para UX.
 *
 * Para cambiar precios: editá UNA vez acá y se reflejan en /precios,
 * Mi Cuenta y banners.
 */

export type IdPlan = "free" | "pro" | "business";

export interface DefinicionPlan {
  id: IdPlan;
  nombre: string;
  precio_usd_mes: number | null; // null = "a medida"
  /** Límite duro de cuentas WhatsApp por usuario. Infinity = sin límite. */
  limite_cuentas: number;
  /** Límite suave informativo de mensajes/mes (no enforced todavía). */
  limite_mensajes_mes: number;
  /** Si false, el plan oculta features premium en la UI. */
  permite_voz_clonada: boolean;
  permite_llamadas_vapi: boolean;
  permite_multi_modelo: boolean;
  /** Texto corto de pitch — para mostrar en /precios y /mi-cuenta. */
  resumen: string;
  /** Bullets de beneficios para la card de precios. */
  beneficios: string[];
}

export const PLANES: Record<IdPlan, DefinicionPlan> = {
  free: {
    id: "free",
    nombre: "Gratis",
    precio_usd_mes: 0,
    limite_cuentas: 1,
    limite_mensajes_mes: 100,
    permite_voz_clonada: false,
    permite_llamadas_vapi: false,
    permite_multi_modelo: false,
    resumen: "Para probar el sistema con un número de WhatsApp.",
    beneficios: [
      "1 cuenta de WhatsApp",
      "Hasta 100 conversaciones/mes",
      "IA con GPT-4o-mini",
      "Pipeline + productos + agenda",
      "Soporte por chat",
    ],
  },
  pro: {
    id: "pro",
    nombre: "Pro",
    precio_usd_mes: 29,
    limite_cuentas: 10,
    limite_mensajes_mes: 100_000,
    permite_voz_clonada: true,
    permite_llamadas_vapi: true,
    permite_multi_modelo: true,
    resumen: "Para emprendedores que ya venden por WhatsApp.",
    beneficios: [
      "Hasta 10 cuentas de WhatsApp",
      "Conversaciones ilimitadas",
      "Voz clonada + llamadas Vapi",
      "Multi-modelo (GPT-4o, Claude)",
      "Soporte prioritario",
    ],
  },
  business: {
    id: "business",
    nombre: "Business",
    precio_usd_mes: null,
    limite_cuentas: Number.POSITIVE_INFINITY,
    limite_mensajes_mes: Number.POSITIVE_INFINITY,
    permite_voz_clonada: true,
    permite_llamadas_vapi: true,
    permite_multi_modelo: true,
    resumen: "Agencias y SaaS que revenden el producto a sus clientes.",
    beneficios: [
      "Cuentas y mensajes sin límite",
      "Dominio propio + branding",
      "API completa",
      "Multi-usuario por tenant",
      "Onboarding dedicado",
      "SLA 99.9%",
    ],
  },
};

/** Valor seguro para mostrar en UI cuando el límite es infinito. */
export function formatearLimite(n: number): string {
  if (!Number.isFinite(n)) return "Ilimitado";
  return n.toLocaleString("es-AR");
}

/** Convierte un string arbitrario al IdPlan, default "free". */
export function normalizarPlan(valor: string | null | undefined): IdPlan {
  if (valor === "pro" || valor === "business") return valor;
  return "free";
}

export function obtenerPlan(idOTexto: string | null | undefined): DefinicionPlan {
  return PLANES[normalizarPlan(idOTexto)];
}
