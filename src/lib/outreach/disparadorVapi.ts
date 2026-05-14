/**
 * Módulo de cold calling para el pipeline de outreach.
 * Equivalente al integrations/vapi.js del video.
 *
 * Toma un lead de leads_extraidos, construye el primer mensaje
 * personalizado con el nombre del negocio, verifica TEST_MODE,
 * dispara la llamada Vapi y guarda el resultado en outreach_call_logs.
 *
 * TEST_MODE=true  → todas las llamadas van a OUTREACH_TEST_PHONE
 * TEST_MODE=false → llamada al número real del lead (producción)
 */

import { iniciarLlamada } from "../vapi";
import { resolverCredencialesVapi } from "../vapi-credenciales";
import { obtenerAssistantDefault } from "../baseDatos";
import {
  actualizarEstadoProspeccion,
  type LeadExtraido,
} from "../db/leadsExtraidos";
import {
  insertarRegistroLlamada,
} from "../db/outreachLogs";
import type { Cuenta } from "../baseDatos";

// ============================================================
// Configuración de TEST_MODE (igual que en el video)
// ============================================================

/** Cuando es true, TODAS las llamadas van al número de prueba. */
const MODO_PRUEBA = process.env.OUTREACH_TEST_MODE === "true";
const TELEFONO_PRUEBA = process.env.OUTREACH_TEST_PHONE?.trim() ?? null;

// ============================================================
// Construcción del primer mensaje (dynamic variable injection)
// ============================================================

/**
 * Construye la frase de apertura que el agente dice al contestar.
 * Inyecta el nombre del negocio para que suene personalizado, no genérico.
 * Basado en knowledge/call-script.md — sección Apertura.
 */
function construirPrimerMensaje(nombreNegocio: string): string {
  return (
    `Hola, ¿hablo con ${nombreNegocio}? Genial — ` +
    `¿los agarré en buen momento? ` +
    `Les llamo porque vi que están activos en su zona ` +
    `y quería hacerles una consulta rápida.`
  );
}

/**
 * Contexto adicional inyectado al system prompt del assistant SOLO para
 * esta llamada. Incluye datos del lead para que el agente pueda responder
 * preguntas de seguimiento sin sonar genérico.
 * Basado en knowledge/company-info.md y knowledge/call-script.md.
 */
function construirContextoLlamada(lead: LeadExtraido, cuenta: Cuenta): string {
  const partes: string[] = [];
  partes.push(`CONTEXTO DE ESTA LLAMADA DE PROSPECCIÓN EN FRÍO:`);
  partes.push(`- Negocio que estás llamando: ${lead.nombre}`);
  if (lead.categoria) partes.push(`- Categoría / industria: ${lead.categoria}`);
  if (lead.direccion) partes.push(`- Dirección: ${lead.direccion}`);
  if (lead.sitio_web) partes.push(`- Sitio web: ${lead.sitio_web}`);
  partes.push(`- Empresa que representás: ${cuenta.etiqueta}`);
  partes.push(``);
  partes.push(`OBJETIVO DE LA LLAMADA:`);
  partes.push(`Agendar una llamada de descubrimiento de 15 minutos O conseguir el email del decisor.`);
  partes.push(`NO cotices precios. NO insistas más de 2 veces si dicen que no.`);
  partes.push(`Seguí el script y el manejo de objeciones que tenés configurado.`);
  return partes.join("\n");
}

// ============================================================
// Validación
// ============================================================

function validar(
  lead: LeadExtraido,
  apiKey: string | null,
  phoneNumberId: string | null,
  assistantId: string | null,
): string | null {
  if (!apiKey) return "Falta VAPI_API_KEY (ni en la cuenta ni en el env).";
  if (!phoneNumberId) return "Falta VAPI_PHONE_NUMBER_ID (ni en la cuenta ni en el env).";
  if (!assistantId) return "No hay assistant Vapi configurado para outreach. Seteá OUTREACH_ASSISTANT_ID o creá un assistant en Configuración.";
  if (!lead.telefono && MODO_PRUEBA === false) return "El lead no tiene número de teléfono.";
  if (MODO_PRUEBA && !TELEFONO_PRUEBA) return "OUTREACH_TEST_MODE=true pero OUTREACH_TEST_PHONE no está configurado.";
  return null;
}

