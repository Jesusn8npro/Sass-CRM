/**
 * Respaldo del agente cuando OpenAI no está disponible.
 *
 * El agente principal corre sobre OpenAI con `response_format: json_schema`.
 * Si OpenAI falla por algo que no se arregla reintentando (cuenta sin billing,
 * cuota agotada, caída del proveedor), el cliente terminaba viendo un
 * "estamos teniendo un inconveniente técnico" y la venta se perdía.
 *
 * Acá replicamos la MISMA salida con Claude: en vez de `response_format`,
 * Anthropic obtiene el JSON obligando una herramienta con el mismo esquema
 * (`tool_choice` fijo). El resultado es el mismo objeto `RespuestaIA`, así que
 * el resto del pipeline (partes, capturar_datos, agendar_cita…) no cambia.
 *
 * No sustituye a OpenAI: sólo entra cuando el principal ya falló.
 */
import Anthropic from "@anthropic-ai/sdk";
import { ESQUEMA_RESPUESTA } from "./openai-schema";
import { registrarUso } from "./db/meteringUso";
import { log } from "./logger";

/** Modelo del respaldo. Sonnet por calidad de venta: el respaldo atiende
 *  clientes reales, no es un modo degradado. Overridable por entorno. */
export const MODELO_RESPALDO =
  process.env.ANTHROPIC_MODELO_AGENTE ?? "claude-sonnet-4-5-20250929";

/** Tarifas por millón de tokens (USD). */
const COSTO_RESPALDO: Record<string, { in: number; out: number }> = {
  "claude-sonnet-4-5-20250929": { in: 3, out: 15 },
  "claude-haiku-4-5-20251001": { in: 1, out: 5 },
};

function calcularCosto(modelo: string, tIn: number, tOut: number): number {
  const c = COSTO_RESPALDO[modelo] ?? { in: 3, out: 15 };
  return (tIn * c.in + tOut * c.out) / 1_000_000;
}

/** Contenido de usuario tal como lo arma `openai.ts` (formato Chat Completions). */
type ParteOpenAI =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: string } };

export interface MensajeParaRespaldo {
  role: "user" | "assistant";
  content: string | ParteOpenAI[];
}

type ParteAnthropic =
  | { type: "text"; text: string }
  | {
      type: "image";
      source: { type: "base64"; media_type: string; data: string };
    };

/**
 * Traduce el contenido multimodal del formato OpenAI al de Anthropic.
 * Una imagen que no venga como data URL se descarta con una nota de texto:
 * es preferible que el modelo sepa que hubo una imagen ilegible a que la
 * llamada entera falle por un formato que no soporta.
 */
function traducirContenido(
  contenido: string | ParteOpenAI[],
): string | ParteAnthropic[] {
  if (typeof contenido === "string") return contenido;

  const partes: ParteAnthropic[] = [];
  for (const p of contenido) {
    if (p.type === "text") {
      partes.push({ type: "text", text: p.text });
      continue;
    }
    const url = p.image_url?.url ?? "";
    const m = url.match(/^data:([^;]+);base64,(.+)$/);
    if (m) {
      partes.push({
        type: "image",
        source: { type: "base64", media_type: m[1], data: m[2] },
      });
    } else {
      partes.push({
        type: "text",
        text: "[el cliente envió una imagen que no se pudo procesar]",
      });
    }
  }
  return partes.length > 0 ? partes : "(sin contenido)";
}

/**
 * Pide la respuesta del agente a Claude con el mismo esquema que OpenAI.
 * Devuelve el objeto ya parseado (sin normalizar: de eso se encarga el caller,
 * igual que con la respuesta de OpenAI).
 */
export async function generarRespuestaRespaldo(parametros: {
  promptCompleto: string;
  mensajes: MensajeParaRespaldo[];
  temperatura: number;
  maxTokens: number;
  cuentaId?: string;
}): Promise<Record<string, unknown>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY no está definida — no hay respaldo posible.");
  }

  const cliente = new Anthropic({ apiKey });
  const modelo = MODELO_RESPALDO;

  const mensajes = parametros.mensajes.map((m) => ({
    role: m.role,
    content: traducirContenido(m.content),
  }));

  log.warn(
    { modelo, mensajes: mensajes.length },
    "[respaldo] OpenAI no disponible — respondiendo con Anthropic",
  );

  const respuesta = await cliente.messages.create({
    model: modelo,
    max_tokens: parametros.maxTokens,
    temperature: parametros.temperatura,
    system: parametros.promptCompleto,
    messages: mensajes as Anthropic.MessageParam[],
    tools: [
      {
        name: "responder_al_cliente",
        description:
          "Devuelve la respuesta del agente para el cliente de WhatsApp, con las acciones de CRM que correspondan.",
        // El esquema es `as const` (readonly) y el SDK lo pide mutable; la
        // forma en runtime es idéntica, así que el cast es seguro.
        input_schema: ESQUEMA_RESPUESTA as unknown as Anthropic.Tool.InputSchema,
      },
    ],
    // Forzar la herramienta es el equivalente de `response_format` en OpenAI:
    // garantiza que la salida venga validada contra el esquema.
    tool_choice: { type: "tool", name: "responder_al_cliente" },
  });

  if (parametros.cuentaId) {
    const tIn = respuesta.usage?.input_tokens ?? 0;
    const tOut = respuesta.usage?.output_tokens ?? 0;
    registrarUso({
      cuenta_id: parametros.cuentaId,
      proveedor: "anthropic",
      modelo,
      tokens_in: tIn,
      tokens_out: tOut,
      costo_usd: calcularCosto(modelo, tIn, tOut),
      metadata: { motivo: "respaldo_openai_caido" },
    });
  }

  const bloque = respuesta.content.find((c) => c.type === "tool_use");
  if (!bloque || bloque.type !== "tool_use") {
    throw new Error("El respaldo no devolvió la herramienta con la respuesta.");
  }
  return bloque.input as Record<string, unknown>;
}
