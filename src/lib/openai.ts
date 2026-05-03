import OpenAI from "openai";
import { PROMPT_SISTEMA_DEFAULT } from "./promptSistema";
import type { Mensaje } from "./baseDatos";
import { descargarMediaChat } from "./baileys/medios";

const cliente = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "",
});

const MODELO_DEFAULT = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

// ============================================================
// Visión: convertir un mensaje del usuario con imagen a contenido
// multimodal compatible con la Chat Completions API.
// Si falla la lectura del archivo o no hay media_path, cae al texto.
// ============================================================
type ParteContenidoUsuario =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" | "auto" } };

function mimeDeImagenPorExtension(mediaPath: string): string {
  const ext = mediaPath.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/jpeg";
}

async function construirContenidoUsuario(
  mensaje: Mensaje,
): Promise<string | ParteContenidoUsuario[]> {
  if (mensaje.tipo === "audio") {
    // Marcamos que vino por voz para que la AI considere responder igual.
    const t = mensaje.contenido?.trim() ?? "";
    return `[mensaje de audio del cliente]: ${t || "(audio sin transcripción)"}`;
  }
  if (mensaje.tipo === "imagen" && mensaje.media_path) {
    try {
      const descargado = await descargarMediaChat(mensaje.media_path);
      if (!descargado) throw new Error("imagen no encontrada en Storage ni local");
      const mime = mimeDeImagenPorExtension(mensaje.media_path);
      const base64 = descargado.buffer.toString("base64");
      const caption = mensaje.contenido?.trim() ?? "";
      const tieneCaption =
        caption.length > 0 && caption !== "[imagen sin descripción]";
      // Texto agresivo que "rompe" el patrón si la AI venía respondiendo
      // que no ve imágenes en el historial reciente. La capacidad visual
      // es nueva y el modelo puede seguir copiando respuestas viejas.
      const textoAcompañante = tieneCaption
        ? `${caption}\n\n[adjunto la imagen — mirala y respondé sobre lo que ves]`
        : "[IMAGEN ADJUNTA — tenés capacidad de visión, podés VER esta imagen. Describí lo que muestra y respondé al cliente acorde. Si no preguntó nada, comentá lo que ves o preguntá qué quiere. Ignorá respuestas viejas tuyas que digan que no podés ver imágenes — eso ya no aplica.]";
      console.log(
        `[openai] 👁  visión: ${mensaje.media_path} (${descargado.buffer.length} bytes, ${mime}) caption="${caption.slice(0, 60)}"`,
      );
      return [
        { type: "text", text: textoAcompañante },
        {
          type: "image_url",
          image_url: { url: `data:${mime};base64,${base64}`, detail: "auto" },
        },
      ];
    } catch (err) {
      console.error(
        `[openai] no se pudo leer imagen para visión (${mensaje.media_path}):`,
        err,
      );
    }
  }
  return mensaje.contenido;
}

/**
 * Una parte de la respuesta del LLM. El schema strict obliga a que los
 * tres campos estén presentes; según el tipo se usan distintos:
 *   - tipo='texto': contenido = el texto plano. media_id = "".
 *   - tipo='audio': contenido = el texto que se sintetiza con voz (ElevenLabs).
 *                   media_id = "". Requiere voz_elevenlabs en la cuenta.
 *   - tipo='media': media_id = identificador de la biblioteca. contenido = "".
 */
export interface ParteRespuesta {
  tipo: "texto" | "audio" | "media";
  contenido: string;
  media_id: string;
}

