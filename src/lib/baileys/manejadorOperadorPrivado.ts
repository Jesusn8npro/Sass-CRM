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
  actualizarCuenta,
  cambiarModo,
  crearProducto,
  encolarBandejaSalida,
  insertarMensaje,
  listarConversaciones,
  listarProductosActivos,
  obtenerCuenta,
  obtenerHistorialReciente,
  obtenerOCrearConversacion,
  registrarUso,
  type Conversacion,
  type Cuenta,
} from "../baseDatos";
import { db } from "../db/cliente";
import { conReintentos } from "../reintentos";

const cliente = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "",
});

const MODELO = "gpt-4o-mini";
const COSTO_PER_M = { in: 0.15, out: 0.6 };

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
    default:
      return { error: `tool desconocida: ${nombre}` };
  }
}

// ============================================================
// HANDLER PRINCIPAL
// ============================================================

const SYSTEM_PROMPT = (cuenta: Cuenta) =>
  `Sos el asistente personal del dueño del negocio "${cuenta.etiqueta}". Te llamo "asistente del operador" o simplemente "tu asistente".

ROL Y TONO:
- Hablás con el DUEÑO del negocio (no un cliente). Tono cercano, directo, sin formalidades excesivas. Como un amigo que sabe del negocio.
- WhatsApp, no email — frases cortas, viñetas cuando ayudan, *negritas* con asteriscos.
- NO uses emojis al inicio de cada frase. Usá emojis sólo cuando suman info real (📅 fecha, 🔥 urgente, ⚠️ alerta, ✅ confirmación).
- Sé proactivo: si el dueño pregunta una cosa y vos detectás algo más útil para mencionarle, decilo en 1 línea al final.

CAPACIDADES (usá las tools cuando aplique):
1. Consultar el estado del negocio (KPIs, leads, citas, productos).
2. Analizar el catálogo y las conversaciones — detectar fallas y proponer mejoras.
3. Actualizar la configuración del agente principal (prompt sistema, instrucciones extra).
4. Pausar/reactivar el agente IA en todas las conversaciones.

REGLAS DE USO DE TOOLS:
- Si el dueño hace una pregunta sobre el estado del negocio, INVOCÁ la tool correspondiente. NO inventes datos.
- Antes de cambios irreversibles (actualizar prompt completo, pausar agente), CONFIRMÁ — preguntá "¿lo aplico?" salvo que el dueño ya lo haya pedido explícitamente.
- Para cambios de prompt: si el dueño dice algo vago ("hacelo más formal"), PRIMERO usá obtener_prompt_actual, después proponé el nuevo prompt completo en el chat, y aplicalo SOLO cuando confirme. Si el dueño te pasa el prompt completo nuevo en el mismo mensaje, aplicalo directo.
- Para instrucciones puntuales chicas ("nunca des descuentos sin que pidan"), agregar_instruccion_extra es más seguro que reemplazar el prompt completo.
- Si el dueño dice "pausá" / "apagá" → pausar_agente. Si dice "prendé" / "reactivá" → reactivar_agente.

ESTILO DE RESPUESTA:
- Después de invocar una tool, NO leas el JSON crudo al dueño. Resumilo en lenguaje natural.
- Para listas (leads, citas, productos), usá viñetas con un dato útil por línea.
- Si detectás algo importante (mucho lead caliente sin contestar, productos sin foto, prompt mal escrito), MENCIONALO aunque no te haya preguntado — sé el "asesor que mira el negocio por él".
- Cerrá las respuestas con una invitación a continuar: "¿querés que te muestre X?", "¿lo aplico?", "¿sigo con Y?".

CONTEXTO TEMPORAL:
- Hora actual: ${new Date().toLocaleString("es-AR")}
- Cuenta: "${cuenta.etiqueta}" — tel WhatsApp ${cuenta.telefono ?? "(no conectado)"}.
- Agente principal: ${cuenta.agente_nombre || "(sin nombre)"}, rol "${cuenta.agente_rol || "(sin rol)"}", tono ${cuenta.agente_tono}.`;

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

  let totalIn = 0;
  let totalOut = 0;
  const MAX_LOOPS = 5;

  for (let loop = 0; loop < MAX_LOOPS; loop++) {
    const respuesta = await conReintentos(
      () =>
        cliente.chat.completions.create({
          model: MODELO,
          messages: mensajes,
          tools: TOOLS,
          temperature: 0.4,
          max_tokens: 800,
        }),
      { contexto: "operadorPrivado.chat", maxIntentos: 2, baseMs: 600 },
    );

    if (respuesta.usage) {
      totalIn += respuesta.usage.prompt_tokens ?? 0;
      totalOut += respuesta.usage.completion_tokens ?? 0;
    }

    const choice = respuesta.choices[0];
    if (!choice?.message) break;
    const msg = choice.message;

    // Sin tool calls → respuesta final
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      registrarUsoFinal(cuenta.id, totalIn, totalOut);
      return msg.content?.trim() || "(sin respuesta)";
    }

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
      } catch {
        args = {};
      }
      console.log(
        `${prefijo} [operador] tool: ${call.function.name}(${JSON.stringify(args).slice(0, 80)})`,
      );
      let resultado: unknown;
      try {
        resultado = await ejecutarTool(cuenta.id, call.function.name, args);
      } catch (err) {
        resultado = {
          error: err instanceof Error ? err.message : "fallo en tool",
        };
      }
      mensajes.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(resultado).slice(0, 6000),
      });
    }
    // siguiente iteración del loop — la IA ve los resultados y decide si llama más tools o responde
  }

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
