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
import { db } from "../db/cliente";
import { listarUsoMes } from "../db/meteringUso";
import { enviarEmail, urlApp } from "./cliente";
import {
  emailBienvenida,
  emailPagoAprobado,
  emailPagoFallido,
  emailRecargaCreditos,
  emailReporteSemanal,
  emailWhatsAppCaido,
  emailNuevoArticulo,
  type KpisReporteSemanal,
  type LeadAtencionReporte,
} from "./plantillas";
import type { EstadoLead } from "../db/tipos";

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

// ============================================================
// 6. Reporte semanal — KPIs de la semana pasada
// ============================================================

/** Estado del lead en español legible para mostrar en el email. */
const ETIQUETA_ESTADO_LEAD: Record<EstadoLead, string> = {
  nuevo: "Nuevo",
  contactado: "Contactado",
  calificado: "Calificado",
  interesado: "Interesado",
  negociacion: "Negociación",
  cerrado: "Cerrado",
  perdido: "Perdido",
};

/**
 * Calcula la ventana [lunes 00:00, lunes siguiente 00:00) de la semana
 * pasada en horario LATAM. Usamos hora local del servidor — para LATAM
 * se asume TZ=America/Argentina/Buenos_Aires (o similar) en el host.
 */
function calcularSemanaPasada(): {
  desde: Date;
  hasta: Date;
  /** Etiqueta YYYY-WW (ISO week) usada como idempotencyKey. */
  claveSemana: string;
  /** Periodo legible — ej: "28 abr – 4 may". */
  periodoLegible: string;
} {
  const ahora = new Date();
  // getDay(): 0=domingo, 1=lunes, ...
  const dia = ahora.getDay();
  // Días desde el lunes de ESTA semana
  const diasDesdeLunes = (dia + 6) % 7;
  const lunesEsta = new Date(ahora);
  lunesEsta.setHours(0, 0, 0, 0);
  lunesEsta.setDate(lunesEsta.getDate() - diasDesdeLunes);
  // Lunes de la semana pasada
  const desde = new Date(lunesEsta);
  desde.setDate(desde.getDate() - 7);
  // Hasta el lunes de esta semana (excl)
  const hasta = new Date(lunesEsta);

  // ISO week-year + week number sobre `desde`
  const ref = new Date(
    Date.UTC(desde.getFullYear(), desde.getMonth(), desde.getDate()),
  );
  const diaUTC = ref.getUTCDay() || 7;
  ref.setUTCDate(ref.getUTCDate() + 4 - diaUTC);
  const inicioAnio = new Date(Date.UTC(ref.getUTCFullYear(), 0, 1));
  const numeroSemana = Math.ceil(
    ((ref.getTime() - inicioAnio.getTime()) / 86400000 + 1) / 7,
  );
  const claveSemana = `${ref.getUTCFullYear()}-W${String(numeroSemana).padStart(2, "0")}`;

  const fmt = new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
  });
  const finExclusivo = new Date(hasta.getTime() - 1);
  const periodoLegible = `${fmt.format(desde)} – ${fmt.format(finExclusivo)}`;

  return { desde, hasta, claveSemana, periodoLegible };
}

/**
 * Devuelve los KPIs del período + top 3 leads que necesitan atención.
 * Si la cuenta no tuvo NINGÚN mensaje recibido en la semana, devuelve
 * null — el caller debe omitir el envío (mejor que mandar email vacío).
 */