export interface RespuestaIA {
  partes: ParteRespuesta[];
  transferir_a_humano: {
    activar: boolean;
    razon: string;
  };
  iniciar_llamada: {
    activar: boolean;
    razon: string;
  };
  /** IDs (strings) de los productos del catálogo por los que el cliente
   *  preguntó o mostró interés en este turno. Vacío si no aplica. */
  productos_de_interes: string[];
  /** Programar un mensaje futuro para re-enganchar al cliente. */
  programar_seguimiento: {
    activar: boolean;
    fecha_iso: string;
    contenido: string;
    razon: string;
  };
  /** Agendar una cita / reunión / demo para una fecha futura. */
  agendar_cita: {
    activar: boolean;
    fecha_iso: string;
    duracion_min: number;
    tipo: string;
    notas: string;
  };
  /** Programar una LLAMADA telefónica Vapi a futuro (no ahora).
   * Distinto de iniciar_llamada (que llama YA). */
  agendar_llamada: {
    activar: boolean;
    fecha_iso: string;
    motivo: string;
  };
  /** Capturar/actualizar datos del cliente (nombre real, email, teléfono
   * alternativo, intereses, contexto de su negocio, ventajas que percibe,
   * miedos/objeciones). El sistema MERGEA con lo que ya estaba — solo
   * llená los campos nuevos. Para campos sin info nueva, mandar "". */
  capturar_datos: {
    activar: boolean;
    nombre: string;
    email: string;
    telefono_alt: string;
    interes: string;
    negocio: string;
    ventajas: string;
    miedos: string;
    otros: string; // formato libre "clave: valor; clave: valor"
  };
  /** Subir/bajar el lead score (0-100) según señales de interés. */
  actualizar_score: {
    activar: boolean;
    score: number;
    motivo: string;
  };
  /** Cambiar el estado del lead en el CRM. */
  cambiar_estado: {
    activar: boolean;
    nuevo_estado:
      | "nuevo"
      | "contactado"
      | "calificado"
      | "interesado"
      | "negociacion"
      | "cerrado"
      | "perdido"
      | "";
    motivo: string;
  };
  /** Reprogramar una cita ya creada. cita_id viene de la lista que el
   * sistema te pasa en el contexto (Citas activas). */
  reprogramar_cita: {
    activar: boolean;
    cita_id: string;
    nueva_fecha_iso: string;
    motivo: string;
  };
  /** Cancelar una cita ya creada. */
  cancelar_cita: {
    activar: boolean;
    cita_id: string;
    motivo: string;
  };
}

