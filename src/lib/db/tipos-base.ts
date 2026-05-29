/**
 * Tipos compartidos por toda la capa de acceso a datos.
 * IDs son UUIDs (string). Timestamps son strings ISO 8601 (timestamptz).
 */

// ============================================================
// Enums / unions
// ============================================================
export type ModoConversacion = "IA" | "HUMANO";
export type RolMensaje = "usuario" | "asistente" | "humano" | "sistema";
export type TipoMensaje =
  | "texto"
  | "audio"
  | "imagen"
  | "video"
  | "documento"
  | "sistema";
export type EstadoConexion =
  | "desconectado"
  | "qr"
  | "conectando"
  | "conectado";
export type EstadoLlamada =
  | "iniciando"
  | "sonando"
  | "en_curso"
  | "completada"
  | "sin_respuesta"
  | "fallida"
  | "finalizada";
export type ValidezEmail = "valido" | "sospechoso" | "invalido";
export type TipoMediaBiblioteca = "imagen" | "video" | "audio" | "documento";
export type EstadoSeguimiento =
  | "pendiente"
  | "enviado"
  | "cancelado"
  | "fallido";
export type EstadoCita =
  | "agendada"
  | "confirmada"
  | "realizada"
  | "cancelada"
  | "no_asistio";

export type EstadoLead =
  | "nuevo"
  | "contactado"
  | "calificado"
  | "interesado"
  | "negociacion"
  | "cerrado"
  | "perdido";

export type TipoNotificacion =
  | "cuenta_desconectada"
  | "cuenta_qr_listo"
  | "llamada_fallida"
  | "limite_plan_alcanzado"
  | "sistema";

export type EstadoLlamadaProgramada =
  | "pendiente"
  | "ejecutada"
  | "cancelada"
  | "fallida";

// ============================================================
// Captura de datos (campos custom + JSONB del cliente)
// ============================================================

/** Campo extra que el dueño quiere que la IA capture del cliente.
 * Se inyectan al prompt para guiar al agente. La IA los guarda en
 * datos_capturados.otros con la clave indicada. */
export interface CampoCaptura {
  clave: string; // slug interno: "ciudad", "presupuesto", "equipo"
  label: string; // visible en /clientes: "Ciudad", "Presupuesto"
  descripcion: string; // pista para la IA: "Ciudad donde vive el cliente"
  obligatorio: boolean;
  /** Pregunta natural sugerida que la IA usa como referencia para pedir
   * este dato. Ejemplo: "¿En qué ciudad estás organizando el evento?".
   * Si está vacía, la IA improvisa con la descripción. */
  pregunta_sugerida?: string;
  /** Orden de captura preferido por el dueño (1, 2, 3...). La IA usa
   * esto como guía de qué pedir primero. Default 100 = sin preferencia. */
  orden?: number;
}

/** Campos que la IA captura del cliente conversación a conversación.
 * Es JSONB libre — la IA puede agregar campos en `otros` cuando aparezcan
 * datos relevantes que no encajan en los predefinidos. */
export interface DatosCapturados {
  nombre?: string | null;
  email?: string | null;
  telefono_alt?: string | null;
  interes?: string | null;
  negocio?: string | null;
  ventajas?: string | null;
  miedos?: string | null;
  otros?: Record<string, string> | null;
}

// ============================================================
// Cuentas
// ============================================================

