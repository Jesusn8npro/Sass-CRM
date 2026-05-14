/**
 * Módulo de cold email para el pipeline de outreach.
 * Equivalente al integrations/resend.js del video.
 *
 * Secuencia de 3 emails en texto plano (mejor deliverability que HTML):
 *  - Paso 1: envío inmediato
 *  - Paso 2: programado para +3 días (lo despacha el orquestador)
 *  - Paso 3: programado para +7 días (lo despacha el orquestador)
 *
 * TEST_MODE=true  → todos los emails van a OUTREACH_TEST_EMAIL
 * TEST_MODE=false → email al lead real (producción)
 *
 * Por qué texto plano: HTML con logos y botones cae en Promociones o Spam.
 * Un texto plano se lee como email directo de una persona real.
 * Basado en knowledge/email-template.md
 */

import { enviarEmail } from "../emails/cliente";
import {
  actualizarEstadoProspeccion,
  type LeadExtraido,
} from "../db/leadsExtraidos";
import {
  existeEmailProspeccionPaso,
  insertarRegistroEmail,
  marcarEmailProspeccionEnviado,
  type RegistroEmailProspeccion,
} from "../db/outreachLogs";
import type { Cuenta } from "../baseDatos";

// ============================================================
// Configuración de TEST_MODE (mismo patrón que disparadorVapi.ts)
// ============================================================

const MODO_PRUEBA = process.env.OUTREACH_TEST_MODE === "true";
const EMAIL_PRUEBA = process.env.OUTREACH_TEST_EMAIL?.trim() ?? null;

// ============================================================
// Nombre del agente (configurable por env o default)
// ============================================================

const NOMBRE_AGENTE = process.env.OUTREACH_AGENT_NAME?.trim() || "El equipo";

// ============================================================
// Plantillas de texto plano (3 pasos)
// Basadas en knowledge/email-template.md
// Variables: {{NOMBRE_NEGOCIO}}, {{CATEGORIA}}, {{NOMBRE_AGENTE}}, {{EMPRESA}}
// ============================================================

interface DatosPlantilla {
  nombreNegocio: string;
  categoria: string | null;
  nombreAgente: string;
  empresa: string;
}

function plantillaPaso1(d: DatosPlantilla): { asunto: string; texto: string; html: string } {
  const asunto = `${d.nombreNegocio} — idea rápida`;

  const texto = [
    `Hola,`,
    ``,
    `Vi que ${d.nombreNegocio} está activo${d.categoria ? ` en ${d.categoria}` : ""} en su zona y quería compartirles algo que podría ser útil.`,
    ``,
    `Trabajamos con negocios como el suyo ayudándoles a conseguir clientes nuevos de forma consistente — sin depender solo de referidos o temporadas bajas.`,
    ``,
    `El sistema encuentra prospectos calificados en su zona y los contacta automáticamente, así su equipo solo habla con quien ya mostró interés.`,
    ``,
    `¿Tendría sentido una llamada de 15 minutos para ver si aplica a su situación?`,
    ``,
    `${d.nombreAgente}`,
    `${d.empresa}`,
  ].join("\n");

  // HTML minimal — no banners, no botones, se ve igual que texto plano
  const html = texto
    .split("\n")
    .map((l) => (l === "" ? "<br>" : `<span>${l}</span><br>`))
    .join("");

  return { asunto, texto, html };
}

function plantillaPaso2(d: DatosPlantilla): { asunto: string; texto: string; html: string } {
  const asunto = `Re: ${d.nombreNegocio} — idea rápida`;

  const texto = [
    `Hola de nuevo,`,
    ``,
    `Solo quería hacer un seguimiento por si el email anterior se perdió entre los mensajes.`,
    ``,
    `Si ya están cubriendo bien la generación de nuevos clientes, no hay problema — solo díganme y no les escribo más.`,
    ``,
    `Pero si hay algo de interés, con gusto hablamos 15 minutos esta semana.`,
    ``,
    `${d.nombreAgente}`,
  ].join("\n");

  const html = texto
    .split("\n")
    .map((l) => (l === "" ? "<br>" : `<span>${l}</span><br>`))
    .join("");

  return { asunto, texto, html };
}

function plantillaPaso3(d: DatosPlantilla): { asunto: string; texto: string; html: string } {
  const asunto = `Último mensaje — ${d.nombreNegocio}`;

  const texto = [
    `Hola,`,
    ``,
    `Este es mi último mensaje para no ocuparles más el espacio.`,
    ``,
    `Si en algún momento quieren explorar cómo conseguir más clientes sin ampliar el equipo de ventas, aquí estaré.`,
    ``,
    `Que les vaya muy bien.`,
    ``,
    `${d.nombreAgente}`,
    `${d.empresa}`,
  ].join("\n");

  const html = texto
    .split("\n")
    .map((l) => (l === "" ? "<br>" : `<span>${l}</span><br>`))
    .join("");

  return { asunto, texto, html };
}

const PLANTILLAS = {
  1: plantillaPaso1,
  2: plantillaPaso2,
  3: plantillaPaso3,
} as const;

// ============================================================
// Función de despacho de un paso individual
// (reutilizada para paso 1 en el momento y para paso 2/3 desde el orquestador)
// ============================================================

export interface ResultadoEmailOutreach {
  ok: boolean;
  resendMessageId?: string;
  error?: string;
}

/**
 * Envía el paso N de la secuencia al lead.
 * Para paso 1: llama desde el orquestador al detectar un lead nuevo con email.
 * Para paso 2 y 3: llama el orquestador cuando llega la fecha programada.
 */