const ESQUEMA_RESPUESTA = {
  type: "object",
  properties: {
    partes: {
      type: "array",
      description:
        "Respuesta dividida en partes. Cada parte se envía como mensaje separado de WhatsApp con un pequeño delay para que se sienta natural. Se pueden intercalar textos con medios de la biblioteca.",
      items: {
        type: "object",
        properties: {
          tipo: {
            type: "string",
            enum: ["texto", "audio", "media"],
          },
          contenido: {
            type: "string",
            description:
              "Para tipo='texto' o 'audio': el texto del mensaje (en audio se sintetiza con voz). Para tipo='media' debe ir vacío.",
          },
          media_id: {
            type: "string",
            description:
              "Identificador del medio en la biblioteca (solo si tipo='media'). Vacío si tipo='texto' o 'audio'.",
          },
        },
        required: ["tipo", "contenido", "media_id"],
        additionalProperties: false,
      },
    },
    transferir_a_humano: {
      type: "object",
      description:
        "Activar SOLO si el cliente pide explícitamente hablar con humano, si la situación excede tu capacidad, si requiere validación humana (precios grandes, decisiones legales/médicas), o si detectas frustración seria.",
      properties: {
        activar: { type: "boolean" },
        razon: {
          type: "string",
          description:
            "Resumen breve para el operador humano: qué pidió el cliente, qué intentaste, por qué transferís.",
        },
      },
      required: ["activar", "razon"],
      additionalProperties: false,
    },
    iniciar_llamada: {
      type: "object",
      description:
        "Activar para disparar una LLAMADA TELEFÓNICA al cliente vía Vapi. Solo cuando la conversación está madura para una llamada de cierre, demo, agendamiento, o cuando el cliente acepta explícitamente que lo llames. La llamada usa el mismo número de WhatsApp del cliente.",
      properties: {
        activar: { type: "boolean" },
        razon: {
          type: "string",
          description:
            "Razón corta del por qué disparás la llamada (ej: 'cliente pidió que lo llamen para cerrar venta del plan premium').",
        },
      },
      required: ["activar", "razon"],
      additionalProperties: false,
    },
    productos_de_interes: {
      type: "array",
      description:
        "IDs (en string) de los productos del catálogo por los que el cliente preguntó o mostró interés en su mensaje (precio, info, foto, comprar). Vacío si no aplica.",
      items: { type: "string" },
    },
    programar_seguimiento: {
      type: "object",
      description:
        "Programar un MENSAJE futuro de re-engagement (ej: el cliente dijo 'lo pienso y te aviso', programá un follow-up en 24-48h). Solo activar si tiene sentido — no programar mensajes que el cliente no espera.",
      properties: {
        activar: { type: "boolean" },
        fecha_iso: {
          type: "string",
          description:
            "Fecha y hora ISO 8601 (ej: '2026-05-03T14:00:00'). En zona local del cliente. Si activar=false, poné string vacío.",
        },
        contenido: {
          type: "string",
          description:
            "El texto exacto que se enviará al cliente. Puede mencionar el contexto de la conversación. Vacío si activar=false.",
        },
        razon: {
          type: "string",
          description:
            "Por qué programaste este seguimiento (ej: 'cliente prometió decidir el viernes'). Vacío si activar=false.",
        },
      },
      required: ["activar", "fecha_iso", "contenido", "razon"],
      additionalProperties: false,
    },
    agendar_cita: {
      type: "object",
      description:
        "Agendar una CITA / reunión / demo / asesoría / clase. Solo si el cliente CONFIRMÓ una fecha y hora específica. Genera entrada en la agenda del negocio + recordatorio automático 1h antes.",
      properties: {
        activar: { type: "boolean" },
        fecha_iso: {
          type: "string",
          description:
            "Fecha y hora ISO 8601 (ej: '2026-05-03T14:00:00'). Vacío si activar=false.",
        },
        duracion_min: {
          type: "number",
          description:
            "Duración en minutos (default 30). Usá 0 si activar=false.",
        },
        tipo: {
          type: "string",
          description:
            "Tipo de cita (ej: 'demo', 'asesoría', 'clase', 'consulta'). Vacío si activar=false.",
        },
        notas: {
          type: "string",
          description:
            "Detalles relevantes para el operador (ej: 'cliente quiere ver acordeón Hohner Corona III'). Vacío si activar=false.",
        },
      },
      required: ["activar", "fecha_iso", "duracion_min", "tipo", "notas"],
      additionalProperties: false,
    },
    agendar_llamada: {
      type: "object",
      description:
        "Programar una LLAMADA telefónica Vapi a una fecha/hora futura. Distinto de iniciar_llamada (que llama AHORA). Útil cuando el cliente dice 'llamame mañana a las 10am' o 'mejor el viernes después de las 3'. El bot va a disparar la llamada automáticamente a esa hora con el contexto de la conversación.",
      properties: {
        activar: { type: "boolean" },
        fecha_iso: {
          type: "string",
          description:
            "Fecha y hora ISO 8601 (ej: '2026-05-03T14:00:00'). Vacío si activar=false. Mínimo 5 minutos a futuro.",
        },
        motivo: {
          type: "string",
          description:
            "Razón de la llamada agendada (ej: 'cierre venta plan premium acordado el viernes'). Vacío si activar=false.",
        },
      },
      required: ["activar", "fecha_iso", "motivo"],
      additionalProperties: false,
    },
    capturar_datos: {
      type: "object",
      description:
        "Capturar/actualizar datos del cliente. Activá CADA VEZ que el cliente te dé información NUEVA: nombre real, email, otro teléfono, qué necesita, qué negocio tiene, qué le importa (ventajas), qué le preocupa (miedos/objeciones). El sistema MERGEA con lo guardado — los campos vacíos NO pisan datos previos. Es CRÍTICO porque alimenta el CRM y el contexto que recibe el agente Vapi cuando llama.",
      properties: {
        activar: { type: "boolean" },
        nombre: {
          type: "string",
          description:
            "Nombre real que el cliente te dijo (no el de WhatsApp). Vacío si no lo dio en este turno.",
        },
        email: {
          type: "string",
          description: "Email si el cliente lo compartió. Vacío si no.",
        },
        telefono_alt: {
          type: "string",
          description:
            "Teléfono alternativo si el cliente dio uno distinto al de WhatsApp. Vacío si no.",
        },
        interes: {
          type: "string",
          description:
            "Qué quiere o necesita el cliente (ej: 'agendar demo', 'precio del plan premium', 'asesoría legal'). Vacío si no aplica.",
        },
        negocio: {
          type: "string",
          description:
            "Tipo de negocio / industria / contexto profesional del cliente (ej: 'agencia de marketing', 'ecommerce de moda'). Vacío si no aplica.",
        },
        ventajas: {
          type: "string",
          description:
            "Beneficios o ventajas que el cliente percibe / valora (ej: 'le importa rapidez de respuesta', 'busca ahorrar tiempo en seguimientos'). Vacío si no aplica.",
        },
        miedos: {
          type: "string",
          description:
            "Objeciones, miedos o frenos del cliente (ej: 'le preocupa el precio', 'no sabe si su equipo va a adoptarlo'). Vacío si no aplica.",
        },
        otros: {
          type: "string",
          description:
            "Cualquier OTRO dato relevante que no encaja arriba, en formato 'clave: valor; clave: valor' (ej: 'ciudad: Bogotá; equipo: 5 personas'). Vacío si no hay.",
        },
      },
      required: [
        "activar",
        "nombre",
        "email",
        "telefono_alt",
        "interes",
        "negocio",
        "ventajas",
        "miedos",
        "otros",
      ],
      additionalProperties: false,
    },
    actualizar_score: {
      type: "object",
      description:
        "Subir/bajar la puntuación de calificación del lead (0-100). Subila a medida que el cliente muestra señales de interés (pregunta precio, agenda demo, comparte info personal). Bajala si frena o se aleja. Activá solo cuando el cambio sea significativo (>= 10 puntos).",
      properties: {
        activar: { type: "boolean" },
        score: {
          type: "number",
          description:
            "Nuevo score 0-100. 0-19=frío/perdido, 20-39=tibio, 40-59=interesado, 60-79=calificado, 80-100=listo para cerrar. Si activar=false, poné 0.",
        },
        motivo: {
          type: "string",
          description:
            "Razón corta del cambio (ej: 'pidió demo y dio email'). Vacío si activar=false.",
        },
      },
      required: ["activar", "score", "motivo"],
      additionalProperties: false,
    },
    cambiar_estado: {
      type: "object",
      description:
        "Cambiar el estado del lead en el CRM. Estados: nuevo (recién entró), contactado (ya respondiste), calificado (mostró interés real y dio datos), interesado (pidió info concreta o agendó demo), negociacion (hablando precios/condiciones), cerrado (ganó), perdido (rechazó o ghosting confirmado). Activá solo en transiciones reales.",
      properties: {
        activar: { type: "boolean" },
        nuevo_estado: {
          type: "string",
          enum: [
            "nuevo",
            "contactado",
            "calificado",
            "interesado",
            "negociacion",
            "cerrado",
            "perdido",
            "",
          ],
          description: "Nuevo estado. Cadena vacía si activar=false.",
        },
        motivo: {
          type: "string",
          description:
            "Razón del cambio (ej: 'agendó demo personalizada'). Vacío si activar=false.",
        },
      },
      required: ["activar", "nuevo_estado", "motivo"],
      additionalProperties: false,
    },
    reprogramar_cita: {
      type: "object",
      description:
        "Reprogramar una cita YA AGENDADA. El sistema te pasa en el contexto la lista de Citas activas con su id. Usá ese id exacto para reprogramar. NO inventes ids.",
      properties: {
        activar: { type: "boolean" },
        cita_id: {
          type: "string",
          description:
            "ID exacto de la cita a reprogramar (de la lista de Citas activas en el contexto). Vacío si activar=false.",
        },
        nueva_fecha_iso: {
          type: "string",
          description:
            "Nueva fecha y hora ISO 8601. Vacío si activar=false.",
        },
        motivo: {
          type: "string",
          description:
            "Por qué se reprograma (ej: 'cliente pidió cambiar a las 4pm'). Vacío si activar=false.",
        },
      },
      required: ["activar", "cita_id", "nueva_fecha_iso", "motivo"],
      additionalProperties: false,
    },
    cancelar_cita: {
      type: "object",
      description:
        "Cancelar una cita YA AGENDADA. Usá el cita_id exacto del contexto (Citas activas). NO inventes ids.",
      properties: {
        activar: { type: "boolean" },
        cita_id: {
          type: "string",
          description:
            "ID exacto de la cita a cancelar. Vacío si activar=false.",
        },
        motivo: {
          type: "string",
          description:
            "Por qué se cancela (ej: 'cliente ya no puede asistir'). Vacío si activar=false.",
        },
      },
      required: ["activar", "cita_id", "motivo"],
      additionalProperties: false,
    },
  },
  required: [
    "partes",
    "transferir_a_humano",
    "iniciar_llamada",
    "productos_de_interes",
    "programar_seguimiento",
    "agendar_cita",
    "agendar_llamada",
    "capturar_datos",
    "actualizar_score",
    "cambiar_estado",
    "reprogramar_cita",
    "cancelar_cita",
  ],
  additionalProperties: false,
} as const;

