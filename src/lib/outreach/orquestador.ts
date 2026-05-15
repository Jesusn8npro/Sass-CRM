/**
 * Orquestador del pipeline de cold outreach.
 * Equivalente al orchestrator/index.js del video.
 *
 * Se ejecuta cada 5 minutos desde cicloVida.ts.
 * Para cada cuenta:
 *   1. Chequea horario laboral (OUTREACH_HORARIO_DESDE/HASTA, default 08:00-20:00)
 *   2. Toma leads con estado_prospeccion = 'nuevo'
 *   3. Aplica modo: ambos | solo_llamadas | solo_email
 *   4. Rate limit: máx OUTREACH_MAX_LLAMADAS_POR_HORA por cuenta por hora
 *   5. Delay configurable entre llamadas (evita disparar todo simultáneo)
 *   6. Retry: hasta 3 intentos (el intervalo de 5 min actúa como pausa)
 *
 * Multi-tenant: cada cuenta tiene su propio rate limit y su propio assistant.
 */

import { listarCuentas, obtenerCuenta } from "../baseDatos";
import {
  actualizarEstadoProspeccion,
  listarLeadsNuevosParaProspeccion,
  registrarFalloProspeccion,
  type LeadExtraido,
} from "../db/leadsExtraidos";
import { contarLlamadasProspeccionUltimaHora } from "../db/outreachLogs";
import { dispararLlamadaOutreach } from "./disparadorVapi";
import { iniciarSecuenciaEmailOutreach, procesarFollowUpsEmailOutreach } from "./disparadorEmail";
import type { Cuenta } from "../baseDatos";

// ============================================================
// Tipos
// ============================================================

export type ModoContacto = "ambos" | "solo_llamadas" | "solo_email";

// ============================================================
// Configuración
// ============================================================

const MAX_LLAMADAS_POR_HORA = parseInt(
  process.env.OUTREACH_MAX_LLAMADAS_POR_HORA ?? "10",
  10,
);

const LEADS_POR_CORRIDA = 20;

/** Delay en ms entre llamadas consecutivas dentro de la misma corrida */
const DELAY_ENTRE_LLAMADAS_MS = parseInt(
  process.env.OUTREACH_DELAY_LLAMADAS_MS ?? "2000",
  10,
);

const HORARIO_DESDE = process.env.OUTREACH_HORARIO_DESDE ?? "08:00";
const HORARIO_HASTA = process.env.OUTREACH_HORARIO_HASTA ?? "20:00";
const TIMEZONE = process.env.OUTREACH_TIMEZONE ?? "America/Bogota";

// ============================================================
// Helpers
// ============================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Comprueba si la hora actual (en el timezone configurado) está dentro
 * del rango OUTREACH_HORARIO_DESDE – OUTREACH_HORARIO_HASTA.
 * Solo se llama antes de disparar llamadas (emails pueden ir 24/7).
 */
