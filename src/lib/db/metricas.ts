import { db, lanzar } from "./cliente";
import { contarContactosEmail } from "./contactosEmail";
import { contarContactosTelefono } from "./contactosTelefono";
import { listarEtapas } from "./etapas";
import { listarEtiquetasConCount } from "./etiquetas";
import { listarTopProductos } from "./interesProducto";
import type {
  DatosCapturados,
  EstadoCita,
  EstadoLead,
  MetricasCuenta,
  ModoConversacion,
  RolMensaje,
} from "./tipos";

export async function obtenerMetricas(
  cuentaId: string,
): Promise<MetricasCuenta> {
  const ahora = new Date();
  const inicioHoy = new Date(ahora);
  inicioHoy.setHours(0, 0, 0, 0);
  const inicio7d = new Date(ahora.getTime() - 7 * 86400 * 1000);

  // Conversaciones (incluye lead tracking)
  const { data: convs, error: errConvs } = await db()
    .from("conversaciones")
    .select(
      "id, telefono, nombre, modo, necesita_humano, etapa_id, estado_lead, lead_score, ultimo_mensaje_en, datos_capturados",
    )
    .eq("cuenta_id", cuentaId);
  if (errConvs) lanzar(errConvs, "obtenerMetricas.convs");
  const arrConvs = (convs ?? []) as Array<{
    id: string;
    telefono: string;
    nombre: string | null;
    modo: ModoConversacion;
    necesita_humano: boolean;
    etapa_id: string | null;
    estado_lead: EstadoLead;
    lead_score: number;
    ultimo_mensaje_en: string | null;
    datos_capturados: DatosCapturados;
  }>;

  // Mensajes
  const { data: msgs } = await db()
    .from("mensajes")
    .select("rol, creado_en")
    .eq("cuenta_id", cuentaId);
  const arrMsgs = (msgs ?? []) as Array<{ rol: RolMensaje; creado_en: string }>;

  // Etapas + count por etapa
  const etapas = await listarEtapas(cuentaId);
  const conteoEtapa = new Map<string | null, number>();
  for (const c of arrConvs) {
    const k = c.etapa_id ?? null;
    conteoEtapa.set(k, (conteoEtapa.get(k) ?? 0) + 1);
  }
  const sinEtapa = conteoEtapa.get(null) ?? 0;
  const por_etapa = [
    ...(sinEtapa > 0
      ? [{ etapa_id: null, nombre: "Sin asignar", color: "zinc", count: sinEtapa }]
      : []),
    ...etapas.map((e) => ({
      etapa_id: e.id,
      nombre: e.nombre,
      color: e.color,
      count: conteoEtapa.get(e.id) ?? 0,
    })),
  ];

  // Etiquetas con count
  const etiqAr = await listarEtiquetasConCount(cuentaId);
  const por_etiqueta = etiqAr.map((e) => ({
    etiqueta_id: e.id,
    nombre: e.nombre,
    color: e.color,
    count: e.conversaciones_count,
  }));

  // Mensajes por día (últimos 7)
  const porDia = new Map<string, number>();
  for (const m of arrMsgs) {
    const d = new Date(m.creado_en);
    if (d < inicio7d) continue;
    const key = d.toISOString().slice(0, 10);
    porDia.set(key, (porDia.get(key) ?? 0) + 1);
  }
  const mensajes_por_dia = Array.from(porDia.entries())
    .map(([dia, count]) => ({ dia, count }))
    .sort((a, b) => a.dia.localeCompare(b.dia));

  // Inversiones por moneda
  const { data: invs } = await db()
    .from("inversiones")
    .select("monto, moneda")
    .eq("cuenta_id", cuentaId);
  const invsMap = new Map<string, { total: number; n: number }>();
  for (const r of (invs ?? []) as Array<{ monto: number; moneda: string }>) {
    const cur = invsMap.get(r.moneda) ?? { total: 0, n: 0 };
    cur.total += Number(r.monto);
    cur.n += 1;
    invsMap.set(r.moneda, cur);
  }

  // Productos
  const { data: prods } = await db()
    .from("productos")
    .select("esta_activo, stock")
    .eq("cuenta_id", cuentaId);
  const productosTotal = (prods ?? []).length;
  const productosSinStock = (
    (prods ?? []) as Array<{ esta_activo: boolean; stock: number | null }>
  ).filter((p) => p.esta_activo && p.stock !== null && p.stock <= 0).length;

  // ===== CRM: distribución por estado del lead =====
  const ESTADOS_LEAD: EstadoLead[] = [
    "nuevo",
    "contactado",
    "calificado",
    "interesado",
    "negociacion",
    "cerrado",
    "perdido",
  ];
  const conteoEstado = new Map<EstadoLead, number>();
  for (const c of arrConvs) {
    const e = (c.estado_lead ?? "nuevo") as EstadoLead;
    conteoEstado.set(e, (conteoEstado.get(e) ?? 0) + 1);
  }
  const por_estado_lead = ESTADOS_LEAD.map((estado) => ({
    estado,
    count: conteoEstado.get(estado) ?? 0,
  }));

  const scoreSum = arrConvs.reduce((acc, c) => acc + (c.lead_score ?? 0), 0);
  const lead_score_promedio =
    arrConvs.length > 0 ? Math.round(scoreSum / arrConvs.length) : 0;

  const casi_a_confirmar = arrConvs.filter(
    (c) => c.estado_lead === "negociacion" || (c.lead_score ?? 0) >= 75,
  ).length;

  const cerrados = conteoEstado.get("cerrado") ?? 0;
  const perdidos = conteoEstado.get("perdido") ?? 0;
  const tasa_aceptacion =
    cerrados + perdidos > 0
      ? Math.round((cerrados / (cerrados + perdidos)) * 100)
      : 0;

  // Top 10 conversaciones que necesitan atención humana
  const conversaciones_atencion = arrConvs
    .filter((c) => c.necesita_humano)
    .map((c) => ({
      conversacion_id: c.id,
      nombre: c.datos_capturados?.nombre?.trim() || c.nombre || `+${c.telefono}`,
      telefono: c.telefono,
      ultimo_mensaje_en: c.ultimo_mensaje_en,
      estado_lead: (c.estado_lead ?? "nuevo") as EstadoLead,
      lead_score: c.lead_score ?? 0,
    }))
    .sort((a, b) => {
      const ta = a.ultimo_mensaje_en ? new Date(a.ultimo_mensaje_en).getTime() : 0;
      const tb = b.ultimo_mensaje_en ? new Date(b.ultimo_mensaje_en).getTime() : 0;
      return tb - ta;
    })
    .slice(0, 10);

  // ===== Citas =====
  const en7d = new Date(ahora.getTime() + 7 * 86400 * 1000);
  const { data: citasData } = await db()
    .from("citas")
    .select("estado, fecha_hora")
    .eq("cuenta_id", cuentaId);
  const citas = (citasData ?? []) as Array<{
    estado: EstadoCita;
    fecha_hora: string;
  }>;
  const citas_total = citas.length;
  const citas_proximas_7d = citas.filter((c) => {
    const f = new Date(c.fecha_hora);
    return (
      f >= ahora &&
      f <= en7d &&
      (c.estado === "agendada" || c.estado === "confirmada")
    );
  }).length;
  const citas_hoy = citas.filter((c) => {
    const f = new Date(c.fecha_hora);
    return (
      f >= inicioHoy &&
      f < new Date(inicioHoy.getTime() + 86400 * 1000) &&
      c.estado !== "cancelada"
    );
  }).length;
  const citas_realizadas = citas.filter((c) => c.estado === "realizada").length;
  const citas_canceladas = citas.filter((c) => c.estado === "cancelada").length;
  const citas_no_asistio = citas.filter((c) => c.estado === "no_asistio").length;
  const tasa_asistencia_citas =
    citas_realizadas + citas_canceladas + citas_no_asistio > 0
      ? Math.round(
          (citas_realizadas /
            (citas_realizadas + citas_canceladas + citas_no_asistio)) *
            100,
        )
      : 0;

  return {
    conversaciones_total: arrConvs.length,
    conversaciones_necesitan_humano: arrConvs.filter((c) => c.necesita_humano)
      .length,
    conversaciones_modo_ia: arrConvs.filter((c) => c.modo === "IA").length,
    conversaciones_modo_humano: arrConvs.filter((c) => c.modo === "HUMANO")
      .length,
    mensajes_total: arrMsgs.length,
    mensajes_recibidos: arrMsgs.filter((m) => m.rol === "usuario").length,
    mensajes_enviados_bot: arrMsgs.filter((m) => m.rol === "asistente").length,
    mensajes_enviados_humano: arrMsgs.filter((m) => m.rol === "humano").length,
    mensajes_hoy: arrMsgs.filter((m) => new Date(m.creado_en) >= inicioHoy)
      .length,
    mensajes_ultimos_7d: arrMsgs.filter(
      (m) => new Date(m.creado_en) >= inicio7d,
    ).length,
    emails_capturados: await contarContactosEmail(cuentaId),
    telefonos_capturados: await contarContactosTelefono(cuentaId),
    productos_total: productosTotal,
    productos_sin_stock: productosSinStock,
    inversiones_por_moneda: Array.from(invsMap.entries()).map(
      ([moneda, v]) => ({ moneda, total: v.total, n: v.n }),
    ),
    productos_top: await listarTopProductos(cuentaId, 5),
    por_etapa,
    por_etiqueta,
    mensajes_por_dia,
    por_estado_lead,
    lead_score_promedio,
    casi_a_confirmar,
    tasa_aceptacion,
    conversaciones_atencion,
    citas_total,
    citas_proximas_7d,
    citas_hoy,
    citas_realizadas,
    citas_canceladas,
    citas_no_asistio,
    tasa_asistencia_citas,
  };
}
