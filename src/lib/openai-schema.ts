/**
 * Schema JSON estricto para `response_format` de OpenAI + las
 * instrucciones de formato que se inyectan al system prompt.
 * Vive separado de `openai.ts` por puro tamaño — son solo literales.
 */

export const ESQUEMA_RESPUESTA = {
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