function enHorarioLlamadas(): boolean {
  try {
    const ahora = new Date();
    const formato = new Intl.DateTimeFormat("en-US", {
      timeZone: TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(ahora);
    // formato: "HH:MM" (puede venir "24:00" → la API devuelve "00:00")
    const [hh, mm] = formato.split(":").map(Number) as [number, number];
    const minutosActuales = hh * 60 + mm;

    const [dhh, dmm] = HORARIO_DESDE.split(":").map(Number) as [number, number];
    const [fhh, fmm] = HORARIO_HASTA.split(":").map(Number) as [number, number];
    const minutosDesde = dhh * 60 + dmm;
    const minutosHasta = fhh * 60 + fmm;

    return minutosActuales >= minutosDesde && minutosActuales < minutosHasta;
  } catch {
    return true; // Si falla el check, no bloqueamos
  }
}

// ============================================================
// Procesamiento de un lead individual
// ============================================================

async function procesarLead(
  lead: LeadExtraido,
  cuenta: Cuenta,
  llamadasUsadasEstaHora: number,
  modo: ModoContacto,
): Promise<{ llamadaRealizada: boolean }> {
  const tieneTelefono = !!lead.telefono;
  const tieneEmail = !!lead.email;

  // ── Sin datos de contacto ─────────────────────────────────
  if (!tieneTelefono && !tieneEmail) {
    console.log(`[outreach] ⚠ Lead sin contacto: ${lead.nombre} — marcando no_contactable`);
    await actualizarEstadoProspeccion(lead.id, "no_contactable", "ninguno");
    return { llamadaRealizada: false };
  }

  // ── MODO: solo email ──────────────────────────────────────
  if (modo === "solo_email") {
    if (!tieneEmail) {
      console.log(`[outreach] ⚠ Solo-email pero ${lead.nombre} no tiene email — marcando no_contactable`);
      await actualizarEstadoProspeccion(lead.id, "no_contactable", "ninguno");
      return { llamadaRealizada: false };
    }
    const resultado = await iniciarSecuenciaEmailOutreach(lead, cuenta);
    if (!resultado.ok) {
      console.warn(`[outreach] ✗ Email fallido para ${lead.nombre}: ${resultado.error}`);
      await registrarFalloProspeccion(lead.id, lead.intentos_outreach);
    }
    return { llamadaRealizada: false };
  }

  // ── MODO: solo llamadas ───────────────────────────────────
  if (modo === "solo_llamadas") {
    if (!tieneTelefono) {
      console.log(`[outreach] ⚠ Solo-llamadas pero ${lead.nombre} no tiene teléfono — marcando no_contactable`);
      await actualizarEstadoProspeccion(lead.id, "no_contactable", "ninguno");
      return { llamadaRealizada: false };
    }
    if (!enHorarioLlamadas()) {
      console.log(`[outreach] 🕐 Fuera de horario de llamadas — lead ${lead.nombre} se procesa en la próxima corrida`);
      return { llamadaRealizada: false };
    }
    if (llamadasUsadasEstaHora >= MAX_LLAMADAS_POR_HORA) {
      console.log(`[outreach] ⏳ Rate limit para cuenta ${cuenta.id} (${llamadasUsadasEstaHora}/${MAX_LLAMADAS_POR_HORA}/hora)`);
      return { llamadaRealizada: false };
    }
    const resultado = await dispararLlamadaOutreach(lead, cuenta);
    if (!resultado.ok) {
      console.warn(`[outreach] ✗ Llamada fallida para ${lead.nombre}: ${resultado.error}`);
      await registrarFalloProspeccion(lead.id, lead.intentos_outreach);
      return { llamadaRealizada: false };
    }
    return { llamadaRealizada: true };
  }

  // ── MODO: ambos (default) — llamada primero, email como fallback ──
  if (tieneTelefono) {
    if (!enHorarioLlamadas()) {
      console.log(`[outreach] 🕐 Fuera de horario de llamadas — lead ${lead.nombre} se procesa en la próxima corrida`);
      return { llamadaRealizada: false };
    }
    if (llamadasUsadasEstaHora >= MAX_LLAMADAS_POR_HORA) {
      console.log(`[outreach] ⏳ Rate limit para cuenta ${cuenta.id} (${llamadasUsadasEstaHora}/${MAX_LLAMADAS_POR_HORA}/hora)`);
      return { llamadaRealizada: false };
    }
    const resultado = await dispararLlamadaOutreach(lead, cuenta);
    if (!resultado.ok) {
      console.warn(`[outreach] ✗ Llamada fallida para ${lead.nombre}: ${resultado.error}`);
      await registrarFalloProspeccion(lead.id, lead.intentos_outreach);
      return { llamadaRealizada: false };
    }
    return { llamadaRealizada: true };
  }

  // Solo email como fallback
  console.log(`[outreach] ✉ Lead sin teléfono, iniciando secuencia email: ${lead.nombre}`);
  const resultado = await iniciarSecuenciaEmailOutreach(lead, cuenta);
  if (!resultado.ok) {
    console.warn(`[outreach] ✗ Email fallido para ${lead.nombre}: ${resultado.error}`);
    await registrarFalloProspeccion(lead.id, lead.intentos_outreach);
  }
  return { llamadaRealizada: false };
}

// ============================================================
// Procesamiento de una cuenta completa
// ============================================================

async function procesarCuenta(
  cuenta: Cuenta,
  opciones?: { runId?: string; modo?: ModoContacto },
): Promise<{ procesados: number; llamadas: number; emails: number }> {
  const modo: ModoContacto = opciones?.modo ?? "ambos";
  const leads = await listarLeadsNuevosParaProspeccion(
    cuenta.id,
    LEADS_POR_CORRIDA,
    opciones?.runId,
  );
  if (leads.length === 0) return { procesados: 0, llamadas: 0, emails: 0 };

  console.log(
    `[outreach] 🏢 Cuenta ${cuenta.etiqueta}: ${leads.length} lead(s) · modo ${modo}${opciones?.runId ? ` · run ${opciones.runId}` : ""}`,
  );

  let llamadasUsadas = await contarLlamadasProspeccionUltimaHora(cuenta.id);
  let llamadas = 0;
  let emails = 0;

  for (const lead of leads) {
    const { llamadaRealizada } = await procesarLead(lead, cuenta, llamadasUsadas, modo);
    if (llamadaRealizada) {
      llamadas += 1;
      llamadasUsadas += 1;
      // Delay entre llamadas para no disparar todo simultáneo
      if (leads.indexOf(lead) < leads.length - 1 && DELAY_ENTRE_LLAMADAS_MS > 0) {
        await sleep(DELAY_ENTRE_LLAMADAS_MS);
      }
    } else {
      // Contar emails (aproximado: si no hubo llamada y tiene email)
      if (lead.email && modo !== "solo_llamadas") emails += 1;
    }
  }

  return { procesados: leads.length, llamadas, emails };
}

// ============================================================
// Función principal — llamada desde cicloVida.ts cada 5 minutos
// ============================================================

export async function procesarOutreach(): Promise<void> {
  try {
    const cuentas = await listarCuentas();
    const activas = cuentas.filter((c) => !c.esta_archivada);
    if (activas.length === 0) return;

    for (const cuenta of activas) {
      try {
        await procesarCuenta(cuenta);
      } catch (err) {
        console.error(`[outreach] Error procesando cuenta ${cuenta.id}:`, err);
      }
    }

    await procesarFollowUpsEmailOutreach().catch((err) => {
      console.error("[outreach] Error en follow-ups email:", err);
    });
  } catch (err) {
    console.error("[outreach] Error general en procesarOutreach:", err);
  }
}

/**
 * Procesa leads de una cuenta específica, opcionalmente filtrando por run.
 * Retorna un resumen. Útil para disparo manual desde el panel.
 */
export async function procesarOutreachCuenta(
  cuentaId: string,
  opciones?: { runId?: string; modo?: ModoContacto },
): Promise<{ procesados: number; llamadas: number; emails: number }> {
  const cuenta = await obtenerCuenta(cuentaId);
  if (!cuenta || cuenta.esta_archivada) return { procesados: 0, llamadas: 0, emails: 0 };
  const resumen = await procesarCuenta(cuenta, opciones);
  await procesarFollowUpsEmailOutreach(cuentaId).catch(() => null);
  return resumen;
}
