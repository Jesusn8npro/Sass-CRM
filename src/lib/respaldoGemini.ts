/**
 * Segundo respaldo del agente: Gemini, para cuando NI OpenAI NI Anthropic
 * pueden responder.
 *
 * Pasó en producción: la cuenta de OpenAI quedó inactiva por billing y la de
 * Anthropic sin saldo al mismo tiempo. Con un solo respaldo, cada cliente
 * recibió "estamos teniendo un inconveniente técnico" y el agente quedó mudo.
 * Tres proveedores distintos con facturación independiente hacen que una
 * tarjeta rechazada no apague el bot.
 *
 * Devuelve el MISMO objeto `RespuestaIA` que OpenAI: Gemini soporta JSON
 * Schema estricto (`responseJsonSchema`), así que se le pasa el mismo
 * `ESQUEMA_RESPUESTA` y el resto del pipeline no cambia.
 */
import { ESQUEMA_RESPUESTA } from "./openai-schema";
import { registrarUso } from "./db/meteringUso";
import { log } from "./logger";
import type { MensajeParaRespaldo } from "./respaldoAnthropic";

/** Modelo del respaldo #2. Flash por latencia y costo: es la última red. */
export const MODELO_RESPALDO_2 =
  process.env.GEMINI_MODELO_AGENTE ?? "gemini-3.6-flash";

/** Tarifa estimada por millón de tokens (USD). Ajustable por entorno. */
const COSTO_IN = Number(process.env.GEMINI_USD_IN ?? 0.3);
const COSTO_OUT = Number(process.env.GEMINI_USD_OUT ?? 2.5);

/** Si Gemini cuelga no dejamos trabada la respuesta de WhatsApp. */
const TIMEOUT_MS = 60_000;

/**
 * El JSON del esquema es grande; con `thinkingLevel: low` el modelo igual
 * gasta tokens de razonamiento que cuentan contra maxOutputTokens. Este piso
 * evita que la respuesta salga truncada (finishReason MAX_TOKENS).
 */
const MIN_TOKENS_SALIDA = 3000;

type ParteOpenAI =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: string } };

type ParteGemini =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

/**
 * Traduce el contenido multimodal del formato OpenAI al de Gemini.
 * Igual que en el respaldo de Anthropic: una imagen que no venga como data
 * URL se degrada a una nota de texto en vez de romper la llamada entera.
 */
function traducirContenido(contenido: string | ParteOpenAI[]): ParteGemini[] {
  if (typeof contenido === "string") return [{ text: contenido }];

  const partes: ParteGemini[] = [];
  for (const p of contenido) {
    if (p.type === "text") {
      partes.push({ text: p.text });
      continue;
    }
    const m = (p.image_url?.url ?? "").match(/^data:([^;]+);base64,(.+)$/);
    if (m) {
      partes.push({ inlineData: { mimeType: m[1]!, data: m[2]! } });
    } else {
      partes.push({
        text: "[el cliente envió una imagen que no se pudo procesar]",
      });
    }
  }
  return partes.length > 0 ? partes : [{ text: "(sin contenido)" }];
}

/**
 * Pide la respuesta del agente a Gemini con el mismo esquema que OpenAI.
 * Devuelve el objeto ya parseado (sin normalizar: de eso se encarga el caller).
 */
export async function generarRespuestaRespaldo2(parametros: {
  promptCompleto: string;
  mensajes: MensajeParaRespaldo[];
  temperatura: number;
  maxTokens: number;
  cuentaId?: string;
}): Promise<Record<string, unknown>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY no está definida — no hay respaldo #2.");
  }

  const contents = parametros.mensajes.map((m) => ({
    // Gemini llama "model" a lo que OpenAI llama "assistant".
    role: m.role === "assistant" ? "model" : "user",
    parts: traducirContenido(m.content),
  }));

  log.warn(
    { modelo: MODELO_RESPALDO_2, mensajes: contents.length },
    "[respaldo2] OpenAI y Anthropic caídos — respondiendo con Gemini",
  );

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODELO_RESPALDO_2}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: parametros.promptCompleto }] },
          contents,
          generationConfig: {
            temperature: parametros.temperatura,
            maxOutputTokens: Math.max(parametros.maxTokens, MIN_TOKENS_SALIDA),
            responseMimeType: "application/json",
            responseJsonSchema: ESQUEMA_RESPUESTA,
            thinkingConfig: { thinkingLevel: "low" },
          },
        }),
        signal: ctrl.signal,
      },
    );

    if (!resp.ok) {
      const detalle = await resp.text().catch(() => "");
      throw new Error(
        `Gemini respondió ${resp.status}: ${detalle.slice(0, 200)}`,
      );
    }

    const datos = (await resp.json()) as {
      candidates?: {
        finishReason?: string;
        content?: { parts?: { text?: string; thought?: boolean }[] };
      }[];
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
      };
    };

    const candidato = datos.candidates?.[0];
    // El razonamiento viene en partes aparte marcadas `thought`: sólo el
    // resto forma el JSON, y llega troceado en varias partes.
    const texto = (candidato?.content?.parts ?? [])
      .filter((p) => p.text && !p.thought)
      .map((p) => p.text)
      .join("")
      .trim();
    if (!texto) {
      throw new Error(
        `Gemini no devolvió contenido (finishReason=${candidato?.finishReason ?? "?"}).`,
      );
    }

    if (parametros.cuentaId) {
      const tIn = datos.usageMetadata?.promptTokenCount ?? 0;
      const tOut = datos.usageMetadata?.candidatesTokenCount ?? 0;
      registrarUso({
        cuenta_id: parametros.cuentaId,
        proveedor: "gemini",
        modelo: MODELO_RESPALDO_2,
        tokens_in: tIn,
        tokens_out: tOut,
        costo_usd: (tIn * COSTO_IN + tOut * COSTO_OUT) / 1_000_000,
        metadata: { motivo: "respaldo_openai_y_anthropic_caidos" },
      });
    }

    try {
      return JSON.parse(texto) as Record<string, unknown>;
    } catch {
      throw new Error("Gemini devolvió un JSON inválido.");
    }
  } finally {
    clearTimeout(timeout);
  }
}