export interface Cuenta {
  id: string;
  usuario_id: string;
  etiqueta: string;
  telefono: string | null;
  estado: EstadoConexion;
  cadena_qr: string | null;
  ultimo_heartbeat: number | null;
  prompt_sistema: string;
  contexto_negocio: string;
  buffer_segundos: number;
  modelo: string | null;
  voz_elevenlabs: string | null;
  vapi_api_key: string | null;
  vapi_public_key: string | null;
  vapi_assistant_id: string | null;
  vapi_phone_id: string | null;
  vapi_webhook_secret: string | null;
  vapi_prompt_extra: string | null;
  vapi_primer_mensaje: string | null;
  vapi_max_segundos: number | null;
  vapi_grabar: boolean;
  vapi_sincronizado_en: string | null;
  campos_a_capturar: CampoCaptura[];
  // ===== Identidad y estilo del agente (estructurado) =====
  agente_nombre: string;
  agente_rol: string;
  agente_personalidad: string;
  agente_idioma: string;
  agente_tono:
    | "formal"
    | "casual_amigable"
    | "profesional"
    | "cercano"
    | "directo"
    | "consultivo";
  /** Estilo de respuesta:
   * - "mixto": principalmente texto + audios/imágenes ocasionales (default)
   * - "solo_texto": nunca audio, nunca media
   * - "solo_audio": siempre intenta nota de voz (requiere voz_elevenlabs)
   * - "espejo_voz": audio si el cliente envió audio, texto si el cliente escribió */
  modo_respuesta: "mixto" | "solo_texto" | "solo_audio" | "espejo_voz";
  // ===== Mensajes predefinidos =====
  mensaje_bienvenida: string;
  mensaje_no_entiende: string;
  /** Lista CSV de palabras/frases que activan handoff inmediato a humano. */
  palabras_handoff: string;
  // ===== Parámetros técnicos del modelo =====
  temperatura: number;
  max_tokens: number;
  instrucciones_extra: string;
  // ===== WhatsApp Business Cloud API (Meta) =====
  wa_phone_number_id: string | null;
  wa_business_account_id: string | null;
  wa_access_token: string | null;
  wa_verify_token: string | null;
  wa_app_secret: string | null;
  wa_estado: "desconectado" | "verificando" | "conectado" | "error";
  wa_verificada_en: string | null;
  wa_ultimo_error: string | null;
  esta_activa: boolean;
  esta_archivada: boolean;
  /** Si true, el procesador de auto-seguimientos puede agendar
   *  recordatorios para conversaciones de esta cuenta. Los pasos
   *  configurados viven en `auto_seguimientos_pasos`. */
  auto_seguimiento_activo: boolean;
  /** Segundos a esperar entre cada parte del agente. Default 3 = humano natural.
   *  Durante esa espera el bot muestra "escribiendo..." al cliente. */
  delay_entre_partes_segundos: number;
  /** Cantidad de mensajes recientes que se mandan al LLM como contexto literal.
   *  Default 20. Mensajes más viejos viven en resumen_contexto si memoria_largo_plazo=true. */
  mensajes_contexto: number;
  /** Si true, mantiene un resumen acumulativo (en conversaciones.resumen_contexto)
   *  de los mensajes anteriores a la ventana actual. Permite contexto de toda la
   *  conversación sin explotar tokens. */
  memoria_largo_plazo: boolean;
  /** Número WhatsApp personal del dueño donde el bot le manda alertas
   *  importantes y un resumen diario del negocio. Sin "+", ej: "573144096187". */
  telefono_operador_privado: string | null;
  /** Si true, recibe a las 9am un resumen del día anterior (mensajes,
   *  leads nuevos, citas, top productos). */
  operador_privado_resumen_diario: boolean;
  /** Si true, recibe alertas urgentes en tiempo real (lead score >=80,
   *  handoff a humano, cuenta caída). */
  operador_privado_alertas: boolean;
  /** Opt-in para emails transaccionales por Resend (bienvenida,
   *  reportes, cuenta caída). Billing va aparte. */
  notificaciones_email_activas: boolean;
  /** Si true (default), el agente prioriza respuestas naturales y
   *  conversacionales — evita frases robóticas, listas largas, formalidades. */
  responder_humanizado: boolean;
  /** Si true, el agente puede usar emojis con moderación. Si false (default),
   *  NUNCA usa emojis — tono más profesional. */
  usar_emojis: boolean;
  /** Si true, esta cuenta es el canal admin global del super-admin.
   *  El manejador Baileys solo procesa mensajes entrantes si el remitente
   *  está en `super_admins`; los demás se ignoran silenciosos. Permite
   *  tener un número WhatsApp dedicado al patrón sin exponer el bot a
   *  desconocidos. Migración 21. */
  es_panel_admin: boolean;
  /** Límites mensuales de gasto en USD por proveedor externo.
   *  Ej: { vapi: 50, openai: 30 }. 0 = sin límite. */
  limites_gasto: Record<string, number>;
  // ===== Supabase externo del negocio (migraciones 38/39) =====
  /** URL del proyecto Supabase del negocio del cliente. null = no conectado. */
  supabase_externo_url: string | null;
  /** service_role key CIFRADA (AES-256-GCM). Nunca exponer al cliente. */
  supabase_externo_service_key: string | null;
  supabase_externo_validado_en: string | null;
  /** Tablas descubiertas al validar la conexión. */
  supabase_externo_tablas: string[];
  /** Si el agente puede consultar la base externa al responder. */
  agente_bd_externa_habilitada: boolean;
  /** Subconjunto de supabase_externo_tablas que el agente puede leer. */
  agente_tablas_permitidas: string[];
  creada_en: string;
  actualizada_en: string;
}

// ============================================================
// Usuarios
// ============================================================

export interface UsuarioApp {
  id: string;
  email: string;
  nombre: string | null;
  plan: string; // free | pro | business — normalizar con planes.ts
  rol: string; // owner | admin | etc.
  creado_en: string;
  actualizada_en: string;
  estado_billing?: "activo" | "suspendido" | "impago" | "prueba";
  pasarela?: "paypal" | "epayco" | null;
  pasarela_customer_id?: string | null;
  paypal_subscription_id?: string | null;
  paypal_plan_id?: string | null;
  vence_en?: string | null;
  /** Cuentas WhatsApp extra otorgadas por el admin sobre el cupo del plan.
   *  Default 0. Solo el admin puede modificar. Límite efectivo del usuario
   *  = plan.limite_cuentas + cuentas_extra_admin. */
  cuentas_extra_admin?: number;
}
