/**
 * Generador de artículos de blog con OpenAI.
 *
 * Recibe un tema (string libre) + opciones, devuelve un objeto con todo
 * lo necesario para crear un artículo (título, slug, resumen, contenido
 * markdown, metadata SEO, tags sugeridos).
 *
 * Usa Chat Completions con `response_format: json_schema strict` —
 * misma técnica que el bot principal, asegura output válido.
 */
import OpenAI from "openai";
import { calcularTiempoLectura } from "./markdown";
import { slugificar } from "./slug";

const MODELO = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

let _cliente: OpenAI | null = null;
function cliente(): OpenAI {
  if (!_cliente) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY no está seteada");
    }
    _cliente = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _cliente;
}

export interface ImagenInlineSugerida {
  /** Prompt en INGLÉS para Nano Banana (mejor calidad en EN). */
  prompt: string;
  /** Texto alt en español, para SEO/accesibilidad. */
  alt_text: string;
  /** Número del H2 después del cual va la imagen (1-indexed). */
  despues_de_h2_numero: number;
}

export interface ArticuloGenerado {
  titulo: string;
  slug_sugerido: string;
  resumen: string;
  contenido_md: string;
  seo_titulo: string;
  seo_descripcion: string;
  seo_keywords: string[];
  tags_sugeridos: string[];
  tiempo_lectura_min: number;
  imagen_prompt_sugerido: string;
  /** 0-2 sugerencias para imágenes ilustrativas dentro del cuerpo.
   *  El orquestador decide cuántas materializar según el modo. */
  imagenes_inline_sugeridas: ImagenInlineSugerida[];
}

const ESQUEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "titulo",
    "slug_sugerido",
    "resumen",
    "contenido_md",
    "seo_titulo",
    "seo_descripcion",
    "seo_keywords",
    "tags_sugeridos",
    "imagen_prompt_sugerido",
    "imagenes_inline_sugeridas",
  ],
  properties: {
    titulo: { type: "string", description: "60-120 caracteres" },
    slug_sugerido: { type: "string", description: "kebab-case, ASCII only" },
    resumen: { type: "string", description: "140-300 caracteres, gancho SEO" },
    contenido_md: {
      type: "string",
      description: "1500-3500 palabras markdown",
    },
    seo_titulo: { type: "string", description: "max 65 chars" },
    seo_descripcion: { type: "string", description: "max 160 chars" },
    seo_keywords: {
      type: "array",
      items: { type: "string" },
      description: "3-7 keywords",
    },
    tags_sugeridos: {
      type: "array",
      items: { type: "string" },
      description: "3-6 tags",
    },
    imagen_prompt_sugerido: {
      type: "string",
      description: "Prompt en INGLÉS para la imagen de portada (Nano Banana funciona mejor en EN)",
    },
    imagenes_inline_sugeridas: {
      type: "array",
      description:
        "EXACTAMENTE 2 sugerencias de imágenes ilustrativas para el cuerpo del artículo. Cada una se insertará después de un H2 específico. El orquestador decide cuántas materializar según presupuesto.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["prompt", "alt_text", "despues_de_h2_numero"],
        properties: {
          prompt: {
            type: "string",
            description:
              "Prompt en INGLÉS, fotorrealista o ilustración editorial moderna. Sin texto renderizado. Que ilustre concretamente el concepto del H2 al que acompaña.",
          },
          alt_text: {
            type: "string",
            description:
              "Texto alt en español, descriptivo y con keyword del artículo si encaja natural. Máx 125 chars.",
          },
          despues_de_h2_numero: {
            type: "integer",
            description:
              "1-indexed: 1 = después del primer H2, 2 = segundo, 3 = tercero. Distribuir entre las 2 sugerencias para que el artículo respire visualmente (ej: H2 #2 y H2 #4).",
          },
        },
      },
    },
  },
} as const;

