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
import { obtenerAssistantDefault, obtenerOCrearConversacion } from "../baseDatos";
import {
  actualizarEstadoProspeccion,
  marcarLeadImportado,
  type LeadExtraido,
} from "../db/leadsExtraidos";
import {
  insertarRegistroLlamada,
} from "../db/outreachLogs";
import { listarUsoMes } from "../db/meteringUso";
import type { Cuenta } from "../baseDatos";

// ============================================================
// Configuración de TEST_MODE (igual que en el video)
// ============================================================

/** Cuando es true, TODAS las llamadas van al número de prueba. */
const MODO_PRUEBA = process.env.OUTREACH_TEST_MODE === "true";
const TELEFONO_PRUEBA = process.env.OUTREACH_TEST_PHONE?.trim() ?? null;

// ============================================================
// Schema de extracción de datos post-llamada (análisis Vapi)
// ============================================================

const SCHEMA_DATOS_OUTREACH = {
  type: "object",
  properties: {
    nombre_contacto: { type: "string", description: "Nombre de quien atendió la llamada" },
    nivel_interes: {
      type: "string",
      enum: ["alto", "medio", "bajo", "sin_interes"],
      description: "Nivel de interés detectado durante la conversación",
    },
    reunion_agendada: { type: "boolean", description: "true si se logró agendar una reunión o demo" },
    fecha_reunion: { type: "string", description: "Fecha y hora ISO de la reunión agendada (si aplica)" },
    objecion_principal: { type: "string", description: "Principal objeción expresada por el prospecto" },
    proximo_paso: { type: "string", description: "Siguiente acción acordada" },
    notas: { type: "string", description: "Observaciones adicionales relevantes" },
  },
};

const PROMPT_DATOS_OUTREACH =
  "Al finalizar la llamada de prospección, extrae los campos pedidos. Si un campo no fue mencionado, omítelo — no inventes datos. Para nivel_interes: si pidió info o quiere reunión = 'alto'; si escuchó sin comprometerse = 'medio'; si rechazó levemente = 'bajo'; si rechazó claramente = 'sin_interes'.";

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
  apiKey: string | null,
  phoneNumberId: string | null,
  assistantId: string | null,
): string | null {
  if (!apiKey) return "Falta VAPI_API_KEY (ni en la cuenta ni en el env).";
  if (!phoneNumberId) return "Falta VAPI_PHONE_NUMBER_ID (ni en la cuenta ni en el env).";
  if (!assistantId) return "No hay assistant Vapi configurado para outreach. Seteá OUTREACH_ASSISTANT_ID o creá un assistant en Configuración.";
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
  overrides?: { telefonoPrueba?: string },
): Promise<ResultadoLlamadaOutreach> {
  // Resolver credenciales (cuenta tiene prioridad sobre env)
  const cred = resolverCredencialesVapi(cuenta);

  // Resolver assistant: OUTREACH_ASSISTANT_ID > default de la cuenta
  let assistantId = process.env.OUTREACH_ASSISTANT_ID?.trim() || null;
  if (!assistantId) {
    const defAss = await obtenerAssistantDefault(cuenta.id);
    assistantId = defAss?.vapi_assistant_id?.trim() || cuenta.vapi_assistant_id?.trim() || null;
  }

  // Si se pasa un teléfono de prueba explícito, tiene prioridad sobre el ENV
  const telefonoPruebaEfectivo = overrides?.telefonoPrueba ?? (MODO_PRUEBA ? TELEFONO_PRUEBA : null);
  const esModoPrueba = !!telefonoPruebaEfectivo;

  // Verificar límite mensual de gasto en Vapi
  const limiteVapi = cuenta.limites_gasto?.vapi ?? 0;
  if (limiteVapi > 0) {
    const inicioDeMes = new Date();
    inicioDeMes.setDate(1);
    inicioDeMes.setHours(0, 0, 0, 0);
    const usoMes = await listarUsoMes(cuenta.id, inicioDeMes.toISOString());
    const gastoVapi = usoMes.find((u) => u.proveedor === "vapi")?.costo_usd ?? 0;
    if (gastoVapi >= limiteVapi) {
      console.warn(`[outreach:vapi] ✗ Límite mensual Vapi alcanzado — gasto: $${gastoVapi.toFixed(2)} / límite: $${limiteVapi.toFixed(2)}`);
      return { ok: false, error: `Límite mensual de Vapi alcanzado ($${gastoVapi.toFixed(2)} / $${limiteVapi.toFixed(2)}). Ajustá el límite en Créditos.` };
    }
  }

  // Validar todo antes de hacer el fetch
  const errorValidacion = validar(cred.apiKey, cred.phoneNumberId, assistantId);
  if (errorValidacion) {
    console.warn(`[outreach:vapi] ✗ validación fallida — ${errorValidacion}`);
    return { ok: false, error: errorValidacion };
  }
  if (esModoPrueba && !telefonoPruebaEfectivo) {
    return { ok: false, error: "Modo prueba activo pero no hay teléfono de prueba configurado." };
  }
  if (!esModoPrueba && !lead.telefono) {
    return { ok: false, error: "El lead no tiene número de teléfono." };
  }

  // Decidir número destino
  const telefonoDestino = esModoPrueba
    ? telefonoPruebaEfectivo!
    : `+${lead.telefono!.replace(/[^\d]/g, "")}`;

  // Log claro en consola (igual que el video lo pide)
  console.log(
    `[outreach:vapi] 📞 Disparando llamada`,
    `\n  Negocio  : ${lead.nombre}`,
    `\n  Número   : ${telefonoDestino}`,
    `\n  TEST MODE: ${esModoPrueba ? "✓ ACTIVO — llamando a número de prueba" : "✗ inactivo — llamada real"}`,
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
        tipo: "outreach",
        lead_id: lead.id,
        cuenta_id: cuenta.id,
      },
      primerMensajeOverride: construirPrimerMensaje(lead.nombre),
      contextoAdicional: construirContextoLlamada(lead, cuenta),
      analysisPlan: {
        structuredDataSchema: SCHEMA_DATOS_OUTREACH,
        structuredDataPrompt: PROMPT_DATOS_OUTREACH,
      },
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

    // Pre-importar al CRM inmediatamente: el cliente aparece en la página
    // de Clientes con teléfono y nombre del negocio desde el primer momento,
    // sin esperar a que la llamada termine.
    if (!lead.importado || !lead.conversacion_id) {
      try {
        const telefonoReal = lead.telefono ?? `lead_${lead.id.slice(0, 8)}`;
        const conv = await obtenerOCrearConversacion(
          cuenta.id,
          telefonoReal,
          lead.nombre,
          null,
        );
        await marcarLeadImportado(lead.id, conv.id);
        console.log(
          `[outreach:vapi] ✓ Lead pre-importado al CRM — conv: ${conv.id}`,
        );
      } catch (err) {
        // No-fatal: el webhook reintentará la importación al terminar la llamada
        console.warn("[outreach:vapi] No se pudo pre-importar al CRM:", err);
      }
    }

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
