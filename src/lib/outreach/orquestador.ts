/**
 * Orquestador del pipeline de cold outreach.
 * Equivalente al orchestrator/index.js del video.
 *
 * Se ejecuta cada 5 minutos desde cicloVida.ts.
 * Para cada cuenta:
 *   1. Toma leads con estado_outreach = 'nuevo'
 *   2. Decide: ¿tiene teléfono? → llamada Vapi
 *              ¿solo email?    → secuencia email Resend
 *              ¿ninguno?       → marcar no_contactable
 *   3. Rate limit: máx OUTREACH_MAX_LLAMADAS_POR_HORA por cuenta por hora
 *   4. Retry: hasta 3 intentos con backoff natural (el intervalo de 5 min
 *      actúa como pausa entre reintentos — equivalente funcional a BullMQ)
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
// Configuración
// ============================================================

const MAX_LLAMADAS_POR_HORA = parseInt(
  process.env.OUTREACH_MAX_LLAMADAS_POR_HORA ?? "10",
  10,
);

// Máximo de leads que el orquestador procesa por cuenta por corrida
const LEADS_POR_CORRIDA = 20;

// ============================================================
// Procesamiento de un lead individual
// ============================================================

async function procesarLead(
  lead: LeadExtraido,
  cuenta: Cuenta,
  llamadasUsadasEstaHora: number,
): Promise<{ llamadaRealizada: boolean }> {
  const tieneTelefono = !!lead.telefono;
  const tieneEmail = !!lead.email;

  // ── Sin datos de contacto ─────────────────────────────────
  if (!tieneTelefono && !tieneEmail) {
    console.log(
      `[outreach] ⚠ Lead sin contacto: ${lead.nombre} — marcando no_contactable`,
    );
    await actualizarEstadoProspeccion(lead.id, "no_contactable", "ninguno");
    return { llamadaRealizada: false };
  }

  // ── Tiene teléfono → llamada Vapi ─────────────────────────
  if (tieneTelefono) {
    // Rate limit: máx N llamadas por hora por cuenta
    if (llamadasUsadasEstaHora >= MAX_LLAMADAS_POR_HORA) {
      console.log(
        `[outreach] ⏳ Rate limit alcanzado para cuenta ${cuenta.id} ` +
        `(${llamadasUsadasEstaHora}/${MAX_LLAMADAS_POR_HORA} llamadas/hora) — ` +
        `lead ${lead.nombre} se procesará en la próxima corrida`,
      );
      return { llamadaRealizada: false };
    }

    const resultado = await dispararLlamadaOutreach(lead, cuenta);

    if (!resultado.ok) {
      // Backoff exponencial via contador de intentos:
      // intentos 0→1: reintenta en ~5 min (próxima corrida)
      // intentos 1→2: reintenta en ~5 min (próxima corrida)
      // intentos 2→3: marca no_contactable — se agotaron los reintentos
      console.warn(
        `[outreach] ✗ Llamada fallida para ${lead.nombre} ` +
        `(intento ${lead.intentos_outreach + 1}/3): ${resultado.error}`,
      );
      await registrarFalloProspeccion(lead.id, lead.intentos_outreach);
      return { llamadaRealizada: false };
    }

    return { llamadaRealizada: true };
  }

  // ── Solo tiene email → secuencia Resend ──────────────────
  console.log(
    `[outreach] ✉ Lead sin teléfono, iniciando secuencia email: ${lead.nombre}`,
  );
  const resultado = await iniciarSecuenciaEmailOutreach(lead, cuenta);

  if (!resultado.ok) {
    console.warn(
      `[outreach] ✗ Email fallido para ${lead.nombre} ` +
      `(intento ${lead.intentos_outreach + 1}/3): ${resultado.error}`,
    );
    await registrarFalloProspeccion(lead.id, lead.intentos_outreach);
  }

  return { llamadaRealizada: false };
}

// ============================================================
// Procesamiento de una cuenta completa
// ============================================================

async function procesarCuenta(cuenta: Cuenta): Promise<void> {
  const leads = await listarLeadsNuevosParaProspeccion(cuenta.id, LEADS_POR_CORRIDA);
  if (leads.length === 0) return;

  console.log(
    `[outreach] 🏢 Cuenta ${cuenta.etiqueta}: ${leads.length} lead(s) nuevo(s)`,
  );

  // Obtener rate limit actual UNA sola vez para esta corrida
  let llamadasUsadas = await contarLlamadasProspeccionUltimaHora(cuenta.id);

  for (const lead of leads) {
    const { llamadaRealizada } = await procesarLead(lead, cuenta, llamadasUsadas);
    if (llamadaRealizada) {
      llamadasUsadas += 1; // Actualizar contador local para esta corrida
    }
  }
}

// ============================================================
// Función principal — llamada desde cicloVida.ts cada 5 minutos
// ============================================================

/**
 * Punto de entrada del orquestador. Itera todas las cuentas activas,
 * procesa leads nuevos y despacha follow-up emails pendientes.
 */
export async function procesarOutreach(): Promise<void> {
  try {
    const cuentas = await listarCuentas();
    const activas = cuentas.filter((c) => !c.esta_archivada);

    if (activas.length === 0) return;

    // Procesar nuevos leads por cuenta (llamadas + email paso 1)
    for (const cuenta of activas) {
      try {
        await procesarCuenta(cuenta);
      } catch (err) {
        console.error(
          `[outreach] Error procesando cuenta ${cuenta.id}:`, err,
        );
      }
    }

    // Despachar follow-ups de email pendientes (paso 2 y 3) — todas las cuentas
    await procesarFollowUpsEmailOutreach().catch((err) => {
      console.error("[outreach] Error en follow-ups email:", err);
    });
  } catch (err) {
    console.error("[outreach] Error general en procesarOutreach:", err);
  }
}

/**
 * Versión acotada a una sola cuenta. Útil para pruebas desde el panel admin.
 */
export async function procesarOutreachCuenta(cuentaId: string): Promise<void> {
  const cuenta = await obtenerCuenta(cuentaId);
  if (!cuenta || cuenta.esta_archivada) return;
  await procesarCuenta(cuenta);
  await procesarFollowUpsEmailOutreach(cuentaId).catch(() => null);
}
