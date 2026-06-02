/**
 * Asistente personal del dueño del negocio (operador privado).
 *
 * Cuando el remitente del mensaje coincide con `cuenta.telefono_operador_privado`,
 * en vez de procesar como cliente normal, derivamos acá. La IA actúa como un
 * asistente ejecutivo bidireccional: el dueño le habla en lenguaje natural y
 * el asistente entiende, consulta el CRM, ejecuta acciones administrativas
 * y propone recomendaciones de mejora.
 *
 * Diseño:
 * - OpenAI Chat Completions con TOOL CALLING. La IA decide qué tool invocar
 *   según lo que el operador pide en lenguaje natural ("¿cómo van los leads?",
 *   "actualizá el prompt para que sea más formal", "pausá el agente que voy
 *   a atender personalmente", "qué productos te faltan info?").
 * - Tools disponibles: KPIs, leads, citas, productos, análisis de catálogo,
 *   actualizar prompt sistema, agregar instrucción extra, pausar/reactivar,
 *   recomendar acciones.
 * - Modelo: gpt-4o-mini (barato, son pocos mensajes/día por operador).
 * - Historial: trae los últimos 12 mensajes de la conversación virtual del
 *   operador para que haya continuidad.
 *
 * No usa el schema strict del agente principal — son simplemente respuestas
 * de texto natural, con tool calls intermedios.
 */
import { type WASocket } from "@whiskeysockets/baileys";
import OpenAI from "openai";
import {
  actualizarCita,
  actualizarCuenta,
  actualizarLead,
  cambiarModo,
  crearProducto,
  encolarBandejaSalida,
  insertarMensaje,
  listarCitasActivasDeConversacion,
  listarConversaciones,
  listarProductosActivos,
  obtenerCita,
  obtenerCuenta,
  obtenerHistorialReciente,
  obtenerOCrearConversacion,
  registrarUso,
  type Conversacion,
  type Cuenta,
} from "../baseDatos";
import { db } from "../db/cliente";
import {
  actualizarFilasExternas,
  contarFilasExternas,
  crearFilaExterna,
  crearUsuarioAuthExterno,
  eliminarFilasExternas,
  leerFilasExternas,
  listarTablasExternas,
} from "../db/supabaseExterno";
import { conReintentos } from "../reintentos";

const cliente = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "",
});

// gpt-4o (no mini) porque mini falla con tool calling complejo —
// dice "voy a hacerlo" sin llamar la tool. gpt-4o es ~6x más caro
// pero 10x más confiable. Para operador (pocos mensajes/día) el costo
// es insignificante (~$0.005 por consulta vs $0.001).
const MODELO = "gpt-4o-2024-08-06";
const COSTO_PER_M = { in: 2.5, out: 10 };

// ============================================================
// HERRAMIENTAS (tools) que la IA puede invocar.
// ============================================================
type ToolDef = OpenAI.Chat.Completions.ChatCompletionTool;

