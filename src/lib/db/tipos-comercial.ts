// Tipos comerciales: productos, inversiones, citas, llamadas, métricas.
import type {
  EstadoCita,
  EstadoLead,
  EstadoLlamada,
  EstadoLlamadaProgramada,
  EstadoSeguimiento,
  ModoConversacion,
  TipoNotificacion,
} from "./tipos-base";

export interface Producto {
  id: string;
  cuenta_id: string;
  nombre: string;
  descripcion: string;
  precio: number | null;
  moneda: string;
  costo: number | null;
  stock: number | null;
  sku: string | null;
  categoria: string | null;
  imagen_path: string | null;
  video_path: string | null;
  esta_activo: boolean;
  orden: number;
  creada_en: string;
  actualizada_en: string;
}

export interface InteresProducto {
  conversacion_id: string;
  producto_id: string;
  cuenta_id: string;
  ultimo_interes_en: string;
  veces: number;
}

export interface InteresConProducto extends InteresProducto {
  nombre: string;
  precio: number | null;
  moneda: string;
  imagen_path: string | null;
  stock: number | null;
}

export interface InteresadoEnProducto extends InteresProducto {
  nombre_contacto: string | null;
  telefono: string;
  modo: ModoConversacion;
  necesita_humano: boolean;
}

export interface ProductoTop {
  id: string;
  nombre: string;
  precio: number | null;
  moneda: string;
  stock: number | null;
  conversaciones_interesadas: number;
  total_menciones: number;
}

export interface Inversion {
  id: string;
  cuenta_id: string;
  concepto: string;
  monto: number;
  moneda: string;
  categoria: string | null;
  fecha: string;
  notas: string | null;
  creada_en: string;
}

export interface ResumenInversiones {
  por_moneda: Array<{ moneda: string; total: number; n: number }>;
  por_categoria: Array<{
    categoria: string;
    moneda: string;
    total: number;
    n: number;
  }>;
}

// ============================================================
// Seguimientos / citas / llamadas / assistants
// ============================================================

export interface SeguimientoProgramado {
  id: string;
  cuenta_id: string;
  conversacion_id: string;
  contenido: string;
  programado_para: string;
  estado: EstadoSeguimiento;
  origen: "humano" | "ia";
  razon_cancelacion: string | null;
  enviado_en: string | null;
  creado_en: string;
}

export interface SeguimientoConContacto extends SeguimientoProgramado {
  nombre_contacto: string | null;
  telefono: string | null;
}

export interface Cita {
  id: string;
  cuenta_id: string;
  conversacion_id: string | null;
  cliente_nombre: string;
  cliente_telefono: string | null;
  fecha_hora: string;
  duracion_min: number;
  tipo: string | null;
  estado: EstadoCita;
  notas: string | null;
  recordatorio_enviado: boolean;
  creada_en: string;
}

export interface LlamadaVapi {
  id: string;
  cuenta_id: string;
  conversacion_id: string | null;
  vapi_call_id: string;
  telefono: string;
  direccion: "saliente" | "entrante";
  estado: EstadoLlamada;
  transcripcion: string | null;
  resumen: string | null;
  audio_url: string | null;
  duracion_seg: number | null;
  costo_usd: number | null;
  iniciada_en: string;
  terminada_en: string | null;
}

export interface AssistantVapi {
  id: string;
  cuenta_id: string;
  nombre: string;
  vapi_assistant_id: string | null;
  prompt_extra: string;
  primer_mensaje: string;
  voz_elevenlabs: string | null;
  modelo: string;
  max_segundos: number;
  grabar: boolean;
  es_default: boolean;
  esta_activo: boolean;
  sincronizado_en: string | null;
  creado_en: string;
  actualizado_en: string;
}

export interface LlamadaProgramada {
  id: string;
  cuenta_id: string;
  conversacion_id: string | null;
  assistant_id: string | null;
  telefono_destino: string | null;
  motivo: string | null;
  origen: "humano" | "ia";
  programada_para: string;
  estado: EstadoLlamadaProgramada;
  llamada_vapi_id: string | null;
  razon_cancelacion: string | null;
  ejecutada_en: string | null;
  creada_en: string;
  actualizada_en: string;
}

export interface LlamadaProgramadaConContexto extends LlamadaProgramada {
  nombre_contacto: string | null;
  telefono_conv: string | null;
  assistant_nombre: string | null;
}

// ============================================================
// Notificaciones
// ============================================================

export interface NotificacionSistema {
  id: string;
  usuario_id: string;
  cuenta_id: string | null;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  metadata: Record<string, unknown> | null;
  leida: boolean;
  email_enviado: boolean;
  creada_en: string;
  leida_en: string | null;
}

// ============================================================
// Métricas (CRM dashboard)
// ============================================================

export interface MetricasCuenta {
  conversaciones_total: number;
  conversaciones_necesitan_humano: number;
  conversaciones_modo_ia: number;
  conversaciones_modo_humano: number;
  mensajes_total: number;
  mensajes_recibidos: number;
  mensajes_enviados_bot: number;
  mensajes_enviados_humano: number;
  mensajes_hoy: number;
  mensajes_ultimos_7d: number;
  emails_capturados: number;
  telefonos_capturados: number;
  productos_total: number;
  productos_sin_stock: number;
  inversiones_por_moneda: Array<{ moneda: string; total: number; n: number }>;
  productos_top: ProductoTop[];
  por_etapa: Array<{
    etapa_id: string | null;
    nombre: string;
    color: string;
    count: number;
  }>;
  por_etiqueta: Array<{
    etiqueta_id: string;
    nombre: string;
    color: string;
    count: number;
  }>;
  mensajes_por_dia: Array<{ dia: string; count: number }>;

  // ===== CRM / Lead tracking =====
  por_estado_lead: Array<{ estado: EstadoLead; count: number }>;
  lead_score_promedio: number;
  /** Leads en negociación o con score >= 75. Clientes a punto de cerrar. */
  casi_a_confirmar: number;
  /** cerrados / (cerrados + perdidos). 0 si no hay decisiones aún. */
  tasa_aceptacion: number;
  /** Conversaciones con `necesita_humano=true`. Lista corta clickeable. */
  conversaciones_atencion: Array<{
    conversacion_id: string;
    nombre: string;
    telefono: string;
    ultimo_mensaje_en: string | null;
    estado_lead: EstadoLead;
    lead_score: number;
  }>;

  // ===== Citas =====
  citas_total: number;
  citas_proximas_7d: number;
  citas_hoy: number;
  citas_realizadas: number;
  citas_canceladas: number;
  citas_no_asistio: number;
  /** realizadas / (realizadas + no_asistio + canceladas). */
  tasa_asistencia_citas: number;
}
