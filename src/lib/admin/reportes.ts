/**
 * Métricas globales del SaaS para el super-admin.
 *
 * A diferencia de `src/lib/db/metricas.ts` (que es POR CUENTA),
 * estas funciones agregan datos de TODA la plataforma.
 *
 * Resultados crudos en objetos — el formateo a texto WhatsApp
 * vive en `reportesFormato.ts`.
 */
import { db } from "@/lib/db/cliente";

export interface MetricasGlobales {
  /** Total de usuarios registrados en el SaaS */
  usuarios_total: number;
  /** Usuarios que tienen al menos 1 cuenta no archivada */
  usuarios_con_cuenta: number;
  /** Usuarios nuevos en las últimas 24h */
  usuarios_nuevos_24h: number;

  /** Cuentas WhatsApp totales no archivadas */
  cuentas_total: number;
  /** Cuentas con bot activo (esta_activa = true) */
  cuentas_activas: number;
  /** Cuentas con heartbeat reciente (< 60s) → bot vivo */
  cuentas_conectadas: number;
  /** Cuentas con heartbeat caído > 30 min → posible falla */
  cuentas_caidas: number;

  /** Mensajes intercambiados en las últimas 24h (total plataforma) */
  mensajes_24h: number;
  /** Conversaciones activas (con mensaje en las últimas 24h) */
  conversaciones_activas_24h: number;
  /** Conversaciones en modo HUMANO (esperando atención) */
  conversaciones_en_humano: number;

  /** Créditos totales consumidos en las últimas 24h (todas las cuentas) */
  creditos_consumidos_24h: number;
  /** USD facturado este mes (suma de pagos exitosos) */
  ingresos_mes_usd: number;
  /** Pagos exitosos este mes */
  pagos_mes_count: number;

  /** Citas agendadas en las últimas 24h */
  citas_agendadas_24h: number;
  /** Leads nuevos extraídos por Apify en últimas 24h */
  leads_apify_24h: number;
}

const SEG_24H = 24 * 60 * 60;
const MS_30MIN = 30 * 60 * 1000;

/**
 * Calcula todas las métricas globales del SaaS. Hace múltiples
 * queries en paralelo para minimizar latencia.
 */
