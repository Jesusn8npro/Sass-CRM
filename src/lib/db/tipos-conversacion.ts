
// Tipos de conversaciones, mensajes, conocimiento, etiquetas, etc.
import type { ModoConversacion, RolMensaje, TipoMensaje, TipoMediaBiblioteca, ValidezEmail, EstadoLead, DatosCapturados } from "./tipos-base";

export interface EtiquetaResumen {
  id: string;
  nombre: string;
  color: string;
}

export interface Conversacion {
  id: string;
  cuenta_id: string;
  telefono: string;
  jid_wa: string | null;
  nombre: string | null;
  modo: ModoConversacion;
  necesita_humano: boolean;
  etapa_id: string | null;
  ultimo_mensaje_en: string | null;
  ultimo_visto_operador_en: string | null;
  creada_en: string;
  lead_score: number;
  estado_lead: EstadoLead;
  paso_actual: string;
  datos_capturados: DatosCapturados;
}

export interface ConversacionConPreview extends Conversacion {
  vista_previa_ultimo_mensaje: string | null;
  /** Rol del último mensaje (para decidir prefix "Tu: " en la lista). */
  vista_previa_rol: RolMensaje | null;
  /** Cuántos mensajes del cliente (rol='usuario') llegaron DESPUÉS de
   * la última vez que el operador abrió esta conversación en el panel. */
  mensajes_nuevos: number;
  etiquetas: EtiquetaResumen[];
}

export interface Mensaje {
  id: string;
  cuenta_id: string;
  conversacion_id: string;
  rol: RolMensaje;
  tipo: TipoMensaje;
  contenido: string;
  media_path: string | null;
  creado_en: string;
  wa_msg_id: string | null;
}

export interface FilaBandejaSalida {
  id: string;
  cuenta_id: string;
  conversacion_id: string;
  telefono: string;
  tipo: TipoMensaje;
  contenido: string;
  media_path: string | null;
  enviado: boolean;
  creado_en: string;
}

// ============================================================
// Conocimiento / respuestas rápidas / etiquetas / biblioteca
// ============================================================

export interface EntradaConocimiento {
  id: string;
  cuenta_id: string;
  titulo: string;
  contenido: string;
  categoria: string;
  esta_activo: boolean;
  orden: number;
  creada_en: string;
  actualizada_en: string;
}

export interface RespuestaRapida {
  id: string;
  cuenta_id: string;
  atajo: string;
  texto: string;
  orden: number;
  creada_en: string;
  actualizada_en: string;
}

export interface Etiqueta {
  id: string;
  cuenta_id: string;
  nombre: string;
  color: string;
  descripcion: string | null;
  orden: number;
  creada_en: string;
}

export interface EtiquetaConCount extends Etiqueta {
  conversaciones_count: number;
}

export interface MedioBiblioteca {
  id: string;
  cuenta_id: string;
  identificador: string;
  tipo: TipoMediaBiblioteca;
  ruta_archivo: string;
  descripcion: string;
  creado_en: string;
}

export interface EtapaPipeline {
  id: string;
  cuenta_id: string;
  nombre: string;
  color: string;
  orden: number;
  /** Slug semántico que la IA usa para referirse al paso. Ej:
   * "bienvenida", "diagnostico_ia", "presentacion", "cierre". */
  paso_id: string | null;
  /** Slug del próximo paso (no UUID). NULL = fin del flujo. */
  paso_siguiente_id: string | null;
  /** Cuándo el agente debe avanzar al próximo paso. Texto natural. */
  criterio_transicion: string;
  /** Objetivos que se deben cumplir en este paso, separados por coma. */
  objetivos: string;
  descripcion: string;
  creada_en: string;
}

// ============================================================
// Contactos email / teléfono
// ============================================================

export interface ContactoEmail {
  id: string;
  cuenta_id: string;
  conversacion_id: string | null;
  email: string;
  validez: ValidezEmail;
  capturado_en: string;
}

export interface ContactoEmailConTelefono extends ContactoEmail {
  nombre_contacto: string | null;
  telefono: string | null;
}

export interface ContactoTelefono {
  id: string;
  cuenta_id: string;
  conversacion_id: string | null;
  telefono: string;
  capturado_en: string;
}

export interface ContactoTelefonoConContexto extends ContactoTelefono {
  nombre_contacto: string | null;
  telefono_conv: string | null;
}

// ============================================================
// Productos / interés / inversiones
// ============================================================