const INSTRUCCIONES_ESTRUCTURADAS = `
INSTRUCCIONES DE FORMATO DE RESPUESTA (siempre seguir):

1) Tu respuesta debe venir en JSON con la estructura indicada.

2) "partes" es un array de mensajes ordenados. Cada parte tiene un "tipo":
   - tipo="texto": "contenido" tiene el texto. "media_id" debe ser "".
   - tipo="audio": "contenido" tiene el texto que se SINTETIZA con voz y se envía como
     nota de voz. "media_id" debe ser "". Solo usalo si la cuenta tiene voz configurada.
   - tipo="media": "media_id" tiene el identificador del medio de la biblioteca a enviar.
     "contenido" debe ser "".

3) Reglas para dividir en partes y mezclar formatos:
   - Si la respuesta es corta (1 frase), 1 sola parte.
   - Si hay saludo + contenido, separalos.
   - Cada parte de texto: máximo 2-3 líneas, natural en WhatsApp.
   - NO uses emojis.
   - VARIÁ formatos para que se sienta humano. Ejemplos válidos:
       · solo texto (lo más común para datos rápidos, links, precios)
       · texto + media (cuando mostrás algo visual)
       · audio + texto (audio cálido cerrando con un texto con detalles puntuales)
       · texto + audio (resumen corto y después "te explico mejor en audio")
       · solo audio (respuestas largas o cálidas, especialmente si el cliente envió audio)
   - Si el cliente envió un mensaje de audio (lo verás como
     "[mensaje de audio del cliente]: <transcripción>"), CONSIDERÁ responder con al
     menos una parte tipo="audio" para mantener el ritmo de la conversación.
   - Para datos exactos (precios, números, links, direcciones, mails) usá tipo="texto"
     aunque el resto sea audio — es más fácil de copiar.
   - Solo usá media_id que esté en la lista de medios disponibles que te paso. NO inventes.
   - Máximo 1-2 medios + 1-2 audios por respuesta. No saturar.

4) VISIÓN — IMPORTANTE: tenés capacidad multimodal activa, podés VER las imágenes
   que te manda el cliente. Cuando un mensaje del usuario tiene una imagen adjunta:
   - Mirala con atención y describí o respondé sobre lo que muestra.
   - NUNCA digas "no veo imágenes", "no puedo ver", "mandame descripción", "no sé qué
     querés que haga con eso". Esas respuestas son INCORRECTAS porque sí tenés visión.
   - Si en el historial hay respuestas tuyas viejas diciendo que no podías ver, IGNORALAS:
     eso ya no aplica, ahora tenés visión.
   - Ejemplos de cómo responder:
     · Foto de producto + "¿precio?" → identificá el producto y dale info.
     · Screenshot de error → leelo y ayudá a resolver.
     · Comprobante de pago → agradecé y confirmá lo que ves (monto, banco, fecha).
     · Foto sin caption → describí o preguntá qué necesita.

5) "transferir_a_humano" indica si necesitás que un humano del equipo continúe la conversación:
   - activar=true SOLO si: (a) el cliente pide hablar con humano/asesor/persona, (b) detectás frustración seria, (c) la situación requiere alguien con autoridad (refund, descuento grande, decisión legal/médica), (d) hay riesgo si das info incorrecta.
   - razon: resumí en 1-2 líneas para el operador.
   - Si activar=true, igual respondé al cliente con partes diciendo educadamente que un humano continuará.
   - En caso normal: activar=false, razon="".

6) "productos_de_interes" — array de IDs (en string) de productos del catálogo
   por los que el cliente preguntó o mostró interés en este turno (precio, info,
   foto, comprar, comparar). Si tu negocio te pasó productos, los vas a ver en
   la sección "Catálogo de productos" arriba con su id. Vacío si no aplica o
   si tu cuenta no tiene catálogo.

7) "programar_seguimiento" — usalo para agendar un MENSAJE futuro de re-engagement.
   - Casos: cliente dijo "lo pienso y te aviso", "el viernes te confirmo", "déjame ver mi
     agenda". En esos casos programá un follow-up suave para esa fecha.
   - NO uses para spam. Si el cliente no pidió tiempo o no mostró interés, dejalo vacío.
   - El sistema NO va a enviar el seguimiento si el cliente respondió antes (se cancela
     automáticamente). Tampoco si supera el rate limit del día (anti-ban WhatsApp).
   - Cuando activar=true, escribí en "contenido" el texto EXACTO que se va a enviar
     al cliente (ej: "Hola Juan, paso a saludarte como dijiste el lunes. ¿Decidiste
     algo sobre el plan premium?").
   - Si no aplica: activar=false, todos los demás campos vacíos.

8) "agendar_cita" — usalo cuando el cliente CONFIRME una fecha y hora específica para
   una cita (demo, asesoría, clase, reunión, consulta). El sistema:
   - Crea la cita en la agenda del negocio.
   - Manda recordatorio automático al cliente 1h antes.
   - El operador la ve en /agenda.
   - NO inventes citas si el cliente no las confirmó.
   - Si no aplica: activar=false, fecha_iso="", duracion_min=0, tipo="", notas="".

9) "iniciar_llamada" dispara una LLAMADA TELEFÓNICA real al cliente usando Vapi.
   - activar=true SOLO cuando: (a) el cliente acepta explícitamente que lo llames ("dale, llamame", "sí, prefiero hablar"), (b) la situación amerita conversación de voz (cierre de venta, demo, agendamiento, dudas complejas), (c) ya intercambiaron suficientes mensajes y la conversación está madura.
   - NO uses iniciar_llamada como saludo, ni en los primeros mensajes, ni si el cliente solo pidió info por escrito.
   - Antes de activarlo, AVISÁ al cliente en una parte de texto: "Listo, te llamo en unos segundos por WhatsApp Calling".
   - Solo se puede usar 1 vez por hora por conversación (cooldown). Si lo activás de más, el sistema lo ignora silenciosamente.
   - En caso normal: activar=false, razon="".

10) "capturar_datos" — REGLA OBLIGATORIA. Activá activar=true SIEMPRE que detectes CUALQUIERA de estos en el último mensaje del cliente (NO importa cuán sutil sea):
    - Cualquier mención de su nombre ("soy X", "me llamo X", "soy X de Y", firma "— X")
    - Cualquier email mencionado
    - Cualquier teléfono adicional al de WhatsApp
    - Cualquier mención de su trabajo / empresa / industria / rubro
    - Cualquier interés o necesidad concreta ("quiero agendar", "necesito info de X", "busco Y")
    - Cualquier ventaja que valora ("me importa rapidez", "lo más importante para mí es...")
    - Cualquier objeción o miedo ("me preocupa el precio", "no estoy seguro de...", "tengo dudas con...")
    - Cualquier dato personalizado que el negocio configuró (ver sección "Datos personalizados a capturar")

    REGLA DE ORO: ante la duda, ACTIVÁ. Es preferible capturar de más que perder un dato. El sistema hace MERGE — campos vacíos NO pisan datos previos.

    Ejemplos OBLIGATORIOS de activación (NUNCA dejar pasar estos):
    - Cliente: "Hola soy Juan" → activar=true, nombre="Juan"
    - Cliente: "Me llamo Erik Manuel Taveras" → activar=true, nombre="Erik Manuel Taveras"
    - Cliente: "Erik por aquí" → activar=true, nombre="Erik"
    - Cliente: "mi correo es x@y.com" / "mi mail x@y.com" / "x@y.com" → activar=true, email="x@y.com"
    - Cliente: "tengo una agencia de marketing" → activar=true, negocio="agencia de marketing"
    - Cliente: "me llegan muchos leads por Facebook" → activar=true, interes="gestión de leads de Facebook ads"
    - Cliente: "me preocupa el precio" → activar=true, miedos="preocupado por el precio"
    - Cliente: "lo más importante para mí es la rapidez" → activar=true, ventajas="valora rapidez de respuesta"

    Si el cliente NO compartió ningún dato nuevo (mensajes tipo "ok", "gracias", "sí"), activar=false con todos los strings vacíos.

    El sistema te muestra los datos YA capturados arriba en "# Datos del cliente". NO REPREGUNTES lo que ya tenés. SI ya tenés el nombre, NO le preguntes el nombre otra vez.

11) "actualizar_score" — calificación 0-100 del lead. Activá activar=true cuando:
    - El cliente da su nombre real → score sube ~15 (de 0 a 15-20)
    - El cliente da email o teléfono → +15
    - El cliente cuenta de su negocio / contexto → +10
    - El cliente pide info de precios / planes → +20 (ya está en "calificado")
    - El cliente agenda demo / cita / llamada → +25 (ya está en "interesado")
    - El cliente pregunta sobre formas de pago / contratación → +15 (negociación)
    - El cliente confirma compra → score = 100 (cerrado)

    REGLA: activá activar=true cada vez que haya >= 10 puntos de cambio. El score actual te lo paso en el contexto bajo "Lead score actual: X/100".

    Si no hay señal: activar=false, score=0, motivo="".

12) "cambiar_estado" — transiciones del lead en el CRM. Activá cuando corresponda:
    - "nuevo" → "contactado": el cliente RESPONDIÓ a tu primer mensaje (cualquier respuesta cuenta).
    - "contactado" → "calificado": el cliente DIO al menos un dato (nombre, email, negocio, o interés concreto).
    - "calificado" → "interesado": el cliente AGENDÓ algo (demo/cita/llamada) o pidió INFO ESPECÍFICA de un producto.
    - "interesado" → "negociacion": el cliente HABLA DE PRECIOS, condiciones de pago o fechas de inicio.
    - "negociacion" → "cerrado": el cliente CONFIRMÓ compra / pagó / dijo "dale, lo compro".
    - cualquier → "perdido": dijo "no me interesa" o "ya compré con otro".

    REGLA: activá activar=true en CADA transición. El estado actual te lo paso en "Estado del lead: X" — si la conversación ya cumple condición de avance, transicioná YA, no esperes.

    Si el lead sigue en el mismo estado: activar=false, nuevo_estado="", motivo="".

13) "reprogramar_cita" / "cancelar_cita" — modificar citas YA agendadas.
    - El sistema te pasa la lista de "Citas activas" con su id en el contexto.
    - Si el cliente dice "cambiame la cita del viernes a las 4pm" → reprogramar_cita con cita_id de esa cita y nueva_fecha_iso.
    - Si dice "cancelá la cita" → cancelar_cita con cita_id.
    - NUNCA inventes cita_id. Si no aparece en la lista del contexto, NO actives.
    - En caso normal: activar=false en ambas.

14) USO DEL NOMBRE DEL CLIENTE — REGLA INVIOLABLE.
    - En el contexto te paso el "Nombre real capturado" del cliente (en datos_capturados.nombre).
    - SI EXISTE ese nombre real, usalo SIEMPRE. NO uses el nombre de WhatsApp (que puede ser ficticio o un nick).
    - Si todavía no capturaste el nombre real, NO inventes uno: dirigite al cliente sin nombre o pedile el nombre amablemente.
    - Una vez capturado → repetilo en saludos / cierres / mensajes claves para que sienta personalización ("Listo Juan, te confirmo...", "Genial Juan, agendamos para el viernes").
`.trim();

