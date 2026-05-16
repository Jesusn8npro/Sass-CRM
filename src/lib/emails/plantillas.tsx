/**
 * Plantillas HTML para los 5 emails transaccionales del SaaS.
 *
 * Diseño: dark editorial (negro, headline serif italic, acento emerald-300).
 * Imitan el lenguaje visual de la landing.
 *
 * NO usamos React Email para no agregar otra dependencia: las plantillas
 * son funciones puras que devuelven HTML inline. Tablas-based para
 * compatibilidad con Outlook/Gmail/Apple Mail.
 *
 * Convenciones:
 *  - bg #0a0a0a, text #fafafa, acento #6ee7b7 (emerald-300)
 *  - Container max-width 560px, centrado
 *  - Headline italic serif, body sans-serif system
 *  - CTA siempre como botón emerald-400 con texto negro
 *  - Footer común con marca + link unsubscribe (placeholder)
 */

const COLOR_BG = "#0a0a0a";
const COLOR_PANEL = "#111111";
const COLOR_BORDE = "#262626";
const COLOR_TEXTO = "#fafafa";
const COLOR_TEXTO_TENUE = "#a1a1aa";
const COLOR_ACENTO = "#6ee7b7"; // emerald-300
const COLOR_CTA_BG = "#34d399"; // emerald-400
const COLOR_CTA_FG = "#0a0a0a";

const FONT_SERIF = `"Instrument Serif", Georgia, "Times New Roman", serif`;
const FONT_SANS = `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
const FONT_MONO = `"JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace`;

