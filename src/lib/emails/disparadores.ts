/**
 * Funciones de alto nivel para disparar emails desde el resto del código.
 *
 * Todas son fire-and-forget: NUNCA bloquean el flujo de pago/auth/etc.
 * Cualquier error se loguea con pino y se traga — el caller no debería
 * necesitar try/catch porque ya pasa adentro.
 *
 * Uso típico:
 *   void enviarBienvenida(usuarioId);   // no se espera
 *
 * Cada disparador resuelve internamente los datos que necesita
 * (usuario, cuenta, pago) leyendo de Supabase con el cliente admin.
 */

import { log } from "../logger";
import { obtenerUsuarioApp } from "../db/usuarios";
import { obtenerCuenta } from "../db/cuentas";
import { obtenerPagoPorId } from "../db/pagos";
import { obtenerSaldo } from "../db/creditos";
import { obtenerPlan } from "../planes";
import { enviarEmail, urlApp } from "./cliente";
import {
  emailBienvenida,
  emailPagoAprobado,
  emailPagoFallido,
  emailRecargaCreditos,
  emailWhatsAppCaido,
} from "./plantillas";

// ============================================================
// 1. Bienvenida tras signup
// ============================================================

export async function enviarBienvenida(usuarioId: string): Promise<void> {
  try {
    const usuario = await obtenerUsuarioApp(usuarioId);
    if (!usuario?.email) {
      log.debug({ usuarioId }, "[emails] bienvenida: usuario sin email");
      return;
    }
    const { subject, html } = emailBienvenida(usuario.nombre, urlApp());
    const r = await enviarEmail({
      to: usuario.email,
      subject,
      html,
      idempotencyKey: `bienvenida:${usuarioId}`,
    });
    if (!r.ok && r.motivo !== "sin_api_key") {
      log.warn({ usuarioId, motivo: r.motivo }, "[emails] bienvenida falló");
    }
  } catch (err) {
    log.error({ err, usuarioId }, "[emails] excepción en enviarBienvenida");
  }
}

// ============================================================
// 2. Pago de suscripción aprobado
// ============================================================

export async function enviarPagoAprobado(
  usuarioId: string,
  pagoId: string,
): Promise<void> {
  try {
    const [usuario, pago] = await Promise.all([
      obtenerUsuarioApp(usuarioId),
      obtenerPagoPorId(pagoId),
    ]);
    if (!usuario?.email || !pago) {
      log.debug({ usuarioId, pagoId }, "[emails] pagoAprobado: datos faltantes");
      return;
    }

    const planMeta = (pago.metadata?.plan ?? null) as string | null;
    const plan = obtenerPlan(planMeta ?? usuario.plan);
    const proximoCobro =
      (pago.metadata?.vence_en as string | undefined)?.slice(0, 10) ??
      new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const urlFactura = `${urlApp()}/app/mi-cuenta/facturacion`;

    const { subject, html } = emailPagoAprobado(
      usuario.nombre,
      plan.nombre,
      pago.monto_usd,
      urlFactura,
      plan.beneficios,
      proximoCobro,
    );
    const r = await enviarEmail({
      to: usuario.email,
      subject,
      html,
      idempotencyKey: `pago_aprobado:${pago.id}`,
    });
    if (!r.ok && r.motivo !== "sin_api_key") {
      log.warn(
        { usuarioId, pagoId, motivo: r.motivo },
        "[emails] pagoAprobado falló",
      );
    }
  } catch (err) {
    log.error(
      { err, usuarioId, pagoId },
      "[emails] excepción en enviarPagoAprobado",
    );
  }
}

// ============================================================
// 3. Recarga de créditos acreditada
// ============================================================

export async function enviarRecargaCreditos(
  usuarioId: string,
  pagoId: string,
): Promise<void> {
  try {
    const [usuario, pago] = await Promise.all([
      obtenerUsuarioApp(usuarioId),
      obtenerPagoPorId(pagoId),
    ]);
    if (!usuario?.email || !pago) {
      log.debug({ usuarioId, pagoId }, "[emails] recarga: datos faltantes");
      return;
    }

    let saldoNuevo: number | undefined;
    if (pago.cuenta_id) {
      const saldo = await obtenerSaldo(pago.cuenta_id);
      saldoNuevo = saldo?.saldo_actual;
    }

    const { subject, html } = emailRecargaCreditos(
      usuario.nombre,
      pago.creditos_otorgados,
      pago.monto_usd,
      saldoNuevo,
    );
    const r = await enviarEmail({
      to: usuario.email,
      subject,
      html,
      idempotencyKey: `recarga:${pago.id}`,
    });
    if (!r.ok && r.motivo !== "sin_api_key") {
      log.warn(
        { usuarioId, pagoId, motivo: r.motivo },
        "[emails] recarga falló",
      );
    }
  } catch (err) {
    log.error(
      { err, usuarioId, pagoId },
      "[emails] excepción en enviarRecargaCreditos",
    );
  }
}

// ============================================================
// 4. Pago de suscripción fallido
// ============================================================

export async function enviarPagoFallido(
  usuarioId: string,
  motivo: string,
): Promise<void> {
  try {
    const usuario = await obtenerUsuarioApp(usuarioId);
    if (!usuario?.email) {
      log.debug({ usuarioId }, "[emails] pagoFallido: usuario sin email");
      return;
    }
    const urlActualizar = `${urlApp()}/app/mi-cuenta/facturacion`;
    const { subject, html } = emailPagoFallido(
      usuario.nombre,
      motivo || "El procesador de pagos rechazó la transacción.",
      urlActualizar,
    );
    // Idempotencia diaria: misma falla en el mismo día = no duplicar.
    const dia = new Date().toISOString().slice(0, 10);
    const r = await enviarEmail({
      to: usuario.email,
      subject,
      html,
      idempotencyKey: `pago_fallido:${usuarioId}:${dia}`,
    });
    if (!r.ok && r.motivo !== "sin_api_key") {
      log.warn(
        { usuarioId, motivo: r.motivo },
        "[emails] pagoFallido falló",
      );
    }
  } catch (err) {
    log.error({ err, usuarioId }, "[emails] excepción en enviarPagoFallido");
  }
}

// ============================================================
// 5. WhatsApp caído (cuenta desconectada)
// ============================================================

export async function enviarWhatsAppCaido(idCuenta: string): Promise<void> {
  try {
    const cuenta = await obtenerCuenta(idCuenta);
    if (!cuenta?.usuario_id) {
      log.debug({ idCuenta }, "[emails] waCaido: cuenta no encontrada");
      return;
    }
    const usuario = await obtenerUsuarioApp(cuenta.usuario_id);
    if (!usuario?.email) {
      log.debug({ idCuenta }, "[emails] waCaido: usuario sin email");
      return;
    }
    const urlReconectar = `${urlApp()}/app/cuentas/${idCuenta}`;
    const { subject, html } = emailWhatsAppCaido(
      usuario.nombre,
      cuenta.etiqueta,
      urlReconectar,
    );
    const r = await enviarEmail({
      to: usuario.email,
      subject,
      html,
      idempotencyKey: `wa_caido:${idCuenta}`,
    });
    if (!r.ok && r.motivo !== "sin_api_key") {
      log.warn(
        { idCuenta, motivo: r.motivo },
        "[emails] waCaido falló",
      );
    }
  } catch (err) {
    log.error({ err, idCuenta }, "[emails] excepción en enviarWhatsAppCaido");
  }
}
