/**
 * Catálogo de planes de suscripción. El Plan ID de PayPal se crea
 * una vez vía /api/billing/setup-plan (admin-only) y se guarda en
 * .env como PAYPAL_PLAN_PRO_ID. Cuando lo cambies (ej: subís precio),
 * creás un Plan nuevo, no editás el viejo.
 */

export interface DefinicionPlan {
  id: "pro" | "business";
  nombre: string;
  precioMensualUsd: number;
  creditosIncluidos: number;
  envEnvVarPlanId: string;
  features: string[];
}

export const PLANES: Record<"pro" | "business", DefinicionPlan> = {
  pro: {
    id: "pro",
    nombre: "Pro",
    precioMensualUsd: 29,
    creditosIncluidos: 1000,
    envEnvVarPlanId: "PAYPAL_PLAN_PRO_ID",
    features: [
      "WhatsApp ilimitados",
      "Conversaciones ilimitadas",
      "Voz clonada + Vapi",
      "Multi-modelo (GPT-4o · Claude)",
      "1.000 créditos/mes incluidos",
      "Soporte prioritario",
    ],
  },
  business: {
    id: "business",
    nombre: "Business",
    precioMensualUsd: 199,
    creditosIncluidos: 10000,
    envEnvVarPlanId: "PAYPAL_PLAN_BUSINESS_ID",
    features: [
      "Todo lo de Pro",
      "Dominio propio + branding",
      "Multi-usuario por tenant",
      "API completa",
      "10.000 créditos/mes",
      "Onboarding dedicado",
      "SLA 99.9%",
    ],
  },
};

export function planIdPayPal(plan: "pro" | "business"): string | null {
  return process.env[PLANES[plan].envEnvVarPlanId] ?? null;
}
