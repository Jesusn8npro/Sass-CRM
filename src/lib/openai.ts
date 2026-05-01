import fs from "node:fs";
import OpenAI from "openai";
import { PROMPT_SISTEMA_DEFAULT } from "./promptSistema";
import type { Mensaje } from "./baseDatos";
import { rutaAbsolutaDeMedia } from "./baileys/medios";

const cliente = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "",
});

const MODELO_DEFAULT = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

// ============================================================
// Visión: convertir un mensaje del usuario con imagen a contenido
// multimodal compatible con la Chat Completions API.
// Si falla la lectura del archivo o no hay media_path, cae al texto.
// ============================================================
type ParteContenidoUsuario =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" | "auto" } };

function mimeDeImagenPorExtension(mediaPath: string): string {
  const ext = mediaPath.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/jpeg";
}

function construirContenidoUsuario(
  mensaje: Mensaje,
): string | ParteContenidoUsuario[] {
  if (mensaje.tipo === "imagen" && mensaje.media_path) {
    try {
      const buffer = fs.readFileSync(rutaAbsolutaDeMedia(mensaje.media_path));
      const mime = mimeDeImagenPorExtension(mensaje.media_path);
      const base64 = buffer.toString("base64");
      const caption = mensaje.contenido?.trim() ?? "";
      const textoAcompañante =
        caption && caption !== "[imagen sin descripción]"
          ? caption
          : "[el cliente envió una imagen, mirala y respondé acorde]";
      return [
        { type: "text", text: textoAcompañante },
        {
          type: "image_url",
          image_url: { url: `data:${mime};base64,${base64}`, detail: "auto" },
        },
      ];
    } catch (err) {
      console.error(
        `[openai] no se pudo leer imagen para visión (${mensaje.media_path}):`,
        err,
      );
    }
  }
  return mensaje.contenido;
}

/**
 * Una parte de la respuesta del LLM. El schema strict obliga a que ambos
 * campos estén presentes. Cuando tipo='texto', media_id viene vacío.
 * Cuando tipo='media', contenido viene vacío.
 */
export interface ParteRespuesta {
  tipo: "texto" | "media";
  contenido: string;
  media_id: string;
}

export interface RespuestaIA {
  partes: ParteRespuesta[];
  transferir_a_humano: {
    activar: boolean;
    razon: string;
  };
}

const ESQUEMA_RESPUESTA = {
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
            enum: ["texto", "media"],
          },
          contenido: {
            type: "string",
            description:
              "Texto del mensaje (solo si tipo='texto'). Vacío si tipo='media'.",
          },
          media_id: {
            type: "string",
            description:
              "Identificador del medio en la biblioteca (solo si tipo='media'). Vacío si tipo='texto'.",
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
  },
  required: ["partes", "transferir_a_humano"],
  additionalProperties: false,
} as const;

const INSTRUCCIONES_ESTRUCTURADAS = `
INSTRUCCIONES DE FORMATO DE RESPUESTA (siempre seguir):

1) Tu respuesta debe venir en JSON con la estructura indicada.

2) "partes" es un array de mensajes ordenados. Cada parte tiene un "tipo":
   - tipo="texto": "contenido" tiene el texto del mensaje, "media_id" debe ser "".
   - tipo="media": "media_id" tiene el identificador del medio de la biblioteca a enviar, "contenido" debe ser "".

3) Reglas para dividir en partes:
   - Si la respuesta es corta (1 frase), usá 1 sola parte.
   - Si tiene saludo + contenido, separá saludo en su propia parte.
   - Cada parte de texto: máximo 2-3 líneas, que se sienta natural en WhatsApp.
   - NO uses emojis.
   - Podés intercalar texto + media + texto (ej: "Te muestro el catálogo" → media:catalogo → "¿Cuál te gusta?").
   - Solo usá media si tenés MUCHO sentido enviarlo (cliente pidió ver, o estás presentando algo visual).
   - Solo usá media_id que esté en la lista de medios disponibles que te paso. NO inventes identificadores.
   - Máximo 1-2 medios por respuesta. No saturar al cliente.

4) Recibís imágenes del cliente: cuando un mensaje del usuario incluye una imagen,
   la vas a ver directamente. Mirala con atención y respondé acorde a lo que muestra
   (ej: si manda foto de un producto preguntando por precio, identificá el producto;
   si manda screenshot de un error, ayudalo a resolverlo; si manda comprobante de
   pago, agradecé y confirmá). Mencioná lo que ves de forma natural en tu respuesta.

5) "transferir_a_humano" indica si necesitás que un humano del equipo continúe la conversación:
   - activar=true SOLO si: (a) el cliente pide hablar con humano/asesor/persona, (b) detectás frustración seria, (c) la situación requiere alguien con autoridad (refund, descuento grande, decisión legal/médica), (d) hay riesgo si das info incorrecta.
   - razon: resumí en 1-2 líneas para el operador.
   - Si activar=true, igual respondé al cliente con partes diciendo educadamente que un humano continuará.
   - En caso normal: activar=false, razon="".
`.trim();

export async function generarRespuesta(
  historial: Mensaje[],
  promptSistema?: string | null,
  modeloOverride?: string | null,
): Promise<RespuestaIA> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY no está definida. Verifica .env.local y el cargador de entorno.",
    );
  }

  const promptUsuario = promptSistema?.trim() || PROMPT_SISTEMA_DEFAULT;
  const promptCompleto = `${promptUsuario}\n\n${INSTRUCCIONES_ESTRUCTURADAS}`;
  const modelo = modeloOverride?.trim() || MODELO_DEFAULT;

  const mensajesParaLLM = historial
    .filter((m) => m.rol !== "sistema")
    .map((m) => {
      if (m.rol === "usuario") {
        return {
          role: "user" as const,
          content: construirContenidoUsuario(m),
        };
      }
      // El asistente y los humanos del panel se mandan como texto plano.
      return {
        role: "assistant" as const,
        content: m.contenido,
      };
    });

  const respuesta = await cliente.chat.completions.create({
    model: modelo,
    messages: [
      { role: "system", content: promptCompleto },
      ...mensajesParaLLM,
    ],
    temperature: 0.7,
    max_tokens: 700,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "respuesta_agente",
        strict: true,
        schema: ESQUEMA_RESPUESTA,
      },
    },
  });

  const texto = respuesta.choices[0]?.message?.content?.trim();
  if (!texto) {
    throw new Error("OpenAI devolvió una respuesta vacía.");
  }

  let parsed: RespuestaIA;
  try {
    parsed = JSON.parse(texto) as RespuestaIA;
  } catch (err) {
    console.error("[openai] respuesta no es JSON válido:", texto, err);
    throw new Error("OpenAI devolvió formato inválido.");
  }

  if (!parsed.partes || parsed.partes.length === 0) {
    parsed.partes = [{ tipo: "texto", contenido: "...", media_id: "" }];
  }
  if (!parsed.transferir_a_humano) {
    parsed.transferir_a_humano = { activar: false, razon: "" };
  }
  return parsed;
}
