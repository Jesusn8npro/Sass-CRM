/**
 * Wrapper de OpenAI para el agente admin con tool calling.
 *
 * Paralelo a `src/lib/anthropic.ts` pero usando GPT-4o-mini. Mismo
 * shape de input/output (`HerramientaAdmin`, `MensajeClaude`,
 * `ResultadoConversacion`) para que `conversacionAdmin.ts` pueda
 * elegir motor por env var sin tocar nada más.
 *
 * Modelo default: gpt-4o-mini
 *   - $0.15/M input, $0.60/M output (7× más barato que Claude Haiku)
 *   - Soporta tool calling estable y multi-turn
 *   - Suficiente para conversación admin + tool routing
 *
 * Para cambiar: AGENTE_ADMIN_MODELO_OPENAI=gpt-4o en .env
 * (más caro pero mejor razonamiento sobre tools complejas).
 */
import OpenAI from "openai";
import type {
  HerramientaAdmin,
  MensajeClaude,
  ResultadoConversacion,
} from "@/lib/anthropic";

export const MODELO_OPENAI_ADMIN_DEFAULT =
  process.env.AGENTE_ADMIN_MODELO_OPENAI ?? "gpt-4o-mini";

const MAX_ITERACIONES_TOOL = 6;

let _cliente: OpenAI | null = null;

function cliente(): OpenAI {
  if (!_cliente) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY no está seteada. Conseguíla en https://platform.openai.com/api-keys",
      );
    }
    _cliente = new OpenAI({ apiKey });
  }
  return _cliente;
}

/**
 * Conversación con herramientas. Loop tool-calling:
 *   1. Manda system + historial + tools a OpenAI
 *   2. Si responde con tool_calls → ejecuta cada uno, agrega resultados
 *   3. Vuelve al paso 1 hasta que responda con texto final
 *   4. Devuelve respuesta + estadísticas
 */
export async function conversarConHerramientasOpenAI(
  systemPrompt: string,
  historial: MensajeClaude[],
  herramientas: HerramientaAdmin[],
  opciones?: { modelo?: string; maxTokens?: number },
): Promise<ResultadoConversacion> {
  const modelo = opciones?.modelo ?? MODELO_OPENAI_ADMIN_DEFAULT;
  const maxTokens = opciones?.maxTokens ?? 2000;

  const toolsOpenAI: OpenAI.Chat.ChatCompletionTool[] = herramientas.map((h) => ({
    type: "function",
    function: {
      name: h.name,
      description: h.description,
      parameters: h.input_schema,
    },
  }));
  const indiceTools = new Map(herramientas.map((h) => [h.name, h]));

  // Construir mensajes para OpenAI. Vamos a ir agregando turns.
  const mensajes: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...historial.map(
      (m): OpenAI.Chat.ChatCompletionMessageParam => ({
        role: m.role,
        content: m.content,
      }),
    ),
  ];

  let tokensIn = 0;
  let tokensOut = 0;
  let toolsEjecutadas = 0;
  const nombresTools: string[] = [];
  let respuestaFinal = "";

  for (let iter = 0; iter < MAX_ITERACIONES_TOOL; iter++) {
    const resp = await cliente().chat.completions.create({
      model: modelo,
      max_tokens: maxTokens,
      messages: mensajes,
      tools: toolsOpenAI,
      tool_choice: "auto",
    });

    if (resp.usage) {
      tokensIn += resp.usage.prompt_tokens ?? 0;
      tokensOut += resp.usage.completion_tokens ?? 0;
    }

    const choice = resp.choices[0];
    if (!choice) break;
    const message = choice.message;

    // Caso A: el modelo terminó con texto final
    if (!message.tool_calls || message.tool_calls.length === 0) {
      respuestaFinal = (message.content ?? "").trim();
      break;
    }

    // Caso B: tool calls — agregar el mensaje del assistant con sus
    // tool_calls al historial, ejecutar cada tool, agregar resultados.
    mensajes.push({
      role: "assistant",
      content: message.content ?? null,
      tool_calls: message.tool_calls,
    });

    for (const tc of message.tool_calls) {
      if (tc.type !== "function") continue;
      const nombre = tc.function.name;
      const herramienta = indiceTools.get(nombre);

      let contenidoResultado: string;
      if (!herramienta) {
        contenidoResultado = JSON.stringify({
          error: `herramienta "${nombre}" no existe`,
        });
      } else {
        toolsEjecutadas++;
        nombresTools.push(nombre);
        try {
          const argsParsed = JSON.parse(tc.function.arguments || "{}") as Record<
            string,
            unknown
          >;
          contenidoResultado = await herramienta.ejecutar(argsParsed);
          if (!contenidoResultado || contenidoResultado.length === 0) {
            contenidoResultado = "(sin contenido)";
          }
        } catch (err) {
          const detalle = err instanceof Error ? err.message : String(err);
          contenidoResultado = JSON.stringify({
            error: `ejecutando ${nombre}: ${detalle.slice(0, 300)}`,
          });
        }
      }

      mensajes.push({
        role: "tool",
        tool_call_id: tc.id,
        content: contenidoResultado,
      });
    }
    // Loop sigue: el modelo procesa los tool results y o pide más tools o cierra
  }

  if (!respuestaFinal) {
    respuestaFinal =
      "Patrón, ejecuté varias herramientas pero no logré armar una respuesta clara. Intentá reformular la pregunta.";
  }

  return {
    respuesta: respuestaFinal,
    toolsEjecutadas,
    nombresTools,
    tokensIn,
    tokensOut,
  };
}

/**
 * Costo aproximado USD según tarifas OpenAI mayo 2026.
 */
export function calcularCostoOpenAIAdminUSD(
  modelo: string,
  tIn: number,
  tOut: number,
): number {
  const tarifas: Record<string, { in: number; out: number }> = {
    "gpt-4o-mini": { in: 0.15, out: 0.6 },
    "gpt-4o-mini-2024-07-18": { in: 0.15, out: 0.6 },
    "gpt-4o": { in: 2.5, out: 10 },
    "gpt-4o-2024-08-06": { in: 2.5, out: 10 },
    "gpt-4.1-mini": { in: 0.4, out: 1.6 },
    "gpt-4.1": { in: 2.0, out: 8.0 },
  };
  const t = tarifas[modelo] ?? { in: 0, out: 0 };
  return (tIn * t.in + tOut * t.out) / 1_000_000;
}
