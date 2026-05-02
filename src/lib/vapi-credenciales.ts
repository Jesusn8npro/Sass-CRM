/**
 * Resolución de credenciales Vapi con fallback al .env del sistema.
 *
 * Modelo: el dueño del SaaS (vos) ponés tu Vapi API key + Public key
 * + Phone number ID en `.env.local` (`VAPI_API_KEY`, `VAPI_PUBLIC_KEY`,
 * `VAPI_PHONE_NUMBER_ID`). Por default, todas las cuentas de tus
 * clientes usan esas — sus assistants se crean en TU cuenta de Vapi y
 * el costo de las llamadas va a TU billing.
 *
 * Si una cuenta específica setea sus propios `vapi_api_key`, etc, en
 * el panel de configuración, esos override los del env (caso edge:
 * un cliente que quiere usar su propia cuenta Vapi).
 */

import type { Cuenta } from "./baseDatos";

export interface CredencialesVapi {
  apiKey: string | null;
  publicKey: string | null;
  phoneNumberId: string | null;
  /** "cuenta" si vienen del row, "env" si vienen del proceso. Útil
   *  para mostrar en UI ("Usando API key del sistema"). */
  origenApiKey: "cuenta" | "env" | "ninguno";
  origenPublicKey: "cuenta" | "env" | "ninguno";
  origenPhoneId: "cuenta" | "env" | "ninguno";
}

export function resolverCredencialesVapi(cuenta: Cuenta): CredencialesVapi {
  const envApi = process.env.VAPI_API_KEY?.trim() || null;
  const envPub = process.env.VAPI_PUBLIC_KEY?.trim() || null;
  const envPhone = process.env.VAPI_PHONE_NUMBER_ID?.trim() || null;

  const cuentaApi = cuenta.vapi_api_key?.trim() || null;
  const cuentaPub = cuenta.vapi_public_key?.trim() || null;
  const cuentaPhone = cuenta.vapi_phone_id?.trim() || null;

  return {
    apiKey: cuentaApi ?? envApi,
    publicKey: cuentaPub ?? envPub,
    phoneNumberId: cuentaPhone ?? envPhone,
    origenApiKey: cuentaApi ? "cuenta" : envApi ? "env" : "ninguno",
    origenPublicKey: cuentaPub ? "cuenta" : envPub ? "env" : "ninguno",
    origenPhoneId: cuentaPhone ? "cuenta" : envPhone ? "env" : "ninguno",
  };
}

/**
 * Para serializar al cliente: NUNCA incluye apiKey (es secret).
 * Sí incluye publicKey (es safe-to-expose por diseño de Vapi).
 */
export function credencialesParaCliente(cuenta: Cuenta): {
  publicKey: string | null;
  phoneNumberId: string | null;
  configurado: boolean;
  origenes: {
    api_key: "cuenta" | "env" | "ninguno";
    public_key: "cuenta" | "env" | "ninguno";
    phone_id: "cuenta" | "env" | "ninguno";
  };
} {
  const c = resolverCredencialesVapi(cuenta);
  return {
    publicKey: c.publicKey,
    phoneNumberId: c.phoneNumberId,
    configurado: !!(c.apiKey && c.phoneNumberId),
    origenes: {
      api_key: c.origenApiKey,
      public_key: c.origenPublicKey,
      phone_id: c.origenPhoneId,
    },
  };
}
