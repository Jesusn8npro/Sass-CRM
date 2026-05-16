/**
 * Consulta Perplexity "sonar" (modelo con búsqueda web en tiempo real)
 * para obtener un tema actual sobre IA y automatización que sirva de
 * base para el artículo del día.
 *
 * Si PERPLEXITY_API_KEY no está configurada o la API falla, cae a una
 * lista curada de temas rotatorios (garantiza que siempre haya artículo).
 */

interface PerplexityResponse {
  choices: Array<{ message: { content: string } }>;
}

export interface TemaConContexto {
  tema: string;
  /** Datos reales / noticias recientes que OpenAI debe incorporar al escribir. */
  contexto_adicional: string;
  /** "perplexity" si vino de la API, "fallback" si es estático. */
  fuente: "perplexity" | "fallback";
}

// Rotación de categorías por día de la semana (0=lunes en JS es domingo — usamos % 5)
const ROTACION_CATEGORIAS = [
  "inteligencia-artificial",   // día 0
  "whatsapp-business",         // día 1
  "marketing",                 // día 2
  "casos-de-uso",              // día 3
  "inteligencia-artificial",   // día 4
  "whatsapp-business",         // día 5
  "marketing",                 // día 6
] as const;

export type CategoriaSlug = (typeof ROTACION_CATEGORIAS)[number];

export function categoriaDeHoy(): CategoriaSlug {
  const dia = new Date().getDay(); // 0=Dom, 1=Lun … 6=Sáb
  return ROTACION_CATEGORIAS[dia]!;
}

// IDs reales de la DB (no cambiar sin actualizar Supabase también)
export const CATEGORIA_IDS: Record<CategoriaSlug, string> = {
  "inteligencia-artificial": "7287986e-5f2b-4658-a9ad-189dcc26f585",
  "whatsapp-business":       "f4c6de13-c844-41d9-b266-ebe4403c859a",
  "marketing":               "ab4316b7-c7c0-4f34-b0e7-7ddf34ac35cb",
  "casos-de-uso":            "242342c8-ec53-414e-82ee-921c55f931aa",
};

// ── Prompts de consulta a Perplexity ────────────────────────────────────────

const ENFOQUE: Record<CategoriaSlug, string> = {
  "inteligencia-artificial":
    "inteligencia artificial, agentes de IA, LLMs, ChatGPT, automatización con IA para negocios y PYMEs",
  "whatsapp-business":
    "WhatsApp Business API, chatbots de WhatsApp, bots de ventas, atención al cliente automatizada por WhatsApp",
  "marketing":
    "marketing digital, generación de leads con IA, automatización de ventas, funnels digitales para PYMEs",
  "casos-de-uso":
    "casos reales de automatización empresarial con IA en Latinoamérica, éxitos de digitalización de PYMEs",
};

function buildPrompt(categoria: CategoriaSlug): string {
  const area = ENFOQUE[categoria];
  return `Buscá las noticias y tendencias MÁS RECIENTES (últimos 7 días) sobre: ${area}.

Basándote en lo que encontrás hoy, dame UN tema específico y actual para un artículo de blog dirigido a dueños de PYMEs y emprendedores en Latinoamérica.

IMPORTANTE: El tema debe ser práctico, accionable y basado en algo real que esté pasando ahora (lanzamiento, estudio, tendencia, caso real).

Respondé ÚNICAMENTE con este JSON (sin markdown, sin explicaciones extra):
{
  "tema": "Título-tema concreto para el artículo (máx 120 caracteres). Ej: 'ChatGPT-4o ahora responde por WhatsApp: cómo aprovecharlo para vender más'",
  "contexto": "2-3 oraciones con datos, fechas o hechos reales de esta semana que el redactor debe incorporar al artículo para que se sienta actual y verificable"
}`;
}

// ── Temas de fallback rotatorios ─────────────────────────────────────────────