async function calcularDatosSemana(
  cuentaId: string,
  desde: Date,
  hasta: Date,
): Promise<{
  kpis: KpisReporteSemanal;
  topAtencion: LeadAtencionReporte[];
} | null> {
  const desdeISO = desde.toISOString();
  const hastaISO = hasta.toISOString();

  // Mensajes recibidos del usuario en la semana
  const cntMsgs = await db()
    .from("mensajes")
    .select("id", { count: "exact", head: true })
    .eq("cuenta_id", cuentaId)
    .eq("rol", "usuario")
    .gte("creado_en", desdeISO)
    .lt("creado_en", hastaISO);
  const mensajesRecibidos = cntMsgs.count ?? 0;

  if (mensajesRecibidos === 0) {
    return null; // Sin actividad → no mandamos email.
  }

  // Leads nuevos: conversaciones creadas en la semana
  const cntLeads = await db()
    .from("conversaciones")
    .select("id", { count: "exact", head: true })
    .eq("cuenta_id", cuentaId)
    .gte("creada_en", desdeISO)
    .lt("creada_en", hastaISO);
  const leadsNuevos = cntLeads.count ?? 0;

  // Citas agendadas (creadas) en la semana
  const cntCitas = await db()
    .from("citas")
    .select("id", { count: "exact", head: true })
    .eq("cuenta_id", cuentaId)
    .gte("creada_en", desdeISO)
    .lt("creada_en", hastaISO);
  const citasAgendadas = cntCitas.count ?? 0;

  // Costo IA — sumamos lo registrado desde el inicio de la semana
  // hasta ahora. listarUsoMes acepta `desde` y devuelve por proveedor.
  let costoIaUsd = 0;
  try {
    const uso = await listarUsoMes(cuentaId, desdeISO);
    costoIaUsd = uso.reduce((acc, u) => acc + (u.costo_usd ?? 0), 0);
  } catch (err) {
    // Si la tabla metering_uso no existe, lo ignoramos.
    log.debug({ cuentaId, err }, "[emails] metering_uso no disponible");
  }

  // Top 3 leads que necesitan atención humana, más recientes primero.
  const { data: convsAtencion } = await db()
    .from("conversaciones")
    .select("nombre, telefono, estado_lead, datos_capturados, ultimo_mensaje_en")
    .eq("cuenta_id", cuentaId)
    .eq("necesita_humano", true)
    .order("ultimo_mensaje_en", { ascending: false, nullsFirst: false })
    .limit(3);

  type FilaConv = {
    nombre: string | null;
    telefono: string;
    estado_lead: EstadoLead | null;
    datos_capturados: { nombre?: string } | null;
  };
  const topAtencion: LeadAtencionReporte[] = (
    (convsAtencion ?? []) as FilaConv[]
  ).map((c) => {
    const nombreCapturado = c.datos_capturados?.nombre?.trim() || "";
    const nombre =
      nombreCapturado ||
      (c.nombre ?? "").trim() ||
      `+${c.telefono}`;
    const estado = (c.estado_lead ?? "nuevo") as EstadoLead;
    return {
      nombre,
      estadoLead: ETIQUETA_ESTADO_LEAD[estado] ?? estado,
    };
  });

  return {
    kpis: {
      mensajesRecibidos,
      leadsNuevos,
      citasAgendadas,
      costoIaUsd,
    },
    topAtencion,
  };
}

/**
 * Manda el reporte semanal de UNA cuenta. Idempotente vía
 * `idempotencyKey` por cuenta+semana ISO. Si la cuenta no tuvo
 * mensajes recibidos en la semana, omite el envío.
 *
 * Devuelve `"enviado"` | `"omitido"` | `"error"` para que el cron
 * pueda contabilizar.
 */