// ============================================================
// Función principal
// ============================================================

export interface ResultadoLlamadaOutreach {
  ok: boolean;
  vapiCallId?: string;
  logId?: string;
  error?: string;
}

export async function dispararLlamadaOutreach(
  lead: LeadExtraido,
  cuenta: Cuenta,
): Promise<ResultadoLlamadaOutreach> {
  // Resolver credenciales (cuenta tiene prioridad sobre env)
  const cred = resolverCredencialesVapi(cuenta);

  // Resolver assistant: OUTREACH_ASSISTANT_ID > default de la cuenta
  let assistantId = process.env.OUTREACH_ASSISTANT_ID?.trim() || null;
  if (!assistantId) {
    const defAss = await obtenerAssistantDefault(cuenta.id);
    assistantId = defAss?.vapi_assistant_id?.trim() || cuenta.vapi_assistant_id?.trim() || null;
  }

  // Validar todo antes de hacer el fetch
  const errorValidacion = validar(lead, cred.apiKey, cred.phoneNumberId, assistantId);
  if (errorValidacion) {
    console.warn(`[outreach:vapi] ✗ validación fallida — ${errorValidacion}`);
    return { ok: false, error: errorValidacion };
  }

  // Decidir número destino según TEST_MODE
  const telefonoDestino = MODO_PRUEBA
    ? TELEFONO_PRUEBA!
    : `+${lead.telefono!.replace(/[^\d]/g, "")}`;

  // Log claro en consola (igual que el video lo pide)
  console.log(
    `[outreach:vapi] 📞 Disparando llamada`,
    `\n  Negocio  : ${lead.nombre}`,
    `\n  Número   : ${telefonoDestino}`,
    `\n  TEST MODE: ${MODO_PRUEBA ? "✓ ACTIVO — llamando a número de prueba" : "✗ inactivo — llamada real"}`,
    `\n  Assistant: ${assistantId}`,
  );

  try {
    // Marcar en cola antes de llamar para evitar duplicados si el proceso muere
    await actualizarEstadoProspeccion(lead.id, "en_cola", "llamada");

    const respuesta = await iniciarLlamada(cred.apiKey!, {
      assistantId: assistantId!,
      phoneNumberId: cred.phoneNumberId!,
      numeroCliente: telefonoDestino,
      nombreCliente: lead.nombre,
      metadata: {
        tipo: "outreach",          // el webhook usa esto para diferenciarlo
        lead_id: lead.id,
        cuenta_id: cuenta.id,
      },
      primerMensajeOverride: construirPrimerMensaje(lead.nombre),
      contextoAdicional: construirContextoLlamada(lead, cuenta),
    });

    if (!respuesta.id) {
      await actualizarEstadoProspeccion(lead.id, "fallido");
      return { ok: false, error: "Vapi no devolvió call_id." };
    }

    // Guardar en outreach_call_logs
    const logId = await insertarRegistroLlamada({
      cuenta_id: cuenta.id,
      lead_id: lead.id,
      vapi_call_id: respuesta.id,
    });

    // Estado → llamado (el webhook lo pondrá en completado con el resultado)
    await actualizarEstadoProspeccion(lead.id, "llamado");

    console.log(
      `[outreach:vapi] ✓ Llamada iniciada — vapi_call_id: ${respuesta.id}`,
    );

    return { ok: true, vapiCallId: respuesta.id, logId };
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    console.error(`[outreach:vapi] ✗ Error al disparar llamada:`, detalle);
    await actualizarEstadoProspeccion(lead.id, "fallido").catch(() => null);
    return { ok: false, error: detalle.slice(0, 400) };
  }
}