const PROMPT_SISTEMA = `Eres un copywriter experto en SEO y marketing digital para SaaS.
Escribes artículos de blog en ESPAÑOL NEUTRO (válido para España y Latinoamérica),
optimizados para Google Search, con tono profesional pero cercano y conversacional.

ESTILO:
- Párrafos cortos (3-5 líneas máximo).
- Encabezados H2 y H3 con keywords del tema.
- Listas con viñetas para escaneabilidad.
- Ejemplos concretos y casos reales.
- CTAs sutiles al final.

ESTRUCTURA OBLIGATORIA del contenido_md:
1. **Introducción** (sin H1 — el título se renderiza aparte).
   Engancha con una estadística, pregunta o dolor del lector.
2. **3-5 secciones H2** que desarrollan el tema.
3. Conclusión con CTA suave.

NO incluyas H1 — el título va en el frontmatter.
NO uses "##" o "###" sin espacio después. Sigue el spec markdown.
NO inventes estadísticas sin citar fuente — si no tienes datos verificables, omítelas.
SI el tema es técnico, incluye snippets de código bien formateados.

SEO — REGLAS OBLIGATORIAS:
- La keyword principal debe aparecer LITERALMENTE en el primer párrafo de la introducción.
- El primer H2 debe contener la keyword principal o una variación semántica directa.
- seo_titulo: <=65 chars, keyword principal en las primeras 3 palabras si es posible.
- seo_descripcion: <=160 chars, vende el clic, NO duplicar título, termina con CTA implícito.
- seo_keywords: 3-7, mix de short-tail y long-tail (ej: "automatizar WhatsApp" + "cómo automatizar mensajes de WhatsApp para ventas").
- slug_sugerido: kebab-case ASCII, máximo 60 chars, sólo las palabras clave más importantes.
- Distribuí las keywords en al menos 3 H2 y H3 — nunca en el mismo.
- Si el artículo tiene preguntas frecuentes (real o implícitas), agrupá al menos 2 en una sección "## Preguntas frecuentes" al final — esto activa Featured Snippets en Google.
- Densidad de keyword: mencionar la keyword principal cada ~200 palabras, nunca dos veces seguidas.

IMÁGENES:
- imagen_prompt_sugerido: prompt EN INGLÉS para la PORTADA CLICKBAIT.
  ESTA ES LA MINIATURA QUE APARECE EN GOOGLE Y REDES — tiene que ROBAR
  EL CLICK. Reglas obligatorias del prompt:
    * Incluir TEXTO GRANDE RENDERIZADO con un gancho corto del título
      (3-7 palabras, ej: "5 IDEAS DE IA", "VENDE MÁS CON WHATSAPP",
      "EVITA ESTOS 3 ERRORES"). El modelo Nano Banana Pro renderiza
      texto perfectamente legible — aprovechalo.
    * Estilo VIRAL/CLICKBAIT moderno: colores vibrantes, contraste alto,
      composición tipo YouTube thumbnail premium o portada Medium 2026.
    * Elementos visuales que CHOQUEN: un símbolo grande, una flecha,
      números enormes, un rostro expresivo, o un icono central llamativo.
    * NO clichés genéricos ("person looking at laptop", "hands typing").
    * Que se entienda LEGIBLE incluso en miniatura de 200x200px.
  Ejemplo de prompt bien armado:
    "Bold clickbait blog cover, vibrant gradient orange-to-purple
     background, huge white text '7 ERRORES DE IA' centered top,
     a giant red X mark crossing a chatbot icon, modern Y2K style,
     high contrast, 1024x1024"

- imagenes_inline_sugeridas: array de EXACTAMENTE 2 imágenes para el
  cuerpo. Estas SÍ van sin texto renderizado — son ilustraciones
  contextuales. Cada una ilustra un concepto específico del H2 al
  que acompaña. Distribuilas en H2 separados (típicamente H2 #2 y
  H2 #4). Prompts en INGLÉS. Alt text en español.

CONTEXTO DEL NEGOCIO: SaaS multi-tenant que conecta números de WhatsApp
a un agente de IA. Vende a PYMEs y agencias en Latinoamérica.
Cuando el tema lo permita, relaciona con WhatsApp, IA, ventas, automatización.`;

export async function generarArticulo(input: {
  tema: string;
  categoria?: string;
  longitud?: "corto" | "medio" | "largo";
  audiencia?: string;
}): Promise<ArticuloGenerado> {
  const longitudInstr =
    input.longitud === "corto"
      ? "Apunta a 1000-1500 palabras."
      : input.longitud === "largo"
        ? "Apunta a 2500-3500 palabras."
        : "Apunta a 1500-2500 palabras.";

  const promptUsuario = `Escribí un artículo de blog sobre el siguiente tema:

TEMA: ${input.tema}
${input.categoria ? `CATEGORÍA: ${input.categoria}` : ""}
${input.audiencia ? `AUDIENCIA: ${input.audiencia}` : "AUDIENCIA: dueños de PYMEs y emprendedores en Latinoamérica"}

${longitudInstr}

Devolveme el JSON estructurado con todos los campos requeridos.`;

  const respuesta = await cliente().chat.completions.create({
    model: MODELO,
    messages: [
      { role: "system", content: PROMPT_SISTEMA },
      { role: "user", content: promptUsuario },
    ],
    temperature: 0.7,
    max_tokens: 8000,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "articulo_blog",
        strict: true,
        schema: ESQUEMA,
      },
    },
  });

  const texto = respuesta.choices[0]?.message?.content?.trim();
  if (!texto) {
    throw new Error("OpenAI devolvió respuesta vacía al generar artículo");
  }

  let parsed: ArticuloGenerado;
  try {
    parsed = JSON.parse(texto);
  } catch (err) {
    console.error("[blog/generador] JSON inválido:", texto.slice(0, 300), err);
    throw new Error("Respuesta del modelo no es JSON válido");
  }

  // Defensa: si el modelo no respetó el formato del slug, lo regeneramos
  // desde el título (función determinística).
  const slugLimpio = slugificar(parsed.slug_sugerido || parsed.titulo);
  parsed.slug_sugerido = slugLimpio.length >= 3 ? slugLimpio : slugificar(parsed.titulo);

  // Calculo determinístico del tiempo de lectura desde el contenido real
  parsed.tiempo_lectura_min = calcularTiempoLectura(parsed.contenido_md);

  // Defensa: si por algún motivo el modelo no devolvió el array (no
  // debería pasar con strict schema), lo iniciamos vacío.
  if (!Array.isArray(parsed.imagenes_inline_sugeridas)) {
    parsed.imagenes_inline_sugeridas = [];
  }

  return parsed;
}