export async function enviarReporteSemanal(
  cuentaId: string,
): Promise<"enviado" | "omitido" | "error"> {
  try {
    const cuenta = await obtenerCuenta(cuentaId);
    if (!cuenta || cuenta.esta_archivada) {
      return "omitido";
    }
    if (!cuenta.notificaciones_email_activas) {
      log.debug({ cuentaId }, "[emails] reporteSemanal: opt-out por cuenta");
      return "omitido";
    }
    const usuario = await obtenerUsuarioApp(cuenta.usuario_id);
    if (!usuario?.email) {
      log.debug({ cuentaId }, "[emails] reporteSemanal: usuario sin email");
      return "omitido";
    }

    const { desde, hasta, claveSemana, periodoLegible } =
      calcularSemanaPasada();

    const datos = await calcularDatosSemana(cuentaId, desde, hasta);
    if (!datos) {
      log.debug(
        { cuentaId, claveSemana },
        "[emails] reporteSemanal: cuenta sin actividad — skip",
      );
      return "omitido";
    }

    const urlDashboard = `${urlApp()}/app/cuentas/${cuentaId}`;
    const { subject, html } = emailReporteSemanal({
      nombre: usuario.nombre,
      etiquetaCuenta: cuenta.etiqueta,
      periodo: periodoLegible,
      kpis: datos.kpis,
      topAtencion: datos.topAtencion,
      urlDashboard,
    });

    const r = await enviarEmail({
      to: usuario.email,
      subject,
      html,
      idempotencyKey: `reporte_semanal:cuenta:${cuentaId}:semana:${claveSemana}`,
    });
    if (!r.ok) {
      if (r.motivo === "sin_api_key") return "omitido";
      log.warn(
        { cuentaId, motivo: r.motivo },
        "[emails] reporteSemanal falló",
      );
      return "error";
    }
    return "enviado";
  } catch (err) {
    log.error(
      { err, cuentaId },
      "[emails] excepción en enviarReporteSemanal",
    );
    return "error";
  }
}

// ============================================================
// 5. WhatsApp caído (cuenta desconectada)
// ============================================================

// ============================================================
// 7. Nuevo artículo del blog — enviar a todos los suscriptores activos
// ============================================================

/**
 * Envía el digest de nuevo artículo a todos los suscriptores confirmados y
 * no desuscritos. Fire-and-forget: no bloquea el flujo del handler.
 */
export async function enviarNuevoArticuloSuscriptores(
  articuloId: string,
  titulo: string,
  resumen: string,
  slug: string,
  autorNombre: string,
): Promise<void> {
  try {
    const appUrl = urlApp();
    const urlArticulo = `${appUrl}/blog/${slug}`;
    const LOTE = 100;
    let offset = 0;

    while (true) {
      const { data: suscriptores, error } = await db()
        .from("suscriptores_blog")
        .select("email, token_confirmacion")
        .eq("confirmado", true)
        .is("desuscrito_en", null)
        .order("suscrito_en", { ascending: true })
        .range(offset, offset + LOTE - 1);

      if (error) {
        log.warn({ err: error, articuloId }, "[emails] nuevoArticulo: error leyendo suscriptores");
        break;
      }
      if (!suscriptores || suscriptores.length === 0) break;

      for (const s of suscriptores) {
        const urlDesuscribir = `${appUrl}/api/blog/desuscribir?token=${encodeURIComponent(s.token_confirmacion ?? "")}`;
        const { subject, html } = emailNuevoArticulo(titulo, resumen, urlArticulo, urlDesuscribir, autorNombre);
        const r = await enviarEmail({
          to: s.email,
          subject,
          html,
          idempotencyKey: `articulo:${articuloId}:suscriptor:${s.email}`,
        });
        if (!r.ok && r.motivo !== "sin_api_key") {
          log.warn({ email: s.email, articuloId, motivo: r.motivo }, "[emails] nuevoArticulo: fallo envío");
        }
      }

      if (suscriptores.length < LOTE) break;
      offset += LOTE;
    }
  } catch (err) {
    log.error({ err, articuloId }, "[emails] excepción en enviarNuevoArticuloSuscriptores");
  }
}

export async function enviarWhatsAppCaido(idCuenta: string): Promise<void> {
  try {
    const cuenta = await obtenerCuenta(idCuenta);
    if (!cuenta?.usuario_id) {
      log.debug({ idCuenta }, "[emails] waCaido: cuenta no encontrada");
      return;
    }
    if (!cuenta.notificaciones_email_activas) {
      log.debug({ idCuenta }, "[emails] waCaido: opt-out por cuenta");
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