const FALLBACK: Record<CategoriaSlug, string[]> = {
  "inteligencia-artificial": [
    "Agentes de IA en 2025: cómo los negocios latinos están vendiendo sin levantar el teléfono",
    "ChatGPT como vendedor: 5 formas de usarlo para cerrar más ventas este mes",
    "Los 7 errores que cometen las PYMEs al implementar IA por primera vez",
    "De chatbot a agente inteligente: la evolución que cambia todo para tu negocio",
    "IA para negocios sin equipo técnico: guía práctica desde cero",
    "Por qué tu competencia ya usa IA y vos todavía no: lo que perdés cada día",
    "Automatizar sin perder el toque humano: la clave que las grandes empresas no quieren que sepas",
  ],
  "whatsapp-business": [
    "Cómo un bot de WhatsApp puede responder a tus clientes mientras dormís",
    "WhatsApp Business API: la guía definitiva para PYMEs latinoamericanas en 2025",
    "Los mensajes de WhatsApp que más convierten según datos reales de 500 negocios",
    "Errores fatales en WhatsApp Business y cómo evitar que te bloqueen",
    "De 0 a 300 leads por mes usando solo WhatsApp y un agente de IA",
    "WhatsApp + CRM: la integración que duplica las ventas de las mejores agencias",
    "Cómo programar seguimientos automáticos en WhatsApp sin parecer un robot",
  ],
  "marketing": [
    "Generación de leads con IA: qué funciona en Latinoamérica en 2025",
    "Cómo automatizar tu embudo de ventas sin perder el toque humano",
    "7 estrategias de marketing digital que cualquier PYME puede aplicar hoy",
    "Email + WhatsApp + IA: la combinación que usan los mejores vendedores del continente",
    "Cómo segmentar clientes con IA para vender más con el mismo esfuerzo",
    "Marketing de contenidos con IA: producí 10 veces más en la mitad del tiempo",
    "El embudo de ventas moderno: cómo la IA lo cambió para siempre",
  ],
  "casos-de-uso": [
    "Cómo una inmobiliaria triplicó sus citas usando un agente de IA en WhatsApp",
    "Caso real: restaurante que eliminó el 80% de las llamadas con un bot inteligente",
    "E-commerce + IA: cómo recuperar carritos abandonados automáticamente",
    "Clínica dental que agenda el 90% de sus turnos sin recepcionista humana",
    "Agencia de viajes digital: de 0 a 500 leads al mes con automatización pura",
    "Cómo una academia de idiomas creció 3x en 6 meses con WhatsApp y IA",
    "Consultora que cerró 40% más contratos sin aumentar su equipo comercial",
  ],
};

function temaFallback(categoria: CategoriaSlug): TemaConContexto {
  const temas = FALLBACK[categoria];
  const indice = new Date().getDate() % temas.length; // rota por día del mes
  return {
    tema: temas[indice]!,
    contexto_adicional: "",
    fuente: "fallback",
  };
}

// ── Función principal ─────────────────────────────────────────────────────────

export async function obtenerTemaActual(
  categoria: CategoriaSlug,
): Promise<TemaConContexto> {
  const apiKey = process.env.PERPLEXITY_API_KEY?.trim();
  if (!apiKey) {
    return temaFallback(categoria);
  }

  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "system",
            content:
              "Eres un experto en marketing digital para PYMEs latinoamericanas con acceso a búsqueda web en tiempo real. Siempre respondés en JSON válido, sin markdown.",
          },
          { role: "user", content: buildPrompt(categoria) },
        ],
        max_tokens: 600,
        temperature: 0.6,
      }),
      signal: AbortSignal.timeout(20_000), // 20s máx
    });

    if (!res.ok) {
      console.warn("[temas-perplexity] HTTP", res.status, await res.text().catch(() => ""));
      return temaFallback(categoria);
    }

    const data = (await res.json()) as PerplexityResponse;
    const content = data.choices?.[0]?.message?.content?.trim() ?? "";

    // Extraer JSON aunque venga con markdown fences
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return temaFallback(categoria);

    const parsed = JSON.parse(match[0]) as { tema?: string; contexto?: string };
    const tema = parsed.tema?.trim() ?? "";
    if (tema.length < 10) return temaFallback(categoria);

    return {
      tema,
      contexto_adicional: parsed.contexto?.trim() ?? "",
      fuente: "perplexity",
    };
  } catch (err) {
    console.warn("[temas-perplexity] error:", err);
    return temaFallback(categoria);
  }
}