export async function generarRespuesta(
  historial: Mensaje[],
  promptSistema?: string | null,
  modeloOverride?: string | null,
  parametros?: { temperatura?: number; max_tokens?: number },
): Promise<RespuestaIA> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY no está definida. Verifica .env.local y el cargador de entorno.",
    );
  }

  const promptUsuario = promptSistema?.trim() || PROMPT_SISTEMA_DEFAULT;
  const promptCompleto = `${promptUsuario}\n\n${INSTRUCCIONES_ESTRUCTURADAS}`;
  const modelo = modeloOverride?.trim() || MODELO_DEFAULT;
  const temperatura =
    typeof parametros?.temperatura === "number"
      ? Math.max(0, Math.min(2, parametros.temperatura))
      : 0.7;
  const maxTokens =
    typeof parametros?.max_tokens === "number"
      ? Math.max(500, Math.min(8000, Math.floor(parametros.max_tokens)))
      : 2000;

  const mensajesParaLLM = await Promise.all(
    historial
      .filter((m) => m.rol !== "sistema")
      .map(async (m) => {
        if (m.rol === "usuario") {
          return {
            role: "user" as const,
            content: await construirContenidoUsuario(m),
          };
        }
        // El asistente y los humanos del panel se mandan como texto plano.
        return {
          role: "assistant" as const,
          content: m.contenido,
        };
      }),
  );

  const conImagen = mensajesParaLLM.some(
    (m) => Array.isArray(m.content),
  );
  console.log(
    `[openai] 🤖 modelo=${modelo} mensajes=${mensajesParaLLM.length} con_imagen=${conImagen}`,
  );

  const respuesta = await cliente.chat.completions.create({
    model: modelo,
    messages: [
      { role: "system", content: promptCompleto },
      ...mensajesParaLLM,
    ],
    temperature: temperatura,
    // Mínimo recomendado 500: con 12 tools en strict mode, el JSON
    // mínimo (todos activar=false) ya pesa ~500 tokens. Si el usuario
    // configura menos, igual aplicamos el piso para evitar truncado.
    max_tokens: maxTokens,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "respuesta_agente",
        strict: true,
        schema: ESQUEMA_RESPUESTA,
      },
    },
  });

  const texto = respuesta.choices[0]?.message?.content?.trim();
  if (!texto) {
    throw new Error("OpenAI devolvió una respuesta vacía.");
  }

  let parsed: RespuestaIA;
  try {
    parsed = JSON.parse(texto) as RespuestaIA;
  } catch (err) {
    console.error("[openai] respuesta no es JSON válido:", texto, err);
    throw new Error("OpenAI devolvió formato inválido.");
  }

  if (!parsed.partes || parsed.partes.length === 0) {
    parsed.partes = [{ tipo: "texto", contenido: "...", media_id: "" }];
  }
  if (!parsed.transferir_a_humano) {
    parsed.transferir_a_humano = { activar: false, razon: "" };
  }
  if (!parsed.iniciar_llamada) {
    parsed.iniciar_llamada = { activar: false, razon: "" };
  }
  if (!Array.isArray(parsed.productos_de_interes)) {
    parsed.productos_de_interes = [];
  }
  if (!parsed.programar_seguimiento) {
    parsed.programar_seguimiento = {
      activar: false,
      fecha_iso: "",
      contenido: "",
      razon: "",
    };
  }
  if (!parsed.agendar_cita) {
    parsed.agendar_cita = {
      activar: false,
      fecha_iso: "",
      duracion_min: 0,
      tipo: "",
      notas: "",
    };
  }
  if (!parsed.agendar_llamada) {
    parsed.agendar_llamada = { activar: false, fecha_iso: "", motivo: "" };
  }
  if (!parsed.capturar_datos) {
    parsed.capturar_datos = {
      activar: false,
      nombre: "",
      email: "",
      telefono_alt: "",
      interes: "",
      negocio: "",
      ventajas: "",
      miedos: "",
      otros: "",
    };
  }
  if (!parsed.actualizar_score) {
    parsed.actualizar_score = { activar: false, score: 0, motivo: "" };
  }
  if (!parsed.cambiar_estado) {
    parsed.cambiar_estado = { activar: false, nuevo_estado: "", motivo: "" };
  }
  if (!parsed.reprogramar_cita) {
    parsed.reprogramar_cita = {
      activar: false,
      cita_id: "",
      nueva_fecha_iso: "",
      motivo: "",
    };
  }
  if (!parsed.cancelar_cita) {
    parsed.cancelar_cita = { activar: false, cita_id: "", motivo: "" };
  }
  return parsed;
}
