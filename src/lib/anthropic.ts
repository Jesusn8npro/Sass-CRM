/**
 * Wrapper de Anthropic Claude SDK para el agente admin global.
 *
 * Uso principal: tool-calling loop. Le pasás un set de herramientas y
 * un historial, el modelo decide qué herramientas usar (puede usar
 * varias en cadena) y devuelve la respuesta final en lenguaje natural.
 *
 * Modelo default: claude-haiku-4-5-20251001
 *   - $1/M input, $5/M output
 *   - ~$0.005-0.015 por conversación admin típica
 *   - Suficiente para razonar sobre tool selection y redactar respuestas
 *
 * Para cambiar a Sonnet (mejor razonamiento pero 3× más caro), seteá
 * ANTHROPIC_MODEL=claude-sonnet-4-6 en .env.
 */
import Anthropic from "@anthropic-ai/sdk";

export const MODELO_ANTHROPIC_DEFAULT =
  process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001";

const MAX_ITERACIONES_TOOL = 6; // Safety: evita loops infinitos si el modelo se obsesiona

let _cliente: Anthropic | null = null;

function cliente(): Anthropic {
  if (!_cliente) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY no está seteada. Conseguíla en https://console.anthropic.com/settings/keys",
      );
    }
    _cliente = new Anthropic({ apiKey });
  }
  return _cliente;
}

export interface HerramientaAdmin {
  /** Nombre snake_case sin espacios. El modelo lo invoca por este nombre. */
  name: string;
  /** Descripción clara — el modelo decide cuándo usar la tool basándose en esto. */
  description: string;
  /** JSON Schema del input. Anthropic espera input_schema con type:"object". */
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  /** Handler que ejecuta la tool. Recibe el input parseado, devuelve string para el modelo. */
  ejecutar: (input: Record<string, unknown>) => Promise<string>;
}

export interface MensajeClaude {
  role: "user" | "assistant";
  content: string;
}

export interface ResultadoConversacion {
  /** Respuesta final del modelo en lenguaje natural (lo que se manda al usuario). */
  respuesta: string;
  /** Cuántas herramientas se ejecutaron en este turn. */
  toolsEjecutadas: number;
  /** Nombres de las herramientas ejecutadas (para audit y debug). */
  nombresTools: string[];
  /** Tokens consumidos en total (suma de todas las iteraciones del loop). */
  tokensIn: number;
  tokensOut: number;
}

/**
 * Conversación con herramientas. Implementa el tool-calling loop:
 *   1. Manda mensajes + tools a Claude
 *   2. Si responde con tool_use → ejecuta las tools, agrega resultados al historial
 *   3. Vuelve al paso 1 hasta que Claude responda con texto final (end_turn)
 *   4. Devuelve la respuesta final + estadísticas
 *
 * Si el loop supera MAX_ITERACIONES_TOOL, corta y devuelve lo último que dijo
 * el modelo (defensa contra obsesión circular).
 */
export async function conversarConHerramientas(
  systemPrompt: string,
  historial: MensajeClaude[],
  herramientas: HerramientaAdmin[],
  opciones?: { modelo?: string; maxTokens?: number },
): Promise<ResultadoConversacion> {
  const modelo = opciones?.modelo ?? MODELO_ANTHROPIC_DEFAULT;
  const maxTokens = opciones?.maxTokens ?? 2000;

  // Catálogo de tools para Claude (separamos el handler que es función JS)
  const toolsParaClaude = herramientas.map((h) => ({
    name: h.name,
    description: h.description,
    input_schema: h.input_schema,
  }));
  const indiceTools = new Map(herramientas.map((h) => [h.name, h]));

  // Mensajes mutables que vamos a ir extendiendo según el loop
  const mensajes: Anthropic.Messages.MessageParam[] = historial.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  let tokensIn = 0;
  let tokensOut = 0;
  let toolsEjecutadas = 0;
  const nombresTools: string[] = [];
  let respuestaFinal = "";

  for (let iter = 0; iter < MAX_ITERACIONES_TOOL; iter++) {
    const resp = await cliente().messages.create({
      model: modelo,
      max_tokens: maxTokens,
      system: systemPrompt,
      tools: toolsParaClaude,
      messages: mensajes,
    });

    tokensIn += resp.usage.input_tokens;
    tokensOut += resp.usage.output_tokens;

    // Caso A: el modelo terminó (end_turn / max_tokens / stop_sequence)
    if (resp.stop_reason !== "tool_use") {
      respuestaFinal = extraerTextoDeRespuesta(resp);
      break;
    }

    // Caso B: el modelo pidió usar tools. Recolectamos todas las tool_use
    // del turno (puede pedir varias en paralelo) y ejecutamos cada una.
    const toolUses = resp.content.filter(
      (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use",
    );

    if (toolUses.length === 0) {
      // Defensa rara: dijo tool_use pero no envió bloques tool_use.
      respuestaFinal = extraerTextoDeRespuesta(resp);
      break;
    }

    // 1. Agregamos el turn del assistant (con su bloque tool_use) al historial
    mensajes.push({
      role: "assistant",
      content: resp.content,
    });

    // 2. Ejecutamos cada tool y armamos los tool_result
    const resultadosBlocks: Anthropic.Messages.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      const herramienta = indiceTools.get(tu.name);
      if (!herramienta) {
        resultadosBlocks.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: `ERROR: herramienta "${tu.name}" no existe.`,
          is_error: true,
        });
        continue;
      }
      toolsEjecutadas++;
      nombresTools.push(tu.name);
      try {
        const input = (tu.input ?? {}) as Record<string, unknown>;
        const salida = await herramienta.ejecutar(input);
        resultadosBlocks.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: salida.length > 0 ? salida : "(sin contenido)",
        });
      } catch (err) {
        const detalle = err instanceof Error ? err.message : String(err);
        resultadosBlocks.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: `ERROR ejecutando ${tu.name}: ${detalle.slice(0, 300)}`,
          is_error: true,
        });
      }
    }

    // 3. Le mandamos los resultados al modelo para el siguiente turn
    mensajes.push({
      role: "user",
      content: resultadosBlocks,
    });

    // Loop continúa: el modelo va a procesar los resultados y o usa más
    // tools o devuelve respuesta final.
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

function extraerTextoDeRespuesta(resp: Anthropic.Messages.Message): string {
  const partes: string[] = [];
  for (const bloque of resp.content) {
    if (bloque.type === "text") partes.push(bloque.text);
  }
  return partes.join("\n").trim();
}

/**
 * Costo aproximado en USD de una llamada (para metering).
 * Tarifa Haiku 4.5 (mayo 2026): $1/M input, $5/M output.
 */
export function calcularCostoAnthropicUSD(
  modelo: string,
  tIn: number,
  tOut: number,
): number {
  const tarifas: Record<string, { in: number; out: number }> = {
    "claude-haiku-4-5-20251001": { in: 1, out: 5 },
    "claude-haiku-4-5": { in: 1, out: 5 },
    "claude-sonnet-4-6": { in: 3, out: 15 },
    "claude-opus-4-7": { in: 15, out: 75 },
  };
  const t = tarifas[modelo] ?? { in: 0, out: 0 };
  return (tIn * t.in + tOut * t.out) / 1_000_000;
}