export async function despacharEmailOutreach(
  lead: LeadExtraido,
  cuenta: Cuenta,
  paso: 1 | 2 | 3,
  logId?: string,
): Promise<ResultadoEmailOutreach> {
  const emailDestino = MODO_PRUEBA
    ? EMAIL_PRUEBA
    : lead.email;

  if (!emailDestino) {
    return { ok: false, error: MODO_PRUEBA
      ? "OUTREACH_TEST_MODE=true pero OUTREACH_TEST_EMAIL no configurado."
      : "El lead no tiene email." };
  }

  const datos: DatosPlantilla = {
    nombreNegocio: lead.nombre,
    categoria: lead.categoria,
    nombreAgente: NOMBRE_AGENTE,
    empresa: cuenta.etiqueta,
  };

  const { asunto, texto, html } = PLANTILLAS[paso](datos);

  console.log(
    `[outreach:email] ✉ Enviando email paso ${paso}`,
    `\n  Negocio  : ${lead.nombre}`,
    `\n  Email    : ${emailDestino}`,
    `\n  TEST MODE: ${MODO_PRUEBA ? "✓ ACTIVO — enviando a email de prueba" : "✗ inactivo — email real"}`,
  );

  const resultado = await enviarEmail({
    to: emailDestino,
    subject: asunto,
    html,
    text: texto,
    idempotencyKey: `outreach:email:${lead.id}:paso${paso}`,
  });

  if (!resultado.ok) {
    console.warn(`[outreach:email] ✗ Resend error paso ${paso}:`, resultado.motivo);
    return { ok: false, error: resultado.motivo };
  }

  console.log(`[outreach:email] ✓ Email paso ${paso} enviado — id: ${resultado.id}`);

  // Si nos pasaron un logId (paso 2 o 3 ya agendados), lo actualizamos
  if (logId) {
    await marcarEmailProspeccionEnviado(logId, resultado.id).catch(() => null);
  }

  return { ok: true, resendMessageId: resultado.id };
}

// ============================================================
// Función principal: inicia la secuencia completa desde paso 1
// ============================================================

/**
 * Dispara el email paso 1 inmediatamente y agenda pasos 2 y 3.
 * Llamar cuando el orquestador detecta un lead nuevo con email y sin teléfono.
 */
export async function iniciarSecuenciaEmailOutreach(
  lead: LeadExtraido,
  cuenta: Cuenta,
): Promise<ResultadoEmailOutreach> {
  // Idempotencia: no duplicar si ya se inició la secuencia
  if (await existeEmailProspeccionPaso(lead.id, 1)) {
    return { ok: false, error: "La secuencia de email ya fue iniciada para este lead." };
  }

  // Enviar paso 1 ahora
  const r = await despacharEmailOutreach(lead, cuenta, 1);
  if (!r.ok) {
    await actualizarEstadoProspeccion(lead.id, "fallido").catch(() => null);
    return r;
  }

  // Registrar paso 1
  await insertarRegistroEmail({
    cuenta_id: cuenta.id,
    lead_id: lead.id,
    resend_message_id: r.resendMessageId,
    paso: 1,
    estado_envio: "enviado",
    enviado_en: new Date().toISOString(),
  }).catch(() => null);

  // Agendar paso 2 (+3 días) y paso 3 (+7 días) como 'pendiente'
  const ahora = Date.now();
  const dia3 = new Date(ahora + 3 * 24 * 60 * 60 * 1000).toISOString();
  const dia7 = new Date(ahora + 7 * 24 * 60 * 60 * 1000).toISOString();

  await Promise.all([
    insertarRegistroEmail({
      cuenta_id: cuenta.id,
      lead_id: lead.id,
      paso: 2,
      estado_envio: "pendiente",
      programado_para: dia3,
    }).catch(() => null),
    insertarRegistroEmail({
      cuenta_id: cuenta.id,
      lead_id: lead.id,
      paso: 3,
      estado_envio: "pendiente",
      programado_para: dia7,
    }).catch(() => null),
  ]);

  // Marcar lead como emaileado
  await actualizarEstadoProspeccion(lead.id, "emaileado", "email").catch(() => null);

  return r;
}

// ============================================================
// Procesar follow-ups pendientes (llamado por el orquestador)
// ============================================================

/**
 * Busca emails pendientes (paso 2 y 3 cuya fecha ya llegó) y los envía.
 * El orquestador llama esto cada 5 minutos.
 */
export async function procesarFollowUpsEmailOutreach(
  cuentaId?: string,
): Promise<void> {
  const { obtenerEmailsOutreachPendientes } = await import("../db/outreachLogs");
  const { obtenerLead } = await import("../db/leadsExtraidos");
  const { obtenerCuenta } = await import("../baseDatos");

  const pendientes = await obtenerEmailsOutreachPendientes(cuentaId);
  if (pendientes.length === 0) return;

  console.log(`[outreach:email] Procesando ${pendientes.length} follow-up(s) pendiente(s)`);

  for (const log of pendientes) {
    try {
      const [lead, cuenta] = await Promise.all([
        obtenerLead(log.lead_id),
        obtenerCuenta(log.cuenta_id),
      ]);
      if (!lead || !cuenta) continue;

      await despacharEmailOutreach(
        lead as LeadExtraido,
        cuenta,
        log.paso as 1 | 2 | 3,
        log.id,
      );
    } catch (err) {
      console.error(`[outreach:email] Error en follow-up ${log.id}:`, err);
    }
  }
}