export async function obtenerMetricasGlobales(): Promise<MetricasGlobales> {
  const ahora = Date.now();
  const hace24h = new Date(ahora - 24 * 60 * 60 * 1000).toISOString();
  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);
  const inicioMesIso = inicioMes.toISOString();
  const heartbeatVivoSeg = Math.floor(ahora / 1000) - 60;
  const heartbeatCaidoSeg = Math.floor((ahora - MS_30MIN) / 1000);

  const [
    usuariosRes,
    cuentasRes,
    mensajesRes,
    convsActivasRes,
    convsHumanoRes,
    creditosRes,
    pagosRes,
    citasRes,
    leadsRes,
    usuariosNuevosRes,
    usuariosConCuentaRes,
  ] = await Promise.all([
    db().from("usuarios").select("id", { count: "exact", head: true }),
    db()
      .from("cuentas")
      .select("esta_activa, ultimo_heartbeat", { count: "exact" })
      .eq("esta_archivada", false),
    db()
      .from("mensajes")
      .select("id", { count: "exact", head: true })
      .gte("creado_en", hace24h),
    db()
      .from("conversaciones")
      .select("id", { count: "exact", head: true })
      .gte("ultimo_mensaje_en", hace24h),
    db()
      .from("conversaciones")
      .select("id", { count: "exact", head: true })
      .eq("modo", "HUMANO"),
    db()
      .from("uso_creditos")
      .select("creditos")
      .gte("creado_en", hace24h),
    db()
      .from("pagos")
      .select("monto_usd, estado")
      .eq("estado", "completado")
      .gte("creado_en", inicioMesIso),
    db()
      .from("citas")
      .select("id", { count: "exact", head: true })
      .gte("creada_en", hace24h),
    db()
      .from("leads_extraidos")
      .select("id", { count: "exact", head: true })
      .gte("creado_en", hace24h),
    db()
      .from("usuarios")
      .select("id", { count: "exact", head: true })
      .gte("creado_en", hace24h),
    db()
      .from("cuentas")
      .select("usuario_id")
      .eq("esta_archivada", false),
  ]);

  // Cuentas: separar activas / conectadas / caídas según heartbeat
  const cuentasData = (cuentasRes.data ?? []) as Array<{
    esta_activa: boolean;
    ultimo_heartbeat: number | null;
  }>;
  const cuentasActivas = cuentasData.filter((c) => c.esta_activa).length;
  const cuentasConectadas = cuentasData.filter(
    (c) => c.esta_activa && (c.ultimo_heartbeat ?? 0) >= heartbeatVivoSeg,
  ).length;
  const cuentasCaidas = cuentasData.filter(
    (c) => c.esta_activa && (c.ultimo_heartbeat ?? 0) < heartbeatCaidoSeg,
  ).length;

  // Créditos consumidos: sumar columna
  const creditosArr = (creditosRes.data ?? []) as Array<{ creditos: number }>;
  const creditosConsumidos = creditosArr.reduce(
    (acc, r) => acc + (r.creditos ?? 0),
    0,
  );

  // Pagos del mes
  const pagosArr = (pagosRes.data ?? []) as Array<{ monto_usd: number }>;
  const ingresosMes = pagosArr.reduce(
    (acc, p) => acc + Number(p.monto_usd ?? 0),
    0,
  );

  // Usuarios con cuenta: dedup
  const conCuentaArr = (usuariosConCuentaRes.data ?? []) as Array<{
    usuario_id: string;
  }>;
  const usuariosConCuenta = new Set(conCuentaArr.map((c) => c.usuario_id)).size;

  return {
    usuarios_total: usuariosRes.count ?? 0,
    usuarios_con_cuenta: usuariosConCuenta,
    usuarios_nuevos_24h: usuariosNuevosRes.count ?? 0,
    cuentas_total: cuentasRes.count ?? 0,
    cuentas_activas: cuentasActivas,
    cuentas_conectadas: cuentasConectadas,
    cuentas_caidas: cuentasCaidas,
    mensajes_24h: mensajesRes.count ?? 0,
    conversaciones_activas_24h: convsActivasRes.count ?? 0,
    conversaciones_en_humano: convsHumanoRes.count ?? 0,
    creditos_consumidos_24h: creditosConsumidos,
    ingresos_mes_usd: ingresosMes,
    pagos_mes_count: pagosArr.length,
    citas_agendadas_24h: citasRes.count ?? 0,
    leads_apify_24h: leadsRes.count ?? 0,
  };
}

/**
 * Lista de cuentas caídas (heartbeat > 30 min) para alertas.
 * Devuelve datos suficientes para que el admin sepa a quién contactar.
 */
export async function listarCuentasCaidas(): Promise<
  Array<{
    cuenta_id: string;
    etiqueta: string;
    telefono: string | null;
    usuario_email: string;
    minutos_sin_heartbeat: number;
  }>
> {
  const ahora = Math.floor(Date.now() / 1000);
  const limiteSeg = ahora - 30 * 60;

  const { data, error } = await db()
    .from("cuentas")
    .select(
      "id, etiqueta, telefono, ultimo_heartbeat, usuario_id, usuarios:usuario_id(email)",
    )
    .eq("esta_archivada", false)
    .eq("esta_activa", true)
    .lt("ultimo_heartbeat", limiteSeg);
  if (error) {
    console.error("[reportes] error listarCuentasCaidas:", error);
    return [];
  }
  void SEG_24H; // referencia para evitar warning de constante no usada

  const arr = (data ?? []) as Array<{
    id: string;
    etiqueta: string;
    telefono: string | null;
    ultimo_heartbeat: number | null;
    usuarios: { email: string } | { email: string }[] | null;
  }>;
  return arr.map((c) => {
    const u = Array.isArray(c.usuarios) ? c.usuarios[0] : c.usuarios;
    const segSinHeartbeat = c.ultimo_heartbeat
      ? ahora - c.ultimo_heartbeat
      : 999_999;
    return {
      cuenta_id: c.id,
      etiqueta: c.etiqueta,
      telefono: c.telefono,
      usuario_email: u?.email ?? "?",
      minutos_sin_heartbeat: Math.floor(segSinHeartbeat / 60),
    };
  });
}
