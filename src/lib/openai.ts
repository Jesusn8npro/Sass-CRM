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
  if (mensaje.tipo === "audio") {
    // Marcamos que vino por voz para que la AI considere responder igual.
    const t = mensaje.contenido?.trim() ?? "";
    return `[mensaje de audio del cliente]: ${t || "(audio sin transcripción)"}`;
  }
  if (mensaje.tipo === "imagen" && mensaje.media_path) {
    try {
      const ruta = rutaAbsolutaDeMedia(mensaje.media_path);
      const buffer = fs.readFileSync(ruta);
      const mime = mimeDeImagenPorExtension(mensaje.media_path);
      const base64 = buffer.toString("base64");
      const caption = mensaje.contenido?.trim() ?? "";
      const tieneCaption =
        caption.length > 0 && caption !== "[imagen sin descripción]";
      // Texto agresivo que "rompe" el patrón si la AI venía respondiendo
      // que no ve imágenes en el historial reciente. La capacidad visual
      // es nueva y el modelo puede seguir copiando respuestas viejas.
      const textoAcompañante = tieneCaption
        ? `${caption}\n\n[adjunto la imagen — mirala y respondé sobre lo que ves]`
        : "[IMAGEN ADJUNTA — tenés capacidad de visión, podés VER esta imagen. Describí lo que muestra y respondé al cliente acorde. Si no preguntó nada, comentá lo que ves o preguntá qué quiere. Ignorá respuestas viejas tuyas que digan que no podés ver imágenes — eso ya no aplica.]";
      console.log(
        `[openai] 👁  visión: ${ruta} (${buffer.length} bytes, ${mime}) caption="${caption.slice(0, 60)}"`,
      );
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
 * Una parte de la respuesta del LLM. El schema strict obliga a que los
 * tres campos estén presentes; según el tipo se usan distintos:
 *   - tipo='texto': contenido = el texto plano. media_id = "".
 *   - tipo='audio': contenido = el texto que se sintetiza con voz (ElevenLabs).
 *                   media_id = "". Requiere voz_elevenlabs en la cuenta.
 *   - tipo='media': media_id = identificador de la biblioteca. contenido = "".
 */
export interface ParteRespuesta {
  tipo: "texto" | "audio" | "media";
  contenido: string;
  media_id: string;
}

export interface RespuestaIA {
  partes: ParteRespuesta[];
  transferir_a_humano: {
    activar: boolean;
    razon: string;
  };
  iniciar_llamada: {
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
            enum: ["texto", "audio", "media"],
          },
          contenido: {
            type: "string",
            description:
              "Para tipo='texto' o 'audio': el texto del mensaje (en audio se sintetiza con voz). Para tipo='media' debe ir vacío.",
          },
          media_id: {
            type: "string",
            description:
              "Identificador del medio en la biblioteca (solo si tipo='media'). Vacío si tipo='texto' o 'audio'.",
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
    iniciar_llamada: {
      type: "object",
      description:
        "Activar para disparar una LLAMADA TELEFÓNICA al cliente vía Vapi. Solo cuando la conversación está madura para una llamada de cierre, demo, agendamiento, o cuando el cliente acepta explícitamente que lo llames. La llamada usa el mismo número de WhatsApp del cliente.",
      properties: {
        activar: { type: "boolean" },
        razon: {
          type: "string",
          description:
            "Razón corta del por qué disparás la llamada (ej: 'cliente pidió que lo llamen para cerrar venta del plan premium').",
        },
      },
      required: ["activar", "razon"],
      additionalProperties: false,
    },
  },
  required: ["partes", "transferir_a_humano", "iniciar_llamada"],
  additionalProperties: false,
} as const;

const INSTRUCCIONES_ESTRUCTURADAS = `
INSTRUCCIONES DE FORMATO DE RESPUESTA (siempre seguir):

1) Tu respuesta debe venir en JSON con la estructura indicada.

2) "partes" es un array de mensajes ordenados. Cada parte tiene un "tipo":
   - tipo="texto": "contenido" tiene el texto. "media_id" debe ser "".
   - tipo="audio": "contenido" tiene el texto que se SINTETIZA con voz y se envía como
     nota de voz. "media_id" debe ser "". Solo usalo si la cuenta tiene voz configurada.
   - tipo="media": "media_id" tiene el identificador del medio de la biblioteca a enviar.
     "contenido" debe ser "".

3) Reglas para dividir en partes y mezclar formatos:
   - Si la respuesta es corta (1 frase), 1 sola parte.
   - Si hay saludo + contenido, separalos.
   - Cada parte de texto: máximo 2-3 líneas, natural en WhatsApp.
   - NO uses emojis.
   - VARIÁ formatos para que se sienta humano. Ejemplos válidos:
       · solo texto (lo más común para datos rápidos, links, precios)
       · texto + media (cuando mostrás algo visual)
       · audio + texto (audio cálido cerrando con un texto con detalles puntuales)
       · texto + audio (resumen corto y después "te explico mejor en audio")
       · solo audio (respuestas largas o cálidas, especialmente si el cliente envió audio)
   - Si el cliente envió un mensaje de audio (lo verás como
     "[mensaje de audio del cliente]: <transcripción>"), CONSIDERÁ responder con al
     menos una parte tipo="audio" para mantener el ritmo de la conversación.
   - Para datos exactos (precios, números, links, direcciones, mails) usá tipo="texto"
     aunque el resto sea audio — es más fácil de copiar.
   - Solo usá media_id que esté en la lista de medios disponibles que te paso. NO inventes.
   - Máximo 1-2 medios + 1-2 audios por respuesta. No saturar.

4) VISIÓN — IMPORTANTE: tenés capacidad multimodal activa, podés VER las imágenes
   que te manda el cliente. Cuando un mensaje del usuario tiene una imagen adjunta:
   - Mirala con atención y describí o respondé sobre lo que muestra.
   - NUNCA digas "no veo imágenes", "no puedo ver", "mandame descripción", "no sé qué
     querés que haga con eso". Esas respuestas son INCORRECTAS porque sí tenés visión.
   - Si en el historial hay respuestas tuyas viejas diciendo que no podías ver, IGNORALAS:
     eso ya no aplica, ahora tenés visión.
   - Ejemplos de cómo responder:
     · Foto de producto + "¿precio?" → identificá el producto y dale info.
     · Screenshot de error → leelo y ayudá a resolver.
     · Comprobante de pago → agradecé y confirmá lo que ves (monto, banco, fecha).
     · Foto sin caption → describí o preguntá qué necesita.

5) "transferir_a_humano" indica si necesitás que un humano del equipo continúe la conversación:
   - activar=true SOLO si: (a) el cliente pide hablar con humano/asesor/persona, (b) detectás frustración seria, (c) la situación requiere alguien con autoridad (refund, descuento grande, decisión legal/médica), (d) hay riesgo si das info incorrecta.
   - razon: resumí en 1-2 líneas para el operador.
   - Si activar=true, igual respondé al cliente con partes diciendo educadamente que un humano continuará.
   - En caso normal: activar=false, razon="".

6) "iniciar_llamada" dispara una LLAMADA TELEFÓNICA real al cliente usando Vapi.
   - activar=true SOLO cuando: (a) el cliente acepta explícitamente que lo llames ("dale, llamame", "sí, prefiero hablar"), (b) la situación amerita conversación de voz (cierre de venta, demo, agendamiento, dudas complejas), (c) ya intercambiaron suficientes mensajes y la conversación está madura.
   - NO uses iniciar_llamada como saludo, ni en los primeros mensajes, ni si el cliente solo pidió info por escrito.
   - Antes de activarlo, AVISÁ al cliente en una parte de texto: "Listo, te llamo en unos segundos por WhatsApp Calling".
   - Solo se puede usar 1 vez por hora por conversación (cooldown). Si lo activás de más, el sistema lo ignora silenciosamente.
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

  const conImagen = mensajesParaLLM.some(
    (m) => Array.isArray(m.content),
  );
  console.log(
    `[openai] 🤖 modelo=${modelo} mensajes=${mensajesParaLLM.length} con_imagen=${conImagen}`,
  );

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
  if (!parsed.iniciar_llamada) {
    parsed.iniciar_llamada = { activar: false, razon: "" };
  }
  return parsed;
}