const TOOLS: ToolDef[] = [
  {
    type: "function",
    function: {
      name: "consultar_kpis",
      description:
        "Devuelve los KPIs actuales del negocio: mensajes de hoy y ayer, leads activos, leads calientes (score>=80), citas próximas (7 días), conversaciones pendientes sin respuesta hace más de 6h. Usar cuando el dueño pregunte 'cómo va el día', 'cómo va el negocio', 'dame un resumen', 'qué tal hoy', etc.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "listar_leads",
      description:
        "Lista los top N leads activos ordenados por score (mayor primero). Devuelve nombre/teléfono, score, estado, último mensaje. Usar cuando pregunten 'mostrame los leads', 'cuáles son los mejores', 'a quién debería seguir hoy'.",
      parameters: {
        type: "object",
        properties: {
          limite: { type: "number", description: "Cantidad de leads a devolver (1-20). Default 5." },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listar_citas",
      description:
        "Lista las citas próximas del negocio en los próximos N días. Devuelve fecha, cliente, tipo y estado. Usar cuando pregunten 'qué citas tengo', 'agenda de la semana', 'a quién veo mañana'.",
      parameters: {
        type: "object",
        properties: {
          dias: { type: "number", description: "Días hacia adelante a mirar (1-60). Default 14." },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listar_productos",
      description:
        "Lista todos los productos activos del catálogo: nombre, precio, stock, si tienen foto cargada o no. Usar cuando pregunten 'qué tengo cargado', 'mi catálogo', 'productos disponibles'.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "analizar_catalogo",
      description:
        "Analiza el catálogo y detecta problemas: productos sin foto, sin descripción, sin precio, sin stock. Devuelve lista de productos con problemas y recomendaciones. Usar cuando pregunten 'qué le falta a mi catálogo', 'hay algún error', 'cómo puedo mejorar', 'recomendame qué hacer'.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "analizar_conversaciones",
      description:
        "Analiza las conversaciones recientes y detecta patrones: clientes pendientes sin respuesta, conversaciones que pueden estar atascadas, tasas de conversión por estado. Usar cuando pregunten 'cómo van las conversaciones', 'analizá las charlas', 'hay algo que mejorar', 'qué patrón ves'.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "actualizar_prompt_agente",
      description:
        "Reemplaza el prompt sistema del agente principal (el que atiende a los clientes). El dueño debe darte el prompt completo nuevo o decirte la modificación. Si el dueño dice algo vago como 'hacelo más formal' sin texto exacto, PRIMERO mostrá el prompt actual y proponé una versión nueva, después confirmá antes de aplicar. Tope 8000 caracteres.",
      parameters: {
        type: "object",
        properties: {
          nuevo_prompt: {
            type: "string",
            description: "Prompt completo nuevo a aplicar (reemplaza al actual). Mínimo 30 caracteres.",
          },
        },
        required: ["nuevo_prompt"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "agregar_instruccion_extra",
      description:
        "Agrega una instrucción nueva al campo instrucciones_extra de la cuenta (sin pisar el prompt principal). Útil para reglas adicionales puntuales: 'no mencionar precios sin que pregunten', 'siempre ofrecer demo después de 3 mensajes'. Más seguro que reemplazar el prompt completo.",
      parameters: {
        type: "object",
        properties: {
          instruccion: {
            type: "string",
            description: "Texto de la instrucción nueva (5-500 caracteres). Se agrega al final del bloque actual.",
          },
        },
        required: ["instruccion"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "pausar_agente",
      description:
        "Pausa el agente IA en TODAS las conversaciones de la cuenta (las pasa a modo HUMANO). El dueño tendrá que responder manualmente desde el panel hasta que reactive. Usar cuando pidan 'pausá', 'apagá el bot', 'voy a atender yo'.",
      parameters: {
        type: "object",
        properties: {
          razon: { type: "string", description: "Razón breve por la que se pausa (queda en log)." },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "reactivar_agente",
      description:
        "Reactiva el agente IA en TODAS las conversaciones (vuelven a modo IA). Usar cuando pidan 'reactivá', 'prendé el bot', 'que vuelva a responder'.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "obtener_prompt_actual",
      description:
        "Devuelve el prompt sistema actual del agente principal y las instrucciones extra configuradas. Usar cuando pregunten 'cuál es el prompt actual', 'qué instrucciones tiene el bot', 'mostrame cómo está configurado', o ANTES de proponer cambios al prompt.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "actualizar_perfil_agente",
      description:
        "Actualiza el perfil del agente principal: nombre, rol, personalidad, tono, idioma, mensaje de bienvenida, mensaje de no-entiende, palabras de handoff. Pasale SOLO los campos que el dueño quiere cambiar. Usar cuando pidan 'cambiá el nombre del agente a X', 'que el agente sea más formal', 'cambiá el saludo', 'que se llame Pepe', etc.",
      parameters: {
        type: "object",
        properties: {
          agente_nombre: {
            type: "string",
            description: "Nuevo nombre del agente (ej: 'Pepe', 'Carla'). Max 60 chars.",
          },
          agente_rol: {
            type: "string",
            description: "Rol/función del agente (ej: 'Vendedor de autos', 'Asesor inmobiliario'). Max 80 chars.",
          },
          agente_personalidad: {
            type: "string",
            description: "Descripción de personalidad (ej: 'profesional, amable y entusiasta'). Max 200 chars.",
          },
          agente_tono: {
            type: "string",
            enum: [
              "formal",
              "casual_amigable",
              "profesional",
              "cercano",
              "directo",
              "consultivo",
            ],
            description: "Tono de comunicación.",
          },
          agente_idioma: {
            type: "string",
            description: "Código de idioma: 'es' (neutro), 'es-AR', 'es-CO', 'es-MX', 'en', 'pt'.",
          },
          mensaje_bienvenida: {
            type: "string",
            description: "Mensaje que el agente envía al primer contacto. Max 800 chars.",
          },
          mensaje_no_entiende: {
            type: "string",
            description: "Respuesta cuando el agente no entiende al cliente. Max 400 chars.",
          },
          palabras_handoff: {
            type: "string",
            description: "Lista CSV de palabras que disparan handoff a humano (ej: 'humano, asesor, queja'). Max 600 chars.",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "enviar_mensaje_a_cliente",
      description:
        "Envía un mensaje de WhatsApp a un cliente específico (NO al operador, sino a un cliente real del negocio). Usar cuando el dueño diga 'mandale un mensaje a 5731234567 diciéndole...', 'escribile a Juan...', 'decile al cliente del Toyota que...', etc. El mensaje queda como rol=humano en la conversación (como si lo hubiera mandado el operador desde el panel) y pasa la conversación a modo HUMANO para que el agente IA no responda automáticamente al cliente. Si el dueño NO especificó el texto exacto, ANTES de invocar esta tool pediile el texto literal o proponé uno y confirmá.",
      parameters: {
        type: "object",
        properties: {
          telefono: {
            type: "string",
            description: "Número del cliente destinatario. Acepta cualquier formato (con/sin '+', con/sin espacios). Mínimo 8 dígitos. NO puede ser el mismo número del operador.",
          },
          mensaje: {
            type: "string",
            description: "Texto exacto del mensaje a enviar al cliente. 1-1500 caracteres.",
          },
          nombre_cliente: {
            type: "string",
            description: "Nombre del cliente si lo conocés (para registro). Opcional.",
          },
          pasar_a_humano: {
            type: "boolean",
            description: "Si true (default), la conversación pasa a modo HUMANO y el agente IA no responde más automáticamente hasta que reactives. Si false, la IA puede seguir contestando — útil para una sola intervención puntual del dueño.",
          },
        },
        required: ["telefono", "mensaje"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cambiar_modo_conversacion",
      description:
        "Cambia el modo de UNA conversación específica entre IA y HUMANO. En modo HUMANO la IA principal NO responde más a ese cliente — el dueño contesta manualmente. Usar cuando el dueño diga 'pasá la conversación con Pedro a humano', 'que la IA deje de contestar a 5731234567', 'voy a atender a Juan personalmente', 'reactivá la IA con el cliente del Toyota'.",
      parameters: {
        type: "object",
        properties: {
          telefono: {
            type: "string",
            description: "Número del cliente cuya conversación quiero cambiar de modo. Acepta formato libre.",
          },
          modo: {
            type: "string",
            enum: ["IA", "HUMANO"],
            description: "Nuevo modo. IA = el bot responde automático. HUMANO = el dueño responde manual.",
          },
        },
        required: ["telefono", "modo"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "actualizar_datos_cliente",
      description:
        "Actualiza/corrige los datos capturados de un cliente específico (nombre real, email, teléfono alt, intereses, negocio, ventajas que valora, miedos/objeciones). Usar cuando el dueño diga 'corregí el nombre de 5731234567 a Pedro García', 'actualizá el email del cliente del Toyota a x@y.com', 'agregá que Juan trabaja en construcción'. NO pisa datos previos no provistos — solo actualiza los campos que mandes.",
      parameters: {
        type: "object",
        properties: {
          telefono: {
            type: "string",
            description: "Número del cliente cuyos datos voy a actualizar.",
          },
          nombre: {
            type: "string",
            description: "Nombre real del cliente (corrige el capturado o el de WhatsApp).",
          },
          email: { type: "string", description: "Email del cliente." },
          telefono_alt: { type: "string", description: "Teléfono alternativo." },
          interes: {
            type: "string",
            description: "Qué busca / necesita el cliente. Texto libre.",
          },
          negocio: {
            type: "string",
            description: "Tipo de negocio o industria del cliente.",
          },
          ventajas: {
            type: "string",
            description: "Qué valora el cliente (rapidez, precio, calidad, etc.).",
          },
          miedos: {
            type: "string",
            description: "Objeciones o dudas que tiene el cliente.",
          },
          lead_score: {
            type: "number",
            description: "Score 0-100. Solo si el dueño lo indica explícitamente.",
          },
        },
        required: ["telefono"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listar_citas_cliente",
      description:
        "Lista las citas activas de UN cliente específico (no todas las del negocio). Usar cuando el dueño pregunte 'qué citas tiene Pedro', 'a qué hora viene el cliente del Toyota', etc. Para citas globales del negocio, usar listar_citas.",
      parameters: {
        type: "object",
        properties: {
          telefono: { type: "string", description: "Número del cliente." },
        },
        required: ["telefono"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "reprogramar_cita",
      description:
        "Cambia la fecha/hora de una cita existente. Necesitás el cita_id (UUID) — si no lo tenés, primero llamá listar_citas_cliente para obtenerlo. Usar cuando el dueño diga 'reprogramá la cita de Pedro al viernes a las 4pm', 'cambiá la cita del Toyota a mañana 10am'.",
      parameters: {
        type: "object",
        properties: {
          cita_id: {
            type: "string",
            description: "UUID de la cita (obtenido de listar_citas_cliente o listar_citas).",
          },
          nueva_fecha_iso: {
            type: "string",
            description: "Nueva fecha y hora en formato ISO 8601 con timezone (ej: '2026-05-08T16:00:00-05:00').",
          },
          nueva_duracion_min: {
            type: "number",
            description: "Nueva duración en minutos (opcional). Si no se pasa, queda igual.",
          },
        },
        required: ["cita_id", "nueva_fecha_iso"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cancelar_cita",
      description:
        "Cancela una cita existente (estado pasa a 'cancelada'). Necesitás el cita_id. Si no lo tenés, primero listar_citas_cliente. Usar cuando el dueño diga 'cancelá la cita de Pedro', 'la cita del viernes ya no va'.",
      parameters: {
        type: "object",
        properties: {
          cita_id: { type: "string", description: "UUID de la cita." },
          razon: {
            type: "string",
            description: "Motivo de la cancelación (queda en notas).",
          },
        },
        required: ["cita_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "obtener_conversacion_cliente",
      description:
        "Devuelve los últimos 30 mensajes de un cliente específico + sus datos capturados + estado del lead. Usar cuando el dueño pida 'mostrame la conversación con Pedro', 'qué le hablamos al del Toyota', 'analizá la charla con 5731234567', o ANTES de proponer mejoras al agente basadas en una conversación específica.",
      parameters: {
        type: "object",
        properties: {
          telefono: { type: "string", description: "Número del cliente." },
        },
        required: ["telefono"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "crear_producto",
      description:
        "Crea un producto nuevo en el catálogo. Usar cuando el dueño diga 'agregá X al catálogo', 'cargá un producto nuevo: ...'. Pedile los datos básicos si no los pasó (al menos nombre, precio si tiene).",
      parameters: {
        type: "object",
        properties: {
          nombre: { type: "string", description: "Nombre del producto. Obligatorio. 2-140 chars." },
          descripcion: { type: "string", description: "Descripción del producto. Opcional pero recomendada." },
          precio: { type: "number", description: "Precio numérico. Si está 'a consultar', omitir." },
          moneda: { type: "string", description: "Código moneda (COP, USD, ARS, etc). Default COP." },
          stock: { type: "number", description: "Stock disponible. Opcional." },
          categoria: { type: "string", description: "Categoría del producto. Opcional." },
          imagen_url_externa: {
            type: "string",
            description: "URL HTTPS pública de la foto del producto. Opcional.",
          },
        },
        required: ["nombre"],
        additionalProperties: false,
      },
    },
  },
];

// ============================================================
// TOOLS del SUPABASE EXTERNO del dueño (acceso total a su BD).
// Solo se exponen si la cuenta tiene supabase_externo_url configurado.
// ============================================================
const TOOLS_EXTERNAS: ToolDef[] = [
  {
    type: "function",
    function: {
      name: "bd_listar_tablas",
      description:
        "Lista las tablas del Supabase propio del negocio (la base de datos del dueño, no el CRM del bot). Usar cuando el dueño pregunte 'qué tablas tengo', 'qué hay en mi base', o ANTES de leer/crear/editar para saber los nombres exactos de las tablas.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "bd_leer_filas",
      description:
        "Lee filas de una tabla del Supabase propio del negocio. Podés filtrar por igualdad (ej: { categoria: 'bebidas' }). Usar cuando el dueño quiera ver datos de SU base ('mostrame los productos de mi web', 'cuántos pedidos hay', 'buscá el cliente con id X').",
      parameters: {
        type: "object",
        properties: {
          tabla: { type: "string", description: "Nombre exacto de la tabla (de bd_listar_tablas)." },
          filtros: {
            type: "object",
            description: "Filtros de igualdad columna→valor. Ej: { estado: 'activo', id: 12 }. Opcional.",
            additionalProperties: true,
          },
          limite: { type: "number", description: "Máximo de filas a traer (1-50). Default 50." },
        },
        required: ["tabla"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bd_crear_fila",
      description:
        "Crea una fila nueva en una tabla del Supabase propio del negocio. Usar cuando el dueño diga 'agregá un producto a mi web', 'creá un registro en X con estos datos'. Pasá los valores como objeto columna→valor.",
      parameters: {
        type: "object",
        properties: {
          tabla: { type: "string", description: "Nombre exacto de la tabla." },
          valores: {
            type: "object",
            description: "Datos de la fila columna→valor. Ej: { nombre: 'Camisa', precio: 50000 }.",
            additionalProperties: true,
          },
        },
        required: ["tabla", "valores"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bd_actualizar_filas",
      description:
        "Actualiza filas de una tabla del Supabase propio del negocio que coincidan con los filtros. EXIGE al menos un filtro. Si la operación afecta MÁS DE UNA fila, la tool devuelve un preview con la cantidad y NO ejecuta hasta que confirmes con el dueño y vuelvas a llamar con confirmado=true. Para una sola fila ejecuta directo.",
      parameters: {
        type: "object",
        properties: {
          tabla: { type: "string", description: "Nombre exacto de la tabla." },
          filtros: {
            type: "object",
            description: "Filtros de igualdad para elegir qué filas actualizar. Ej: { id: 12 }. Obligatorio (al menos uno).",
            additionalProperties: true,
          },
          valores: {
            type: "object",
            description: "Columnas a cambiar columna→nuevo valor. Ej: { precio: 60000, stock: 3 }.",
            additionalProperties: true,
          },
          confirmado: {
            type: "boolean",
            description: "Pasar true SOLO después de que el dueño confirme cuando la operación afecta varias filas.",
          },
        },
        required: ["tabla", "filtros", "valores"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bd_eliminar_filas",
      description:
        "Borra filas de una tabla del Supabase propio del negocio que coincidan con los filtros. EXIGE al menos un filtro. SIEMPRE devuelve primero un preview con la cantidad de filas a borrar y NO ejecuta hasta que confirmes con el dueño y vuelvas a llamar con confirmado=true. El borrado es irreversible.",
      parameters: {
        type: "object",
        properties: {
          tabla: { type: "string", description: "Nombre exacto de la tabla." },
          filtros: {
            type: "object",
            description: "Filtros de igualdad para elegir qué filas borrar. Ej: { id: 12 }. Obligatorio (al menos uno).",
            additionalProperties: true,
          },
          confirmado: {
            type: "boolean",
            description: "Pasar true SOLO después de que el dueño confirme el borrado explícitamente.",
          },
        },
        required: ["tabla", "filtros"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "crear_usuario",
      description:
        "Crea un USUARIO REAL con login (email + contraseña) en el Auth del negocio. Usalo cuando el dueño diga 'creá un perfil/usuario/cuenta con este correo y contraseña'. IMPORTANTE: NO uses bd_crear_fila para crear usuarios — los usuarios con login NO se crean insertando en la tabla de perfiles (su id depende del sistema de Auth y no hay columna de contraseña ahí). Esta tool lo hace bien y el perfil asociado se crea solo. Si el dueño también dio nombre/rol u otros datos del perfil, después usá bd_actualizar_filas sobre la tabla de perfiles filtrando por ese email para completarlos.",
      parameters: {
        type: "object",
        properties: {
          email: { type: "string", description: "Email del nuevo usuario." },
          password: {
            type: "string",
            description: "Contraseña del nuevo usuario (mínimo 6 caracteres).",
          },
        },
        required: ["email", "password"],
        additionalProperties: false,
      },
    },
  },
];

// ============================================================
// IMPLEMENTACIÓN DE LAS TOOLS
// ============================================================

interface KpisDia {
  mensajes_hoy: number;
  mensajes_ayer: number;
  leads_activos: number;
  leads_calientes: number;
  citas_proximas_7d: number;
  pendientes_sin_respuesta_6h: number;
}

async function toolConsultarKpis(cuentaId: string): Promise<KpisDia> {
  const ahora = new Date();
  const inicioHoy = new Date(ahora);
  inicioHoy.setHours(0, 0, 0, 0);
  const inicioAyer = new Date(inicioHoy);
  inicioAyer.setDate(inicioAyer.getDate() - 1);
  const en7d = new Date(ahora);
  en7d.setDate(en7d.getDate() + 7);
  const hace6h = new Date(ahora.getTime() - 6 * 60 * 60 * 1000).toISOString();

  const [
    msgsHoy,
    msgsAyer,
    leadsActivos,
    leadsCalientes,
    citasProx,
    pendientes,
  ] = await Promise.all([
    db()
      .from("mensajes")
      .select("id", { count: "exact", head: true })
      .eq("cuenta_id", cuentaId)
      .eq("rol", "usuario")
      .gte("creado_en", inicioHoy.toISOString()),
    db()
      .from("mensajes")
      .select("id", { count: "exact", head: true })
      .eq("cuenta_id", cuentaId)
      .eq("rol", "usuario")
      .gte("creado_en", inicioAyer.toISOString())
      .lt("creado_en", inicioHoy.toISOString()),
    db()
      .from("conversaciones")
      .select("id", { count: "exact", head: true })
      .eq("cuenta_id", cuentaId)
      .neq("estado_lead", "perdido")
      .neq("estado_lead", "cerrado"),
    db()
      .from("conversaciones")
      .select("id", { count: "exact", head: true })
      .eq("cuenta_id", cuentaId)
      .gte("lead_score", 80),
    db()
      .from("citas")
      .select("id", { count: "exact", head: true })
      .eq("cuenta_id", cuentaId)
      .in("estado", ["agendada", "confirmada"])
      .gte("fecha_hora", ahora.toISOString())
      .lt("fecha_hora", en7d.toISOString()),
    db()
      .from("conversaciones")
      .select("id", { count: "exact", head: true })
      .eq("cuenta_id", cuentaId)
      .lt("ultimo_mensaje_en", hace6h)
      .gte("ultimo_mensaje_en", inicioAyer.toISOString()),
  ]);

  return {
    mensajes_hoy: msgsHoy.count ?? 0,
    mensajes_ayer: msgsAyer.count ?? 0,
    leads_activos: leadsActivos.count ?? 0,
    leads_calientes: leadsCalientes.count ?? 0,
    citas_proximas_7d: citasProx.count ?? 0,
    pendientes_sin_respuesta_6h: pendientes.count ?? 0,
  };
}

async function toolListarLeads(
  cuentaId: string,
  limite: number,
): Promise<Array<{
  nombre: string;
  telefono: string;
  score: number;
  estado: string;
  ultimo_mensaje_en: string | null;
}>> {
  const conversaciones = await listarConversaciones(cuentaId);
  return conversaciones
    .filter((c) => c.estado_lead !== "perdido" && c.estado_lead !== "cerrado")
    .sort((a, b) => (b.lead_score ?? 0) - (a.lead_score ?? 0))
    .slice(0, Math.max(1, Math.min(20, limite || 5)))
    .map((c) => ({
      nombre: c.nombre ?? `+${c.telefono}`,
      telefono: c.telefono,
      score: c.lead_score ?? 0,
      estado: c.estado_lead,
      ultimo_mensaje_en: c.ultimo_mensaje_en,
    }));
}

async function toolListarCitas(
  cuentaId: string,
  dias: number,
): Promise<Array<{ cliente: string; fecha: string; tipo: string | null; estado: string }>> {
  const ahora = new Date();
  const enDias = new Date(ahora);
  enDias.setDate(enDias.getDate() + Math.max(1, Math.min(60, dias || 14)));
  const { data } = await db()
    .from("citas")
    .select("cliente_nombre, fecha_hora, tipo, estado")
    .eq("cuenta_id", cuentaId)
    .in("estado", ["agendada", "confirmada"])
    .gte("fecha_hora", ahora.toISOString())
    .lt("fecha_hora", enDias.toISOString())
    .order("fecha_hora", { ascending: true })
    .limit(20);
  type FilaCita = {
    cliente_nombre: string;
    fecha_hora: string;
    tipo: string | null;
    estado: string;
  };
  return ((data ?? []) as FilaCita[]).map((c) => ({
    cliente: c.cliente_nombre,
    fecha: c.fecha_hora,
    tipo: c.tipo,
    estado: c.estado,
  }));
}

async function toolListarProductos(cuentaId: string): Promise<
  Array<{
    nombre: string;
    precio: number | null;
    moneda: string;
    stock: number | null;
    tiene_foto: boolean;
    tiene_descripcion: boolean;
  }>
> {
  const productos = await listarProductosActivos(cuentaId);
  return productos.map((p) => ({
    nombre: p.nombre,
    precio: p.precio == null ? null : Number(p.precio),
    moneda: p.moneda,
    stock: p.stock,
    tiene_foto:
      (p.imagen_url_externa != null && p.imagen_url_externa.trim() !== "") ||
      (p.imagen_path != null && p.imagen_path.trim() !== ""),
    tiene_descripcion: p.descripcion != null && p.descripcion.trim() !== "",
  }));
}

async function toolAnalizarCatalogo(cuentaId: string): Promise<{
  total: number;
  sin_foto: string[];
  sin_descripcion: string[];
  sin_precio: string[];
  sin_stock: string[];
  recomendaciones: string[];
}> {
  const productos = await listarProductosActivos(cuentaId);
  const sinFoto: string[] = [];
  const sinDesc: string[] = [];
  const sinPrecio: string[] = [];
  const sinStock: string[] = [];
  for (const p of productos) {
    if (
      (p.imagen_url_externa == null || p.imagen_url_externa.trim() === "") &&
      (p.imagen_path == null || p.imagen_path.trim() === "")
    )
      sinFoto.push(p.nombre);
    if (p.descripcion == null || p.descripcion.trim() === "")
      sinDesc.push(p.nombre);
    if (p.precio == null) sinPrecio.push(p.nombre);
    if (p.stock == null) sinStock.push(p.nombre);
  }
  const recomendaciones: string[] = [];
  if (sinFoto.length > 0)
    recomendaciones.push(
      `${sinFoto.length} producto(s) sin foto. Subí imágenes para que el agente las pueda enviar al cliente — aumenta la conversión 3-5x.`,
    );
  if (sinDesc.length > 0)
    recomendaciones.push(
      `${sinDesc.length} producto(s) sin descripción. Agregá detalles (200-400 chars) para que el agente pueda responder mejor preguntas técnicas.`,
    );
  if (sinPrecio.length > 0)
    recomendaciones.push(
      `${sinPrecio.length} producto(s) sin precio. Si está "a consultar" intencional, ignoralo. Si no, cargalo — el agente no puede negociar bien sin precio base.`,
    );
  if (productos.length === 0)
    recomendaciones.push(
      "Tu catálogo está vacío. Cargá al menos 3-5 productos para que el agente tenga algo que ofrecer.",
    );
  return {
    total: productos.length,
    sin_foto: sinFoto,
    sin_descripcion: sinDesc,
    sin_precio: sinPrecio,
    sin_stock: sinStock,
    recomendaciones,
  };
}

async function toolAnalizarConversaciones(cuentaId: string): Promise<{
  total: number;
  por_estado: Record<string, number>;
  pendientes_recientes: Array<{ cliente: string; horas_sin_respuesta: number }>;
  observaciones: string[];
}> {
  const conversaciones = await listarConversaciones(cuentaId);
  const porEstado: Record<string, number> = {};
  for (const c of conversaciones) {
    porEstado[c.estado_lead] = (porEstado[c.estado_lead] ?? 0) + 1;
  }
  const ahora = Date.now();
  const pendientes = conversaciones
    .filter((c) => c.vista_previa_rol === "usuario" && c.ultimo_mensaje_en)
    .map((c) => ({
      cliente: c.nombre ?? `+${c.telefono}`,
      horas_sin_respuesta: Math.round(
        (ahora - new Date(c.ultimo_mensaje_en!).getTime()) / 3_600_000,
      ),
    }))
    .filter((c) => c.horas_sin_respuesta >= 6)
    .sort((a, b) => b.horas_sin_respuesta - a.horas_sin_respuesta)
    .slice(0, 10);

  const observaciones: string[] = [];
  if (pendientes.length > 0)
    observaciones.push(
      `${pendientes.length} conversaciones pendientes de respuesta hace más de 6h. Revisá si es porque están en modo HUMANO o si el agente se atascó.`,
    );
  const calientes = conversaciones.filter((c) => (c.lead_score ?? 0) >= 80).length;
  if (calientes > 0)
    observaciones.push(
      `${calientes} leads calientes (score ≥ 80) — son los candidatos más probables a cerrar venta. Priorizalos.`,
    );
  if (conversaciones.length === 0)
    observaciones.push("No tenés conversaciones todavía. Activá la cuenta WhatsApp y compartí el número.");
  return {
    total: conversaciones.length,
    por_estado: porEstado,
    pendientes_recientes: pendientes,
    observaciones,
  };
}

async function toolActualizarPrompt(
  cuentaId: string,
  nuevo: string,
): Promise<{ ok: boolean; mensaje: string; chars: number }> {
  const limpio = nuevo.trim();
  if (limpio.length < 30) {
    return {
      ok: false,
      mensaje: "El prompt es muy corto (mínimo 30 caracteres). Pasame uno más completo.",
      chars: limpio.length,
    };
  }
  if (limpio.length > 8000) {
    return {
      ok: false,
      mensaje: "El prompt es demasiado largo (máximo 8000 caracteres). Acortalo.",
      chars: limpio.length,
    };
  }
  await actualizarCuenta(cuentaId, { prompt_sistema: limpio });
  return {
    ok: true,
    mensaje: "Prompt actualizado. Aplica al próximo mensaje entrante de cualquier cliente.",
    chars: limpio.length,
  };
}

async function toolAgregarInstruccion(
  cuentaId: string,
  texto: string,
): Promise<{ ok: boolean; mensaje: string }> {
  const limpio = texto.trim();
  if (limpio.length < 5 || limpio.length > 500) {
    return { ok: false, mensaje: "La instrucción debe tener entre 5 y 500 caracteres." };
  }
  const actual = await obtenerCuenta(cuentaId);
  const previo = actual?.instrucciones_extra?.trim() ?? "";
  const nuevo = previo
    ? `${previo}\n- ${limpio}`
    : `- ${limpio}`;
  if (nuevo.length > 4000) {
    return {
      ok: false,
      mensaje:
        "Las instrucciones extra ya están al límite (4000 chars). Pediime que limpie las viejas primero.",
    };
  }
  await actualizarCuenta(cuentaId, { instrucciones_extra: nuevo });
  return { ok: true, mensaje: "Instrucción agregada. Aplica al próximo mensaje entrante." };
}

async function toolPausarReactivar(
  cuentaId: string,
  modo: "HUMANO" | "IA",
): Promise<{ cambiadas: number; total: number }> {
  const conversaciones = await listarConversaciones(cuentaId);
  const objetivo = conversaciones.filter((c) => c.modo !== modo);
  let cambiadas = 0;
  for (const c of objetivo) {
    try {
      await cambiarModo(c.id, modo);
      cambiadas++;
    } catch {
      /* noop */
    }
  }
  return { cambiadas, total: conversaciones.length };
}

async function toolObtenerPromptActual(cuentaId: string): Promise<{
  prompt_sistema: string;
  instrucciones_extra: string;
  agente_nombre: string;
  agente_rol: string;
  agente_personalidad: string;
  agente_tono: string;
  agente_idioma: string;
  mensaje_bienvenida: string;
  mensaje_no_entiende: string;
  palabras_handoff: string;
}> {
  const cta = await obtenerCuenta(cuentaId);
  return {
    prompt_sistema: cta?.prompt_sistema ?? "(no configurado)",
    instrucciones_extra: cta?.instrucciones_extra ?? "(sin instrucciones extra)",
    agente_nombre: cta?.agente_nombre ?? "",
    agente_rol: cta?.agente_rol ?? "",
    agente_personalidad: cta?.agente_personalidad ?? "",
    agente_tono: cta?.agente_tono ?? "",
    agente_idioma: cta?.agente_idioma ?? "",
    mensaje_bienvenida: cta?.mensaje_bienvenida ?? "",
    mensaje_no_entiende: cta?.mensaje_no_entiende ?? "",
    palabras_handoff: cta?.palabras_handoff ?? "",
  };
}

const TONOS_VALIDOS = new Set([
  "formal",
  "casual_amigable",
  "profesional",
  "cercano",
  "directo",
  "consultivo",
]);

async function toolActualizarPerfilAgente(
  cuentaId: string,
  campos: Record<string, unknown>,
): Promise<{ ok: boolean; mensaje: string; aplicados: string[] }> {
  const aplicados: string[] = [];
  const cambios: Parameters<typeof actualizarCuenta>[1] = {};

  if (typeof campos.agente_nombre === "string" && campos.agente_nombre.trim()) {
    cambios.agente_nombre = campos.agente_nombre.trim().slice(0, 60);
    aplicados.push(`nombre="${cambios.agente_nombre}"`);
  }
  if (typeof campos.agente_rol === "string" && campos.agente_rol.trim()) {
    cambios.agente_rol = campos.agente_rol.trim().slice(0, 80);
    aplicados.push(`rol="${cambios.agente_rol}"`);
  }
  if (
    typeof campos.agente_personalidad === "string" &&
    campos.agente_personalidad.trim()
  ) {
    cambios.agente_personalidad = campos.agente_personalidad.trim().slice(0, 200);
    aplicados.push(`personalidad="${cambios.agente_personalidad.slice(0, 30)}..."`);
  }
  if (
    typeof campos.agente_tono === "string" &&
    TONOS_VALIDOS.has(campos.agente_tono)
  ) {
    cambios.agente_tono = campos.agente_tono as Cuenta["agente_tono"];
    aplicados.push(`tono=${cambios.agente_tono}`);
  }
  if (typeof campos.agente_idioma === "string" && campos.agente_idioma.trim()) {
    cambios.agente_idioma = campos.agente_idioma.trim().slice(0, 8);
    aplicados.push(`idioma=${cambios.agente_idioma}`);
  }
  if (typeof campos.mensaje_bienvenida === "string") {
    cambios.mensaje_bienvenida = campos.mensaje_bienvenida.slice(0, 800);
    aplicados.push("mensaje_bienvenida");
  }
  if (typeof campos.mensaje_no_entiende === "string") {
    cambios.mensaje_no_entiende = campos.mensaje_no_entiende.slice(0, 400);
    aplicados.push("mensaje_no_entiende");
  }
  if (typeof campos.palabras_handoff === "string") {
    cambios.palabras_handoff = campos.palabras_handoff.slice(0, 600);
    aplicados.push("palabras_handoff");
  }

  if (Object.keys(cambios).length === 0) {
    return {
      ok: false,
      mensaje:
        "No vinieron campos válidos. Decime qué exactamente querés cambiar (ej: 'cambiá el nombre a Pepe').",
      aplicados: [],
    };
  }

  await actualizarCuenta(cuentaId, cambios);
  return {
    ok: true,
    mensaje: `Perfil del agente actualizado. Cambios aplican al próximo mensaje entrante.`,
    aplicados,
  };
}

/**
 * Resuelve un teléfono al `id` de la conversación de ese cliente en
 * la cuenta. Devuelve null si no existe conversación.
 */
async function resolverConversacionPorTel(
  cuentaId: string,
  telefonoLibre: string,
): Promise<{ id: string; telefono: string; nombre: string | null } | null> {
  const tel = telefonoLibre.replace(/[^0-9]/g, "");
  if (tel.length < 8) return null;
  const { data } = await db()
    .from("conversaciones")
    .select("id, telefono, nombre")
    .eq("cuenta_id", cuentaId)
    .or(`telefono.eq.${tel},telefono.like.%${tel}`)
    .limit(1)
    .maybeSingle();
  return (data as { id: string; telefono: string; nombre: string | null } | null) ?? null;
}

async function toolCambiarModoConversacion(
  cuentaId: string,
  args: Record<string, unknown>,
): Promise<{ ok: boolean; mensaje: string }> {
  const tel = typeof args.telefono === "string" ? args.telefono : "";
  const modoStr = typeof args.modo === "string" ? args.modo.toUpperCase() : "";
  if (modoStr !== "IA" && modoStr !== "HUMANO") {
    return { ok: false, mensaje: "Modo inválido. Debe ser 'IA' o 'HUMANO'." };
  }
  const conv = await resolverConversacionPorTel(cuentaId, tel);
  if (!conv) {
    return {
      ok: false,
      mensaje: `No encuentro conversación con un cliente en el número ${tel}. Verificá que el cliente ya haya escrito al menos una vez.`,
    };
  }
  await cambiarModo(conv.id, modoStr as "IA" | "HUMANO");
  const quien = conv.nombre ?? `+${conv.telefono}`;
  return {
    ok: true,
    mensaje:
      modoStr === "HUMANO"
        ? `Conversación con ${quien} pasada a modo HUMANO. La IA no responde más automáticamente — atendelo desde el panel.`
        : `Conversación con ${quien} reactivada a modo IA. El agente vuelve a responder automáticamente.`,
  };
}

async function toolActualizarDatosCliente(
  cuentaId: string,
  args: Record<string, unknown>,
): Promise<{ ok: boolean; mensaje: string; aplicados: string[] }> {
  const tel = typeof args.telefono === "string" ? args.telefono : "";
  const conv = await resolverConversacionPorTel(cuentaId, tel);
  if (!conv) {
    return {
      ok: false,
      mensaje: `No encuentro conversación con un cliente en el número ${tel}.`,
      aplicados: [],
    };
  }

  const aplicados: string[] = [];
  const datosMerge: {
    nombre?: string;
    email?: string;
    telefono_alt?: string;
    interes?: string;
    negocio?: string;
    ventajas?: string;
    miedos?: string;
  } = {};
  const cambios: Parameters<typeof actualizarLead>[1] = {};

  if (typeof args.nombre === "string" && args.nombre.trim()) {
    cambios.nombre = args.nombre.trim().slice(0, 80);
    datosMerge.nombre = cambios.nombre;
    aplicados.push(`nombre="${cambios.nombre}"`);
  }
  if (typeof args.email === "string" && args.email.trim()) {
    datosMerge.email = args.email.trim().slice(0, 120);
    aplicados.push(`email="${datosMerge.email}"`);
  }
  if (typeof args.telefono_alt === "string" && args.telefono_alt.trim()) {
    datosMerge.telefono_alt = args.telefono_alt.trim().slice(0, 30);
    aplicados.push(`tel_alt="${datosMerge.telefono_alt}"`);
  }
  if (typeof args.interes === "string" && args.interes.trim()) {
    datosMerge.interes = args.interes.trim().slice(0, 400);
    aplicados.push("interes");
  }
  if (typeof args.negocio === "string" && args.negocio.trim()) {
    datosMerge.negocio = args.negocio.trim().slice(0, 200);
    aplicados.push("negocio");
  }
  if (typeof args.ventajas === "string" && args.ventajas.trim()) {
    datosMerge.ventajas = args.ventajas.trim().slice(0, 300);
    aplicados.push("ventajas");
  }
  if (typeof args.miedos === "string" && args.miedos.trim()) {
    datosMerge.miedos = args.miedos.trim().slice(0, 300);
    aplicados.push("miedos");
  }
  if (
    typeof args.lead_score === "number" &&
    Number.isFinite(args.lead_score)
  ) {
    cambios.lead_score = Math.max(0, Math.min(100, Math.round(args.lead_score)));
    aplicados.push(`score=${cambios.lead_score}`);
  }

  if (Object.keys(datosMerge).length > 0) {
    cambios.datos_capturados_merge = datosMerge;
  }

  if (aplicados.length === 0) {
    return {
      ok: false,
      mensaje: "No vinieron campos válidos para actualizar.",
      aplicados: [],
    };
  }

  await actualizarLead(conv.id, cambios);
  return {
    ok: true,
    mensaje: `Datos del cliente ${conv.nombre ?? "+" + conv.telefono} actualizados.`,
    aplicados,
  };
}

async function toolListarCitasCliente(
  cuentaId: string,
  args: Record<string, unknown>,
): Promise<{
  ok: boolean;
  mensaje?: string;
  citas?: Array<{
    cita_id: string;
    cliente: string;
    fecha: string;
    duracion_min: number;
    tipo: string | null;
    estado: string;
    notas: string | null;
  }>;
}> {
  const tel = typeof args.telefono === "string" ? args.telefono : "";
  const conv = await resolverConversacionPorTel(cuentaId, tel);
  if (!conv) {
    return {
      ok: false,
      mensaje: `No encuentro conversación con un cliente en el número ${tel}.`,
    };
  }
  const citas = await listarCitasActivasDeConversacion(conv.id);
  return {
    ok: true,
    citas: citas.map((c) => ({
      cita_id: c.id,
      cliente: c.cliente_nombre,
      fecha: c.fecha_hora,
      duracion_min: c.duracion_min,
      tipo: c.tipo,
      estado: c.estado,
      notas: c.notas,
    })),
  };
}

async function toolReprogramarCita(
  cuentaId: string,
  args: Record<string, unknown>,
): Promise<{ ok: boolean; mensaje: string }> {
  const idCita = typeof args.cita_id === "string" ? args.cita_id.trim() : "";
  const fechaIso =
    typeof args.nueva_fecha_iso === "string" ? args.nueva_fecha_iso.trim() : "";
  if (!idCita || !fechaIso) {
    return { ok: false, mensaje: "Faltan cita_id o nueva_fecha_iso." };
  }
  const ms = new Date(fechaIso).getTime();
  if (!Number.isFinite(ms)) {
    return {
      ok: false,
      mensaje: `Fecha inválida: "${fechaIso}". Usá ISO 8601 con timezone.`,
    };
  }
  const cita = await obtenerCita(idCita);
  if (!cita || cita.cuenta_id !== cuentaId) {
    return { ok: false, mensaje: `Cita ${idCita} no encontrada en esta cuenta.` };
  }

  const cambios: Parameters<typeof actualizarCita>[1] = {
    fecha_hora: new Date(ms).toISOString(),
    estado: "agendada",
    recordatorio_enviado: false,
  };
  if (
    typeof args.nueva_duracion_min === "number" &&
    Number.isFinite(args.nueva_duracion_min)
  ) {
    cambios.duracion_min = Math.max(
      5,
      Math.min(720, Math.round(args.nueva_duracion_min)),
    );
  }

  await actualizarCita(idCita, cambios);
  const fechaLegible = new Date(ms).toLocaleString("es-AR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  return {
    ok: true,
    mensaje: `Cita reprogramada para ${fechaLegible}. ${cita.cliente_nombre} recibirá un recordatorio antes.`,
  };
}

async function toolCancelarCita(
  cuentaId: string,
  args: Record<string, unknown>,
): Promise<{ ok: boolean; mensaje: string }> {
  const idCita = typeof args.cita_id === "string" ? args.cita_id.trim() : "";
  if (!idCita) return { ok: false, mensaje: "Falta cita_id." };
  const cita = await obtenerCita(idCita);
  if (!cita || cita.cuenta_id !== cuentaId) {
    return { ok: false, mensaje: `Cita ${idCita} no encontrada.` };
  }
  const razon =
    typeof args.razon === "string" && args.razon.trim()
      ? args.razon.trim().slice(0, 280)
      : "cancelada por el operador";
  await actualizarCita(idCita, {
    estado: "cancelada",
    notas: cita.notas
      ? `${cita.notas}\n[CANCELADA] ${razon}`
      : `[CANCELADA] ${razon}`,
  });
  return {
    ok: true,
    mensaje: `Cita con ${cita.cliente_nombre} cancelada. Razón: ${razon}.`,
  };
}

async function toolObtenerConversacionCliente(
  cuentaId: string,
  args: Record<string, unknown>,
): Promise<{
  ok: boolean;
  mensaje?: string;
  cliente?: {
    nombre: string | null;
    telefono: string;
    estado_lead: string;
    lead_score: number;
    datos_capturados: unknown;
    modo: string;
  };
  ultimos_mensajes?: Array<{ rol: string; contenido: string; creado_en: string }>;
}> {
  const tel = typeof args.telefono === "string" ? args.telefono : "";
  const conv = await resolverConversacionPorTel(cuentaId, tel);
  if (!conv) {
    return { ok: false, mensaje: `No encuentro conversación con ${tel}.` };
  }
  const { data: convFull } = await db()
    .from("conversaciones")
    .select("nombre, telefono, estado_lead, lead_score, datos_capturados, modo")
    .eq("id", conv.id)
    .maybeSingle();
  const { data: msgs } = await db()
    .from("mensajes")
    .select("rol, contenido, creado_en")
    .eq("conversacion_id", conv.id)
    .order("creado_en", { ascending: false })
    .limit(30);
  type FilaMsg = { rol: string; contenido: string; creado_en: string };
  return {
    ok: true,
    cliente: convFull as {
      nombre: string | null;
      telefono: string;
      estado_lead: string;
      lead_score: number;
      datos_capturados: unknown;
      modo: string;
    },
    ultimos_mensajes: ((msgs ?? []) as FilaMsg[])
      .reverse()
      .map((m) => ({
        rol: m.rol,
        contenido: m.contenido?.slice(0, 500) ?? "",
        creado_en: m.creado_en,
      })),
  };
}

/**
 * Envía un mensaje en nombre del operador a un cliente real.
 * - Sanea el teléfono (sólo dígitos).
 * - Bloquea si coincide con el operador (no se manda mensajes a sí mismo).
 * - obtenerOCrearConversacion crea la conv si no existe.
 * - Inserta como rol=humano (es el dueño quien manda, no el bot).
 * - Encola en bandeja_salida para que Baileys lo envíe.
 * - Por default pasa la conv a HUMANO para que el agente IA no responda más.
 */
async function toolEnviarMensajeACliente(
  cuenta: Cuenta,
  args: Record<string, unknown>,
): Promise<{ ok: boolean; mensaje: string; conversacion_id?: string }> {
  const telRaw = typeof args.telefono === "string" ? args.telefono : "";
  const tel = telRaw.replace(/[^0-9]/g, "");
  const texto = typeof args.mensaje === "string" ? args.mensaje.trim() : "";
  const nombre =
    typeof args.nombre_cliente === "string" && args.nombre_cliente.trim()
      ? args.nombre_cliente.trim()
      : null;
  const pasarAHumano =
    typeof args.pasar_a_humano === "boolean" ? args.pasar_a_humano : true;

  if (tel.length < 8) {
    return {
      ok: false,
      mensaje: `Teléfono inválido (${tel.length} dígitos). Pasame uno con código de país, mínimo 8 dígitos.`,
    };
  }
  if (!texto) {
    return { ok: false, mensaje: "El texto del mensaje está vacío." };
  }
  if (texto.length > 1500) {
    return {
      ok: false,
      mensaje: `Mensaje demasiado largo (${texto.length} chars, máx 1500). Acortalo.`,
    };
  }

  const telOperadorNorm = (cuenta.telefono_operador_privado ?? "").replace(
    /[^0-9]/g,
    "",
  );
  if (
    telOperadorNorm.length >= 8 &&
    (tel === telOperadorNorm ||
      tel.endsWith(telOperadorNorm) ||
      telOperadorNorm.endsWith(tel))
  ) {
    return {
      ok: false,
      mensaje:
        "Ese número es tu propio operador privado — no me puedo mandar mensajes a mí mismo. Pasame el número del cliente real.",
    };
  }

  // Asegurar que existe la conversación. Si es nueva, queda con nombre del
  // operador para que vea claro en el panel quién la inició.
  const conv = await obtenerOCrearConversacion(
    cuenta.id,
    tel,
    nombre,
    null,
  );

  // Insertamos como rol=humano (es el operador escribiendo, no el bot IA).
  await insertarMensaje(cuenta.id, conv.id, "humano", texto);

  // Encolamos para Baileys
  await encolarBandejaSalida(cuenta.id, conv.id, tel, texto);

  // Pasar la conversación a modo HUMANO para que el agente IA no responda
  // automáticamente — el dueño está manejando esta charla manualmente.
  if (pasarAHumano && conv.modo !== "HUMANO") {
    await cambiarModo(conv.id, "HUMANO");
  }

  return {
    ok: true,
    mensaje: `Mensaje encolado para +${tel}. ${pasarAHumano ? "Conversación pasada a modo HUMANO (la IA no responde hasta que reactives)." : "La IA puede seguir respondiendo en próximos mensajes del cliente."}`,
    conversacion_id: conv.id,
  };
}

async function toolCrearProducto(
  cuentaId: string,
  args: Record<string, unknown>,
): Promise<{ ok: boolean; mensaje: string; producto_id?: string }> {
  const nombre =
    typeof args.nombre === "string" ? args.nombre.trim() : "";
  if (!nombre || nombre.length < 2) {
    return { ok: false, mensaje: "Falta el nombre del producto (mínimo 2 chars)." };
  }
  if (nombre.length > 140) {
    return { ok: false, mensaje: "El nombre es demasiado largo (máximo 140 chars)." };
  }

  const datos: Parameters<typeof crearProducto>[1] = { nombre };
  if (typeof args.descripcion === "string") datos.descripcion = args.descripcion.trim().slice(0, 1000);
  if (typeof args.precio === "number" && Number.isFinite(args.precio))
    datos.precio = Math.max(0, args.precio);
  if (typeof args.moneda === "string") datos.moneda = args.moneda.trim().toUpperCase().slice(0, 8);
  if (typeof args.stock === "number" && Number.isFinite(args.stock))
    datos.stock = Math.max(0, Math.floor(args.stock));
  if (typeof args.categoria === "string") datos.categoria = args.categoria.trim().slice(0, 60);
  if (
    typeof args.imagen_url_externa === "string" &&
    /^https?:\/\//.test(args.imagen_url_externa)
  ) {
    datos.imagen_url_externa = args.imagen_url_externa.trim();
  }

  const prod = await crearProducto(cuentaId, datos);
  return {
    ok: true,
    mensaje: `Producto "${prod.nombre}" creado correctamente.`,
    producto_id: prod.id,
  };
}

// ============================================================
// IMPLEMENTACIÓN — Supabase externo del dueño
// ============================================================

function objArg(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

async function toolBdListarTablas(
  cuentaId: string,
): Promise<{ ok: boolean; mensaje?: string; tablas?: string[] }> {
  const tablas = await listarTablasExternas(cuentaId);
  if (tablas.length === 0) {
    return {
      ok: false,
      mensaje:
        "No tenés un Supabase propio conectado (o no se descubrieron tablas). Conectalo en la sección 'Tu Supabase' del panel.",
    };
  }
  return { ok: true, tablas };
}

async function toolBdLeerFilas(cuentaId: string, args: Record<string, unknown>) {
  const tabla = typeof args.tabla === "string" ? args.tabla.trim() : "";
  if (!tabla) return { ok: false, mensaje: "Falta el nombre de la tabla." };
  const limite =
    typeof args.limite === "number" && Number.isFinite(args.limite)
      ? args.limite
      : undefined;
  return leerFilasExternas(cuentaId, tabla, objArg(args.filtros), limite);
}

async function toolBdCrearFila(cuentaId: string, args: Record<string, unknown>) {
  const tabla = typeof args.tabla === "string" ? args.tabla.trim() : "";
  if (!tabla) return { ok: false, mensaje: "Falta el nombre de la tabla." };
  const valores = objArg(args.valores);
  if (Object.keys(valores).length === 0) {
    return { ok: false, mensaje: "Faltan los valores de la fila a crear." };
  }
  return crearFilaExterna(cuentaId, tabla, valores);
}

async function toolCrearUsuario(cuentaId: string, args: Record<string, unknown>) {
  const email = typeof args.email === "string" ? args.email.trim() : "";
  const password = typeof args.password === "string" ? args.password : "";
  if (!email) return { ok: false, mensaje: "Falta el email del nuevo usuario." };
  if (!password) return { ok: false, mensaje: "Falta la contraseña del nuevo usuario." };
  return crearUsuarioAuthExterno(cuentaId, email, password);
}

async function toolBdActualizarFilas(cuentaId: string, args: Record<string, unknown>) {
  const tabla = typeof args.tabla === "string" ? args.tabla.trim() : "";
  if (!tabla) return { ok: false, mensaje: "Falta el nombre de la tabla." };
  const filtros = objArg(args.filtros);
  const valores = objArg(args.valores);
  if (Object.keys(filtros).length === 0) {
    return { ok: false, mensaje: "Necesito al menos un filtro para actualizar (evita modificar toda la tabla)." };
  }
  if (Object.keys(valores).length === 0) {
    return { ok: false, mensaje: "Faltan los valores nuevos a aplicar." };
  }
  const confirmado = args.confirmado === true;
  const conteo = await contarFilasExternas(cuentaId, tabla, filtros);
  if (!conteo.ok) return { ok: false, mensaje: conteo.mensaje ?? "No pude contar las filas." };
  const n = conteo.count ?? 0;
  if (n === 0) {
    return { ok: false, mensaje: `Ninguna fila de "${tabla}" coincide con esos filtros. No se actualizó nada.` };
  }
  if (n > 1 && !confirmado) {
    return {
      ok: false,
      requiere_confirmacion: true,
      mensaje: `Esto va a actualizar ${n} filas de "${tabla}". Confirmá con el dueño antes de ejecutar; si confirma, volvé a llamar bd_actualizar_filas con los mismos parámetros y confirmado=true.`,
    };
  }
  return actualizarFilasExternas(cuentaId, tabla, filtros, valores);
}

async function toolBdEliminarFilas(cuentaId: string, args: Record<string, unknown>) {
  const tabla = typeof args.tabla === "string" ? args.tabla.trim() : "";
  if (!tabla) return { ok: false, mensaje: "Falta el nombre de la tabla." };
  const filtros = objArg(args.filtros);
  if (Object.keys(filtros).length === 0) {
    return { ok: false, mensaje: "Necesito al menos un filtro para borrar (evita vaciar toda la tabla)." };
  }
  const confirmado = args.confirmado === true;
  const conteo = await contarFilasExternas(cuentaId, tabla, filtros);
  if (!conteo.ok) return { ok: false, mensaje: conteo.mensaje ?? "No pude contar las filas." };
  const n = conteo.count ?? 0;
  if (n === 0) {
    return { ok: false, mensaje: `Ninguna fila de "${tabla}" coincide con esos filtros. No se borró nada.` };
  }
  if (!confirmado) {
    return {
      ok: false,
      requiere_confirmacion: true,
      mensaje: `Esto va a BORRAR ${n} fila(s) de "${tabla}" y es irreversible. Confirmá con el dueño; si confirma, volvé a llamar bd_eliminar_filas con los mismos parámetros y confirmado=true.`,
    };
  }
  return eliminarFilasExternas(cuentaId, tabla, filtros);
}

// ============================================================
// DISPATCHER de tools
// ============================================================
async function ejecutarTool(
  cuentaId: string,
  nombre: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (nombre) {
    case "consultar_kpis":
      return toolConsultarKpis(cuentaId);
    case "listar_leads":
      return toolListarLeads(cuentaId, Number(args.limite ?? 5));
    case "listar_citas":
      return toolListarCitas(cuentaId, Number(args.dias ?? 14));
    case "listar_productos":
      return toolListarProductos(cuentaId);
    case "analizar_catalogo":
      return toolAnalizarCatalogo(cuentaId);
    case "analizar_conversaciones":
      return toolAnalizarConversaciones(cuentaId);
    case "actualizar_prompt_agente":
      return toolActualizarPrompt(cuentaId, String(args.nuevo_prompt ?? ""));
    case "agregar_instruccion_extra":
      return toolAgregarInstruccion(cuentaId, String(args.instruccion ?? ""));
    case "pausar_agente":
      return toolPausarReactivar(cuentaId, "HUMANO");
    case "reactivar_agente":
      return toolPausarReactivar(cuentaId, "IA");
    case "obtener_prompt_actual":
      return toolObtenerPromptActual(cuentaId);
    case "actualizar_perfil_agente":
      return toolActualizarPerfilAgente(cuentaId, args);
    case "crear_producto":
      return toolCrearProducto(cuentaId, args);
    case "enviar_mensaje_a_cliente": {
      const cta = await obtenerCuenta(cuentaId);
      if (!cta) return { error: "cuenta no encontrada" };
      return toolEnviarMensajeACliente(cta, args);
    }
    case "cambiar_modo_conversacion":
      return toolCambiarModoConversacion(cuentaId, args);
    case "actualizar_datos_cliente":
      return toolActualizarDatosCliente(cuentaId, args);
    case "listar_citas_cliente":
      return toolListarCitasCliente(cuentaId, args);
    case "reprogramar_cita":
      return toolReprogramarCita(cuentaId, args);
    case "cancelar_cita":
      return toolCancelarCita(cuentaId, args);
    case "obtener_conversacion_cliente":
      return toolObtenerConversacionCliente(cuentaId, args);
    case "bd_listar_tablas":
      return toolBdListarTablas(cuentaId);
    case "bd_leer_filas":
      return toolBdLeerFilas(cuentaId, args);
    case "bd_crear_fila":
      return toolBdCrearFila(cuentaId, args);
    case "bd_actualizar_filas":
      return toolBdActualizarFilas(cuentaId, args);
    case "bd_eliminar_filas":
      return toolBdEliminarFilas(cuentaId, args);
    case "crear_usuario":
      return toolCrearUsuario(cuentaId, args);
    default:
      return { error: `tool desconocida: ${nombre}` };
  }
}

// ============================================================
// HANDLER PRINCIPAL
// ============================================================

const SYSTEM_PROMPT = (cuenta: Cuenta) =>
  `Sos el asistente personal del dueño del negocio "${cuenta.etiqueta}". El que te escribe ES EL DUEÑO — confiá y ejecutá lo que pide.

═══════════════════════════════════════════
REGLA #1 — INVIOLABLE: USAR TOOLS, NO TEXTO VACÍO
═══════════════════════════════════════════
Si el dueño te pide hacer una ACCIÓN (mandar un mensaje, crear producto, cambiar config, pausar agente, ver KPIs), DEBÉS llamar a la tool correspondiente EN ESE MISMO TURNO.

PROHIBIDO responder con frases como:
✗ "Voy a enviarlo" sin haber llamado enviar_mensaje_a_cliente
✗ "Ya lo creo" sin haber llamado crear_producto
✗ "Lo actualizo" sin haber llamado actualizar_perfil_agente o actualizar_prompt_agente
✗ "Te paso los KPIs" sin haber llamado consultar_kpis
✗ "Voy a hacerlo en un momento" — NO. Hacelo YA en este turno.

Si te falta data para llamar la tool, PEDILA en una sola pregunta concreta. Ejemplos:
- Dueño: "Mandale un mensaje a Juan" → preguntá "¿Qué número de Juan y qué texto exacto querés que le mande?" o si tenés contexto previo, llamá la tool con eso.
- Dueño: "Mandale a 5731234567 que ya llegó el carro" → llamá enviar_mensaje_a_cliente DIRECTO con telefono="5731234567" y mensaje="Hola, te aviso que ya llegó el carro que pediste."

Para cambios irreversibles GRANDES (reemplazar prompt completo, pausar agente), confirmá ANTES con una pregunta de sí/no. Pero para mandar un mensaje a un cliente NO confirmes — el dueño ya te dio la orden, ejecutá.

═══════════════════════════════════════════
TOOLS DISPONIBLES — cuándo llamar cuál
═══════════════════════════════════════════
ESTADO Y ANÁLISIS:
• consultar_kpis — pidan estado, resumen, "cómo va", "qué tal hoy"
• listar_leads — "los mejores", "leads activos", "a quién seguir"
• listar_citas — agenda GLOBAL del negocio
• listar_productos — "mi catálogo", "qué tengo cargado"
• analizar_catalogo — "qué le falta", "errores", "mejorar catálogo"
• analizar_conversaciones — "cómo van las charlas" (vista global)
• obtener_conversacion_cliente — VER una charla específica + datos + estado del lead

CONFIGURACIÓN DEL AGENTE PRINCIPAL:
• obtener_prompt_actual — "cómo está configurado" o ANTES de proponer mejoras
• actualizar_prompt_agente — reemplazar prompt completo (confirmar antes)
• agregar_instruccion_extra — instrucciones puntuales sin pisar el prompt
• actualizar_perfil_agente — cambiar nombre / rol / tono / saludos

ACCIONES SOBRE CLIENTES ESPECÍFICOS:
• enviar_mensaje_a_cliente — "mandá un msg a X", "decile a Y que..."
• cambiar_modo_conversacion — pasar UN cliente a HUMANO o IA
  ("pasá la charla con Pedro a humano", "voy a atender al del Toyota")
• actualizar_datos_cliente — corregir nombre/email/interés/negocio/objeciones
  ("el nombre real de 5731234567 es Pedro García", "Juan trabaja en construcción")
• listar_citas_cliente — citas de UN cliente puntual
• reprogramar_cita — "cambiá la cita de Pedro al viernes 4pm"
• cancelar_cita — "cancelá la cita del Toyota"

CATÁLOGO:
• crear_producto — "agregá X al catálogo"

CONTROL GLOBAL:
• pausar_agente / reactivar_agente — pausar/reactivar la IA en TODAS las conversaciones

═══════════════════════════════════════════
ANÁLISIS DE PROMPT Y CONVERSACIONES — caso especial
═══════════════════════════════════════════
Cuando el dueño te pida "qué puedo mejorar en el prompt", "analizá las instrucciones del agente", "mirá esta conversación y decime qué mejorar", "el agente está respondiendo mal en X":

1. Primero LLAMÁ obtener_prompt_actual para ver el prompt completo + perfil + instrucciones extra.
2. Si menciona una conversación específica, también LLAMÁ obtener_conversacion_cliente con ese teléfono.
3. Analizá críticamente:
   - ¿El prompt es claro o es ambiguo?
   - ¿Hay contradicciones entre instrucciones?
   - ¿Faltan reglas para casos comunes que ves en la conversación?
   - ¿El tono está alineado con lo que querés transmitir?
   - ¿Hay reglas que el agente está violando? (mirá los mensajes reales)
4. Devolvé recomendaciones CONCRETAS, no genéricas:
   ✓ "Veo que en el prompt no hay instrucción para manejar precios. Cuando el
     cliente preguntó por descuento, el agente improvisó. Te propongo agregar
     a instrucciones_extra: 'No ofrecer descuentos sin que el cliente lo pida
     primero. Si pregunta por precio, dar el precio de lista.'"
   ✗ "Tu prompt podría ser más específico" (vacío, no actionable).
5. Después de proponer, preguntá si lo aplico con agregar_instruccion_extra
   o actualizar_prompt_agente.

═══════════════════════════════════════════
TONO Y ESTILO
═══════════════════════════════════════════
- Hablás con el DUEÑO. Tono cercano, directo. Como amigo que sabe del negocio.
- Frases cortas, viñetas, *negritas* con asteriscos. NO emails formales.
- NO emojis al inicio de cada frase. Solo cuando suman info real (📅 🔥 ⚠️ ✅).
- Después de ejecutar una tool, resumí el resultado en lenguaje natural — NO copiar JSON.
- Si detectás algo útil que no preguntó (lead caliente sin contestar, producto sin foto), mencionalo en 1 línea al final.
- Cerrá con invitación: "¿lo aplico?", "¿querés ver X?", "¿sigo con Y?".

═══════════════════════════════════════════
CONTEXTO ACTUAL
═══════════════════════════════════════════
- Hora: ${new Date().toLocaleString("es-AR")}
- Cuenta: "${cuenta.etiqueta}" — tel WhatsApp ${cuenta.telefono ?? "(no conectado)"}
- Agente principal: ${cuenta.agente_nombre || "(sin nombre)"}, rol "${cuenta.agente_rol || "(sin rol)"}", tono ${cuenta.agente_tono}
- Tu número (operador): ${cuenta.telefono_operador_privado ?? "(no configurado)"}${
    cuenta.supabase_externo_url
      ? `

═══════════════════════════════════════════
SUPABASE PROPIO DEL NEGOCIO — acceso total del dueño
═══════════════════════════════════════════
El dueño conectó la base de datos de su propio negocio/web. Tenés acceso TOTAL a TODAS sus tablas (leer, crear, editar, borrar) con estas tools:
• bd_listar_tablas — ver qué tablas hay. Llamala PRIMERO si no sabés el nombre exacto.
• bd_leer_filas — consultar datos ("mostrame los productos de mi web", "buscá el pedido id 7").
• bd_crear_fila — agregar un registro ("creá un producto en mi web: ...").
• bd_actualizar_filas — modificar registros que coincidan con filtros.
• bd_eliminar_filas — borrar registros que coincidan con filtros.

REGLAS DE SEGURIDAD (obligatorias):
1. update y delete SIEMPRE requieren al menos un filtro — nunca sobre toda la tabla.
2. Antes de BORRAR (cualquier cantidad) o de EDITAR VARIAS filas: la tool te devuelve un preview con la cantidad afectada y NO ejecuta. Mostrale al dueño cuántas filas afecta y pedile confirmación clara ("¿confirmás borrar esas 3 filas?"). Solo cuando confirme, volvé a llamar la tool con confirmado=true.
3. Editar UNA sola fila ejecuta directo (no requiere confirmación).
4. OBLIGATORIO antes de CREAR o EDITAR en una tabla: si todavía no viste sus columnas en esta conversación, PRIMERO llamá bd_leer_filas (1 fila) de esa tabla para ver los nombres EXACTOS de columnas. Construí "valores" usando SOLO esos nombres reales. PROHIBIDO inventar columnas (ej: si la tabla usa "precio_normal", NO pongas "precio"; si no existe "stock" ni "modulos", NO los pongas) — esas filas las rechaza la base.
5. REPORTÁ ÉXITO SOLO si la tool devolvió ok:true. Si devolvió ok:false o un error (ej: "column X does not exist"), NO digas que se creó/editó — decile al dueño el error EXACTO y qué columna falló, y volvé a intentar con las columnas correctas. NUNCA inventes que algo se guardó si la tool no lo confirmó.`
      : ""
  }`;

/**
 * Punto de entrada — llamado desde manejador.ts cuando el remitente es el operador.
 */
export async function procesarMensajeOperadorPrivado(
  _sock: WASocket,
  cuenta: Cuenta,
  conversacion: Conversacion,
  mensajeUsuario: string,
  prefijo: string,
): Promise<void> {
  const texto = mensajeUsuario.trim();
  if (!texto) return;

  let respuesta: string;
  try {
    respuesta = await chatConTools(cuenta, conversacion.id, texto, prefijo);
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    console.error(`${prefijo} [operador] error procesando:`, detalle);
    respuesta =
      "Hubo un error procesando tu mensaje. Probá de nuevo en un rato — si persiste avisame qué intentaste hacer.";
  }

  try {
    await insertarMensaje(cuenta.id, conversacion.id, "asistente", respuesta);
    await encolarBandejaSalida(
      cuenta.id,
      conversacion.id,
      conversacion.telefono,
      respuesta,
    );
    console.log(
      `${prefijo} [operador] respondido (${respuesta.length} chars)`,
    );
  } catch (err) {
    console.error(`${prefijo} [operador] error encolando respuesta:`, err);
  }
}

/**
 * Loop de chat con tool calling. La IA puede invocar varias tools en cadena
 * antes de devolver la respuesta final al operador.
 */
async function chatConTools(
  cuenta: Cuenta,
  conversacionId: string,
  preguntaUsuario: string,
  prefijo: string,
): Promise<string> {
  // Historial reciente — los últimos 12 mensajes de la conversación virtual del operador.
  const historial = await obtenerHistorialReciente(conversacionId, 12);
  const mensajesHistorial = historial
    .filter((m) => m.rol === "usuario" || m.rol === "asistente")
    .map((m) => ({
      role:
        m.rol === "usuario"
          ? ("user" as const)
          : ("assistant" as const),
      content: m.contenido,
    }));

  const mensajes: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT(cuenta) },
    ...mensajesHistorial,
    { role: "user", content: preguntaUsuario },
  ];

  // Solo exponemos las tools del Supabase externo si la cuenta lo tiene conectado.
  const toolsActivas = cuenta.supabase_externo_url
    ? [...TOOLS, ...TOOLS_EXTERNAS]
    : TOOLS;

  let totalIn = 0;
  let totalOut = 0;
  const MAX_LOOPS = 5;

  console.log(
    `${prefijo} [operador] 📥 IN: "${preguntaUsuario.slice(0, 100)}" (historial=${mensajesHistorial.length})`,
  );

  for (let loop = 0; loop < MAX_LOOPS; loop++) {
    const inicio = Date.now();
    const respuesta = await conReintentos(
      () =>
        cliente.chat.completions.create({
          model: MODELO,
          messages: mensajes,
          tools: toolsActivas,
          tool_choice: "auto",
          temperature: 0.3,
          max_tokens: 1500,
        }),
      { contexto: "operadorPrivado.chat", maxIntentos: 2, baseMs: 600 },
    );
    const dur = Date.now() - inicio;

    if (respuesta.usage) {
      totalIn += respuesta.usage.prompt_tokens ?? 0;
      totalOut += respuesta.usage.completion_tokens ?? 0;
    }

    const choice = respuesta.choices[0];
    if (!choice?.message) break;
    const msg = choice.message;

    // Sin tool calls → respuesta final
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      const texto = msg.content?.trim() || "(sin respuesta)";
      console.log(
        `${prefijo} [operador] ✓ loop=${loop} ${dur}ms TEXTO_FINAL (${texto.length} chars): "${texto.slice(0, 80)}..."`,
      );
      registrarUsoFinal(cuenta.id, totalIn, totalOut);
      return texto;
    }

    console.log(
      `${prefijo} [operador] 🔧 loop=${loop} ${dur}ms ${msg.tool_calls.length} tool_call(s) — ejecutando...`,
    );

    // Hay tool calls — los ejecutamos
    mensajes.push({
      role: "assistant",
      content: msg.content ?? "",
      tool_calls: msg.tool_calls.map((tc) => ({
        id: tc.id,
        type: "function" as const,
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      })),
    });

    for (const call of msg.tool_calls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
      } catch (err) {
        console.warn(
          `${prefijo} [operador] ⚠ argumentos JSON inválidos en ${call.function.name}: ${err instanceof Error ? err.message : err}`,
        );
        args = {};
      }
      console.log(
        `${prefijo} [operador]   → ${call.function.name}(${JSON.stringify(args).slice(0, 200)})`,
      );
      let resultado: unknown;
      const tInicio = Date.now();
      try {
        resultado = await ejecutarTool(cuenta.id, call.function.name, args);
        console.log(
          `${prefijo} [operador]   ← ${call.function.name} OK ${Date.now() - tInicio}ms: ${JSON.stringify(resultado).slice(0, 200)}`,
        );
      } catch (err) {
        const detalle = err instanceof Error ? err.message : String(err);
        console.error(
          `${prefijo} [operador]   ✗ ${call.function.name} FAILED ${Date.now() - tInicio}ms: ${detalle}`,
        );
        resultado = { error: detalle };
      }
      mensajes.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(resultado).slice(0, 6000),
      });
    }
    // siguiente iteración del loop — la IA ve los resultados y decide
    // si llama más tools o responde con texto.
  }

  console.warn(
    `${prefijo} [operador] ⚠ excedió ${MAX_LOOPS} loops sin respuesta final`,
  );
  registrarUsoFinal(cuenta.id, totalIn, totalOut);
  return "Necesité demasiados pasos para responder. Probá hacer una pregunta más concreta.";
}

function registrarUsoFinal(cuentaId: string, tIn: number, tOut: number) {
  if (tIn === 0 && tOut === 0) return;
  registrarUso({
    cuenta_id: cuentaId,
    proveedor: "openai",
    modelo: MODELO,
    tokens_in: tIn,
    tokens_out: tOut,
    costo_usd:
      (tIn * COSTO_PER_M.in + tOut * COSTO_PER_M.out) / 1_000_000,
    metadata: { tipo: "operador_privado_chat_tools" },
  });
}