/** Escapa HTML para evitar inyección desde nombres de usuario etc. */
function esc(s: string | number | null | undefined): string {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function saludo(nombre: string | null | undefined): string {
  const n = (nombre ?? "").trim();
  return n ? `Hola ${esc(n)},` : "Hola,";
}

function botonCTA(href: string, texto: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 28px 0;">
      <tr>
        <td style="border-radius: 999px; background-color: ${COLOR_CTA_BG};">
          <a href="${esc(href)}"
             style="display: inline-block; padding: 12px 28px; font-family: ${FONT_SANS}; font-size: 14px; font-weight: 600; color: ${COLOR_CTA_FG}; text-decoration: none; border-radius: 999px;">
            ${esc(texto)} →
          </a>
        </td>
      </tr>
    </table>
  `;
}

function footerComun(): string {
  return `
    <hr style="border: none; border-top: 1px solid ${COLOR_BORDE}; margin: 40px 0 24px;">
    <p style="font-family: ${FONT_SANS}; font-size: 12px; color: ${COLOR_TEXTO_TENUE}; line-height: 1.6; margin: 0 0 8px;">
      <strong style="color: ${COLOR_TEXTO};">Sass-CRM</strong> · CRM con IA para WhatsApp
    </p>
    <p style="font-family: ${FONT_SANS}; font-size: 11px; color: ${COLOR_TEXTO_TENUE}; line-height: 1.6; margin: 0;">
      Si no querés recibir más emails como este, ajustá tus preferencias <a href="#" style="color: ${COLOR_ACENTO}; text-decoration: underline;">acá</a>.
    </p>
  `;
}

/** Layout base que envuelve cualquier contenido en el container dark. */
function layout(args: { titulo: string; cuerpo: string }): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(args.titulo)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${COLOR_BG}; color: ${COLOR_TEXTO};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${COLOR_BG};">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="max-width: 560px; width: 100%; background-color: ${COLOR_PANEL}; border: 1px solid ${COLOR_BORDE}; border-radius: 16px;">
          <tr>
            <td style="padding: 40px 36px;">
              <p style="font-family: ${FONT_MONO}; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: ${COLOR_ACENTO}; margin: 0 0 18px;">
                Sass-CRM
              </p>
              ${args.cuerpo}
              ${footerComun()}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ============================================================
// 1. Bienvenida
// ============================================================

export function emailBienvenida(
  nombre: string | null,
  urlAppBase: string,
): { subject: string; html: string } {
  const cuerpo = `
    <h1 style="font-family: ${FONT_SERIF}; font-style: italic; font-weight: 400; font-size: 32px; line-height: 1.2; color: ${COLOR_TEXTO}; margin: 0 0 16px;">
      Bienvenido a Sass-CRM.
    </h1>
    <p style="font-family: ${FONT_SANS}; font-size: 15px; line-height: 1.7; color: ${COLOR_TEXTO}; margin: 0 0 12px;">
      ${saludo(nombre)}
    </p>
    <p style="font-family: ${FONT_SANS}; font-size: 15px; line-height: 1.7; color: ${COLOR_TEXTO_TENUE}; margin: 0 0 16px;">
      Tu cuenta ya está lista. El próximo paso es conectar tu primer WhatsApp y dejar
      que la IA empiece a contestar por vos. Tarda menos de 2 minutos.
    </p>
    ${botonCTA(`${urlAppBase}/app/cuentas`, "Conectar tu primer WhatsApp")}
    <p style="font-family: ${FONT_SANS}; font-size: 13px; line-height: 1.7; color: ${COLOR_TEXTO_TENUE}; margin: 16px 0 0;">
      Cualquier duda, respondé este email — leemos todo.
    </p>
  `;
  return {
    subject: "Bienvenido a Sass-CRM",
    html: layout({ titulo: "Bienvenido", cuerpo }),
  };
}

// ============================================================
// 2. Pago aprobado (suscripción)
// ============================================================

export function emailPagoAprobado(
  nombre: string | null,
  plan: string,
  monto: number,
  urlFactura: string,
  features: string[] = [],
  proximoCobro: string = "2026-06-04",
): { subject: string; html: string } {
  const featuresHtml =
    features.length > 0
      ? `
        <ul style="font-family: ${FONT_SANS}; font-size: 14px; line-height: 1.8; color: ${COLOR_TEXTO}; margin: 0 0 20px; padding: 0 0 0 18px;">
          ${features.map((f) => `<li style="margin-bottom: 4px;">${esc(f)}</li>`).join("")}
        </ul>
      `
      : "";

  const cuerpo = `
    <h1 style="font-family: ${FONT_SERIF}; font-style: italic; font-weight: 400; font-size: 30px; line-height: 1.2; color: ${COLOR_TEXTO}; margin: 0 0 16px;">
      Pago confirmado.
    </h1>
    <p style="font-family: ${FONT_SANS}; font-size: 15px; line-height: 1.7; color: ${COLOR_TEXTO}; margin: 0 0 20px;">
      ${saludo(nombre)} Tu plan <strong>${esc(plan)}</strong> está activo.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: ${COLOR_BG}; border: 1px solid ${COLOR_BORDE}; border-radius: 12px; margin: 0 0 24px;">
      <tr>
        <td style="padding: 18px 20px;">
          <p style="font-family: ${FONT_MONO}; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: ${COLOR_TEXTO_TENUE}; margin: 0 0 8px;">
            Recibo
          </p>
          <p style="font-family: ${FONT_MONO}; font-size: 22px; color: ${COLOR_TEXTO}; margin: 0 0 4px;">
            US$ ${esc(monto.toFixed(2))}
          </p>
          <p style="font-family: ${FONT_SANS}; font-size: 13px; color: ${COLOR_TEXTO_TENUE}; margin: 0;">
            Plan ${esc(plan)} · Próximo cobro: ${esc(proximoCobro)}
          </p>
        </td>
      </tr>
    </table>
    ${featuresHtml ? `<p style="font-family: ${FONT_SANS}; font-size: 14px; color: ${COLOR_TEXTO_TENUE}; margin: 0 0 12px;">Lo que incluye tu plan:</p>${featuresHtml}` : ""}
    ${botonCTA(urlFactura, "Ver factura")}
  `;
  return {
    subject: `Pago confirmado · Plan ${plan}`,
    html: layout({ titulo: "Pago confirmado", cuerpo }),
  };
}

// ============================================================
// 3. Recarga de créditos
// ============================================================

export function emailRecargaCreditos(
  nombre: string | null,
  creditos: number,
  monto: number,
  saldoNuevo?: number,
): { subject: string; html: string } {
  const saldoBloque =
    typeof saldoNuevo === "number"
      ? `
        <p style="font-family: ${FONT_SANS}; font-size: 13px; color: ${COLOR_TEXTO_TENUE}; margin: 0;">
          Saldo actualizado: <span style="font-family: ${FONT_MONO}; color: ${COLOR_ACENTO};">${esc(saldoNuevo.toLocaleString("es-AR"))} créditos</span>
        </p>
      `
      : "";

  const cuerpo = `
    <h1 style="font-family: ${FONT_SERIF}; font-style: italic; font-weight: 400; font-size: 30px; line-height: 1.2; color: ${COLOR_TEXTO}; margin: 0 0 16px;">
      Créditos acreditados.
    </h1>
    <p style="font-family: ${FONT_SANS}; font-size: 15px; line-height: 1.7; color: ${COLOR_TEXTO}; margin: 0 0 20px;">
      ${saludo(nombre)} Sumamos tu recarga a la cuenta.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: ${COLOR_BG}; border: 1px solid ${COLOR_BORDE}; border-radius: 12px; margin: 0 0 24px;">
      <tr>
        <td style="padding: 18px 20px;">
          <p style="font-family: ${FONT_MONO}; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: ${COLOR_TEXTO_TENUE}; margin: 0 0 8px;">
            Recarga
          </p>
          <p style="font-family: ${FONT_MONO}; font-size: 22px; color: ${COLOR_TEXTO}; margin: 0 0 4px;">
            +${esc(creditos.toLocaleString("es-AR"))} créditos
          </p>
          <p style="font-family: ${FONT_SANS}; font-size: 13px; color: ${COLOR_TEXTO_TENUE}; margin: 0 0 8px;">
            US$ ${esc(monto.toFixed(2))}
          </p>
          ${saldoBloque}
        </td>
      </tr>
    </table>
    <p style="font-family: ${FONT_SANS}; font-size: 13px; line-height: 1.7; color: ${COLOR_TEXTO_TENUE}; margin: 0;">
      Los créditos no expiran y se usan al ritmo que tu cuenta los consuma.
    </p>
  `;
  return {
    subject: `Recarga acreditada · +${creditos.toLocaleString("es-AR")} créditos`,
    html: layout({ titulo: "Recarga acreditada", cuerpo }),
  };
}

// ============================================================
// 4. Pago fallido
// ============================================================

export function emailPagoFallido(
  nombre: string | null,
  motivo: string,
  urlActualizar: string,
): { subject: string; html: string } {
  const cuerpo = `
    <h1 style="font-family: ${FONT_SERIF}; font-style: italic; font-weight: 400; font-size: 30px; line-height: 1.2; color: ${COLOR_TEXTO}; margin: 0 0 16px;">
      Tu pago no pasó.
    </h1>
    <p style="font-family: ${FONT_SANS}; font-size: 15px; line-height: 1.7; color: ${COLOR_TEXTO}; margin: 0 0 16px;">
      ${saludo(nombre)} No pudimos cobrar tu suscripción este mes.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: ${COLOR_BG}; border: 1px solid ${COLOR_BORDE}; border-radius: 12px; margin: 0 0 24px;">
      <tr>
        <td style="padding: 16px 20px;">
          <p style="font-family: ${FONT_MONO}; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: ${COLOR_TEXTO_TENUE}; margin: 0 0 6px;">
            Motivo
          </p>
          <p style="font-family: ${FONT_SANS}; font-size: 14px; color: ${COLOR_TEXTO}; margin: 0;">
            ${esc(motivo)}
          </p>
        </td>
      </tr>
    </table>
    <p style="font-family: ${FONT_SANS}; font-size: 14px; line-height: 1.7; color: ${COLOR_TEXTO_TENUE}; margin: 0 0 8px;">
      Para evitar que tus cuentas WhatsApp se pausen, actualizá tu método de pago.
    </p>
    ${botonCTA(urlActualizar, "Actualizar tarjeta")}
  `;
  return {
    subject: "Pago rechazado · acción requerida",
    html: layout({ titulo: "Pago rechazado", cuerpo }),
  };
}

// ============================================================
// 6. Reporte semanal — KPIs + leads que necesitan atención
// ============================================================

export interface KpisReporteSemanal {
  /** Mensajes recibidos del usuario en la semana. */
  mensajesRecibidos: number;
  /** Conversaciones creadas en la semana (nuevos leads). */
  leadsNuevos: number;
  /** Citas agendadas (creadas) en la semana. */
  citasAgendadas: number;
  /** Costo IA estimado en USD (todos los proveedores) en la semana. */
  costoIaUsd: number;
}

export interface LeadAtencionReporte {
  nombre: string;
  /** Estado del lead en español legible (ej: "Negociación"). */
  estadoLead: string;
}

export function emailReporteSemanal(args: {
  nombre: string | null;
  etiquetaCuenta: string;
  /** Período legible — ej: "28 abr – 4 may". */
  periodo: string;
  kpis: KpisReporteSemanal;
  topAtencion: LeadAtencionReporte[];
  urlDashboard: string;
}): { subject: string; html: string } {
  const { nombre, etiquetaCuenta, periodo, kpis, topAtencion, urlDashboard } =
    args;

  const fmtNum = (n: number) => n.toLocaleString("es-AR");
  const fmtUsd = (n: number) => `US$ ${n.toFixed(2)}`;

  const kpiCelda = (etiqueta: string, valor: string) => `
    <td width="50%" valign="top" style="padding: 14px 16px; background-color: ${COLOR_BG}; border: 1px solid ${COLOR_BORDE}; border-radius: 12px;">
      <p style="font-family: ${FONT_MONO}; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: ${COLOR_TEXTO_TENUE}; margin: 0 0 6px;">
        ${esc(etiqueta)}
      </p>
      <p style="font-family: ${FONT_MONO}; font-size: 22px; color: ${COLOR_TEXTO}; margin: 0;">
        ${esc(valor)}
      </p>
    </td>
  `;

  const gridKpis = `
    <table role="presentation" cellpadding="0" cellspacing="8" border="0" width="100%" style="margin: 0 -8px 24px;">
      <tr>
        ${kpiCelda("Mensajes recibidos", fmtNum(kpis.mensajesRecibidos))}
        ${kpiCelda("Leads nuevos", fmtNum(kpis.leadsNuevos))}
      </tr>
      <tr>
        ${kpiCelda("Citas agendadas", fmtNum(kpis.citasAgendadas))}
        ${kpiCelda("Costo IA estimado", fmtUsd(kpis.costoIaUsd))}
      </tr>
    </table>
  `;

  const listaAtencion =
    topAtencion.length > 0
      ? `
        <p style="font-family: ${FONT_MONO}; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: ${COLOR_TEXTO_TENUE}; margin: 24px 0 12px;">
          Necesitan tu atención
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: ${COLOR_BG}; border: 1px solid ${COLOR_BORDE}; border-radius: 12px; margin: 0 0 24px;">
          ${topAtencion
            .map(
              (l, i) => `
            <tr>
              <td style="padding: 12px 16px; ${i > 0 ? `border-top: 1px solid ${COLOR_BORDE};` : ""}">
                <p style="font-family: ${FONT_SANS}; font-size: 14px; color: ${COLOR_TEXTO}; margin: 0 0 2px;">
                  ${esc(l.nombre)}
                </p>
                <p style="font-family: ${FONT_MONO}; font-size: 11px; color: ${COLOR_ACENTO}; margin: 0;">
                  ${esc(l.estadoLead)}
                </p>
              </td>
            </tr>
          `,
            )
            .join("")}
        </table>
      `
      : "";

  const cuerpo = `
    <h1 style="font-family: ${FONT_SERIF}; font-style: italic; font-weight: 400; font-size: 30px; line-height: 1.2; color: ${COLOR_TEXTO}; margin: 0 0 8px;">
      Tu semana en Sass-CRM.
    </h1>
    <p style="font-family: ${FONT_MONO}; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: ${COLOR_TEXTO_TENUE}; margin: 0 0 20px;">
      ${esc(etiquetaCuenta)} · ${esc(periodo)}
    </p>
    <p style="font-family: ${FONT_SANS}; font-size: 15px; line-height: 1.7; color: ${COLOR_TEXTO}; margin: 0 0 20px;">
      ${saludo(nombre)}
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: ${COLOR_BG}; border: 1px solid ${COLOR_BORDE}; border-radius: 12px; margin: 0 0 20px;">
      <tr>
        <td style="padding: 22px 20px;">
          <p style="font-family: ${FONT_MONO}; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: ${COLOR_TEXTO_TENUE}; margin: 0 0 6px;">
            Leads nuevos esta semana
          </p>
          <p style="font-family: ${FONT_SERIF}; font-style: italic; font-weight: 400; font-size: 56px; line-height: 1; color: ${COLOR_ACENTO}; margin: 0;">
            ${fmtNum(kpis.leadsNuevos)}
          </p>
        </td>
      </tr>
    </table>
    ${gridKpis}
    ${listaAtencion}
    ${botonCTA(urlDashboard, "Ver dashboard completo")}
    <p style="font-family: ${FONT_SANS}; font-size: 13px; line-height: 1.7; color: ${COLOR_TEXTO_TENUE}; margin: 16px 0 0;">
      Este resumen llega cada lunes con la actividad de la semana anterior.
    </p>
  `;

  const subject = `📊 Tu semana en Sass-CRM — ${fmtNum(kpis.leadsNuevos)} leads · ${fmtNum(kpis.citasAgendadas)} citas`;
  return {
    subject,
    html: layout({ titulo: "Reporte semanal", cuerpo }),
  };
}

// ============================================================
// 5. WhatsApp caído
// ============================================================

export function emailWhatsAppCaido(
  nombre: string | null,
  etiquetaCuenta: string,
  urlReconectar: string,
): { subject: string; html: string } {
  const cuerpo = `
    <h1 style="font-family: ${FONT_SERIF}; font-style: italic; font-weight: 400; font-size: 30px; line-height: 1.2; color: ${COLOR_TEXTO}; margin: 0 0 16px;">
      Tu WhatsApp se desconectó.
    </h1>
    <p style="font-family: ${FONT_SANS}; font-size: 15px; line-height: 1.7; color: ${COLOR_TEXTO}; margin: 0 0 16px;">
      ${saludo(nombre)} La cuenta <strong>${esc(etiquetaCuenta)}</strong> dejó de estar conectada.
    </p>
    <p style="font-family: ${FONT_SANS}; font-size: 14px; line-height: 1.7; color: ${COLOR_TEXTO_TENUE}; margin: 0 0 8px;">
      Mientras esté desconectada, la IA no responde mensajes de esa cuenta. Podés
      volver a vincularla escaneando el QR desde el panel.
    </p>
    ${botonCTA(urlReconectar, "Escanear QR y reconectar")}
    <p style="font-family: ${FONT_SANS}; font-size: 13px; line-height: 1.7; color: ${COLOR_TEXTO_TENUE}; margin: 16px 0 0;">
      Causas comunes: superaste 4 dispositivos vinculados, 14+ días sin abrir
      WhatsApp en el móvil, o cerraste sesión manualmente desde "Dispositivos vinculados".
    </p>
  `;
  return {
    subject: `WhatsApp desconectado · ${etiquetaCuenta}`,
    html: layout({ titulo: "WhatsApp desconectado", cuerpo }),
  };
}

// ============================================================
// 7. Confirmación de suscripción al blog
// ============================================================

export function emailConfirmacionSuscripcion(
  nombre: string | null,
  urlConfirmar: string,
): { subject: string; html: string } {
  const cuerpo = `
    <h1 style="font-family: ${FONT_SERIF}; font-style: italic; font-weight: 400; font-size: 30px; line-height: 1.2; color: ${COLOR_TEXTO}; margin: 0 0 16px;">
      Confirmá tu suscripción.
    </h1>
    <p style="font-family: ${FONT_SANS}; font-size: 15px; line-height: 1.7; color: ${COLOR_TEXTO}; margin: 0 0 16px;">
      ${saludo(nombre)} Hacé clic para confirmar que querés recibir nuevos artículos del blog de Sass-CRM.
    </p>
    <p style="font-family: ${FONT_SANS}; font-size: 14px; line-height: 1.7; color: ${COLOR_TEXTO_TENUE}; margin: 0 0 8px;">
      Si no lo pediste vos, ignorá este email — no se tomará ninguna acción.
    </p>
    ${botonCTA(urlConfirmar, "Confirmar suscripción")}
  `;
  return {
    subject: "Confirmá tu suscripción al blog",
    html: layout({ titulo: "Confirmá tu suscripción", cuerpo }),
  };
}

// ============================================================
// 8. Nuevo artículo publicado — digest para suscriptores
// ============================================================

export function emailNuevoArticulo(
  titulo: string,
  resumen: string,
  urlArticulo: string,
  urlDesuscribir: string,
  autorNombre: string,
): { subject: string; html: string } {
  const cuerpo = `
    <p style="font-family: ${FONT_MONO}; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: ${COLOR_ACENTO}; margin: 0 0 12px;">
      Nuevo artículo
    </p>
    <h1 style="font-family: ${FONT_SERIF}; font-style: italic; font-weight: 400; font-size: 30px; line-height: 1.25; color: ${COLOR_TEXTO}; margin: 0 0 16px;">
      ${esc(titulo)}
    </h1>
    <p style="font-family: ${FONT_SANS}; font-size: 15px; line-height: 1.7; color: ${COLOR_TEXTO_TENUE}; margin: 0 0 8px;">
      ${esc(resumen)}
    </p>
    <p style="font-family: ${FONT_SANS}; font-size: 13px; color: ${COLOR_TEXTO_TENUE}; margin: 0 0 20px;">
      Por <span style="color: ${COLOR_TEXTO};">${esc(autorNombre)}</span>
    </p>
    ${botonCTA(urlArticulo, "Leer artículo")}
    <p style="font-family: ${FONT_SANS}; font-size: 11px; color: ${COLOR_TEXTO_TENUE}; margin: 24px 0 0;">
      Recibís este email porque te suscribiste al blog de Sass-CRM.
      <a href="${esc(urlDesuscribir)}" style="color: ${COLOR_ACENTO}; text-decoration: underline;">Cancelar suscripción</a>.
    </p>
  `;
  return {
    subject: `Nuevo artículo: ${titulo}`,
    html: layout({ titulo: esc(titulo), cuerpo }),
  };
}
