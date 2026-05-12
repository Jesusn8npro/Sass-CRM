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
      description: "Prompt en inglés para generar la imagen de portada",
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

SEO:
- seo_titulo: <=65 chars, incluye keyword principal cerca del inicio.
- seo_descripcion: <=160 chars, vende el clic, NO duplicar título.
- seo_keywords: 3-7, mix de short-tail y long-tail.
- slug_sugerido: kebab-case ASCII, máximo 80 chars, basado en keywords.

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

  return parsed;
}
