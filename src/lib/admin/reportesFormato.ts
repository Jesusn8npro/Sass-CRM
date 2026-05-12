/**
 * Formateo a texto WhatsApp de los reportes admin.
 *
 * El formato es markdown-light: WhatsApp soporta *negrita*, _cursiva_,
 * ~tachado~, ```código```, y emojis. Mantenemos los textos cortos y
 * escaneables — el admin los lee en el cel.
 */
import type { MetricasGlobales } from "./reportes";

function fmtFecha(): string {
  const d = new Date();
  // dd/mm/yyyy
  return `${String(d.getDate()).padStart(2, "0")}/${String(
    d.getMonth() + 1,
  ).padStart(2, "0")}/${d.getFullYear()}`;
}

function fmtUsd(n: number): string {
  return `$${n.toFixed(2)} USD`;
}

/**
 * Reporte diario completo — el que llega cada mañana a las 9am.
 * Mantenelo escaneable: lo lee el admin en el cel.
 */
export function formatearReporteDiario(m: MetricasGlobales): string {
  const lineas: string[] = [];
  lineas.push(`📊 *Reporte diario · ${fmtFecha()}*`);
  lineas.push("");

  lineas.push(`👥 *Usuarios*`);
  lineas.push(`  • Total: ${m.usuarios_total}`);
  lineas.push(`  • Con cuenta WA: ${m.usuarios_con_cuenta}`);
  if (m.usuarios_nuevos_24h > 0) {
    lineas.push(`  • ✨ Nuevos hoy: ${m.usuarios_nuevos_24h}`);
  }
  lineas.push("");

  lineas.push(`📱 *Cuentas WhatsApp*`);
  lineas.push(`  • Total: ${m.cuentas_total}`);
  lineas.push(`  • Activas: ${m.cuentas_activas}`);
  lineas.push(`  • 🟢 Conectadas: ${m.cuentas_conectadas}`);
  if (m.cuentas_caidas > 0) {
    lineas.push(`  • 🔴 *Caídas: ${m.cuentas_caidas}* (revisar)`);
  }
  lineas.push("");

  lineas.push(`💬 *Actividad 24h*`);
  lineas.push(`  • Mensajes: ${m.mensajes_24h}`);
  lineas.push(`  • Conversaciones activas: ${m.conversaciones_activas_24h}`);
  if (m.conversaciones_en_humano > 0) {
    lineas.push(`  • ⚠ Esperando humano: ${m.conversaciones_en_humano}`);
  }
  lineas.push(`  • Citas agendadas: ${m.citas_agendadas_24h}`);
  lineas.push(`  • Leads Apify nuevos: ${m.leads_apify_24h}`);
  lineas.push("");

  lineas.push(`💰 *Negocio*`);
  lineas.push(`  • Créditos consumidos 24h: ${m.creditos_consumidos_24h}`);
  lineas.push(`  • Pagos del mes: ${m.pagos_mes_count}`);
  lineas.push(`  • Facturado mes: *${fmtUsd(m.ingresos_mes_usd)}*`);
  lineas.push("");

  lineas.push(`_Escribí /ayuda para ver comandos disponibles._`);

  return lineas.join("\n");
}

/**
 * Reporte corto de usuarios (respuesta a /usuarios).
 */
export function formatearUsuarios(m: MetricasGlobales): string {
  return [
    `👥 *Usuarios del SaaS*`,
    ``,
    `Total registrados: *${m.usuarios_total}*`,
    `Con al menos 1 cuenta WA: *${m.usuarios_con_cuenta}*`,
    `Nuevos en 24h: *${m.usuarios_nuevos_24h}*`,
  ].join("\n");
}

/**
 * Reporte corto de cuentas (respuesta a /cuentas).
 */
export function formatearCuentas(m: MetricasGlobales): string {
  const lineas: string[] = [
    `📱 *Cuentas WhatsApp*`,
    ``,
    `Total: *${m.cuentas_total}*`,
    `Activas: *${m.cuentas_activas}*`,
    `🟢 Conectadas: *${m.cuentas_conectadas}*`,
  ];
  if (m.cuentas_caidas > 0) {
    lineas.push(`🔴 *Caídas (>30min):* ${m.cuentas_caidas}`);
    lineas.push(``);
    lineas.push(`Escribí /alertas para ver detalle de cuentas caídas.`);
  }
  return lineas.join("\n");
}

/**
 * Reporte corto de ingresos (respuesta a /ingresos).
 */
export function formatearIngresos(m: MetricasGlobales): string {
  return [
    `💰 *Ingresos del mes*`,
    ``,
    `Facturado: *${fmtUsd(m.ingresos_mes_usd)}*`,
    `Pagos exitosos: *${m.pagos_mes_count}*`,
    `Créditos consumidos 24h: *${m.creditos_consumidos_24h}*`,
  ].join("\n");
}

/**
 * Lista de cuentas caídas (respuesta a /alertas).
 */
export function formatearAlertas(
  caidas: Array<{
    etiqueta: string;
    telefono: string | null;
    usuario_email: string;
    minutos_sin_heartbeat: number;
  }>,
): string {
  if (caidas.length === 0) {
    return `✅ *Todo bien*\n\nNo hay cuentas caídas en este momento.`;
  }
  const lineas: string[] = [
    `🔴 *Cuentas caídas (${caidas.length})*`,
    ``,
  ];
  for (const c of caidas.slice(0, 15)) {
    lineas.push(
      `• *${c.etiqueta}* (+${c.telefono ?? "?"})\n  ${c.usuario_email} · sin heartbeat hace ${c.minutos_sin_heartbeat} min`,
    );
  }
  if (caidas.length > 15) {
    lineas.push(`\n_…y ${caidas.length - 15} más. Ver en /admin._`);
  }
  return lineas.join("\n");
}

/**
 * Ayuda — lista de comandos disponibles (respuesta a /ayuda o comando
 * desconocido).
 */
export function formatearAyuda(): string {
  return [
    `🤖 *Comandos disponibles*`,
    ``,
    `📊 *Métricas*`,
    `/reporte  → Reporte completo del día`,
    `/usuarios → Resumen de usuarios`,
    `/cuentas  → Estado de números WA`,
    `/ingresos → Facturación del mes`,
    `/alertas  → Cuentas caídas`,
    ``,
    `📰 *Blog SEO*`,
    `/post <tema>            → Artículo + imágenes auto (recomendado)`,
    `/post-rapido <tema>     → Artículo + solo portada (más barato)`,
    `/post-completo <tema>   → Artículo + portada + 2 imágenes inline`,
    `/borradores             → Ver borradores pendientes`,
    `/publicar <id>          → Publicar un borrador`,
    ``,
    `🆘 /ayuda → Esta lista`,
    ``,
    `_Más comandos (videos automáticos, noticias IA, redes sociales) llegan en próximas fases._`,
  ].join("\n");
}
