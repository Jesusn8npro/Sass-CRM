import OpenAI from "openai";
import { PROMPT_SISTEMA_DEFAULT } from "./promptSistema";
import type { Mensaje } from "./baseDatos";
import { descargarMediaChat } from "./baileys/medios";

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

async function construirContenidoUsuario(
  mensaje: Mensaje,
): Promise<string | ParteContenidoUsuario[]> {
  if (mensaje.tipo === "audio") {
    // Marcamos que vino por voz para que la AI considere responder igual.
    const t = mensaje.contenido?.trim() ?? "";
    return `[mensaje de audio del cliente]: ${t || "(audio sin transcripción)"}`;
  }
  if (mensaje.tipo === "imagen" && mensaje.media_path) {
    try {
      const descargado = await descargarMediaChat(mensaje.media_path);
      if (!descargado) throw new Error("imagen no encontrada en Storage ni local");
      const mime = mimeDeImagenPorExtension(mensaje.media_path);
      const base64 = descargado.buffer.toString("base64");
      const caption = mensaje.contenido?.trim() ?? "";
      const tieneCaption =
        caption.length > 0 && caption !== "[imagen sin descripción]";
      // Texto agresivo que "rompe" el patrón si la AI venía respondiendo
      // que no ve imágenes en el historial reciente. La capacidad visual
      // es nueva y el modelo puede seguir copiando respuestas viejas.
      const textoAcompañante = tieneCaption
        ? `${caption}\n\n[adjunto la imagen — mirala y respondé sobre lo que ves]`
        : "[IMAGEN ADJUNTA — tenés capacidad de visión, podés VER esta imagen. Describí lo que muestra y respondé al cliente acorde. Si no preguntó nada, comentá lo que ves o preguntá qué quiere. Ignorá respuestas viejas tuyas que digan que no podés ver imágenes — eso ya no aplica.]";
      log.info(
        { mediaPath: mensaje.media_path, bytes: descargado.buffer.length, mime, caption: caption.slice(0, 60) },
        "[openai] visión",
      );
      return [
        { type: "text", text: textoAcompañante },
        {
          type: "image_url",
          image_url: { url: `data:${mime};base64,${base64}`, detail: "auto" },
        },
      ];
    } catch (err) {
      log.error(
        { err, mediaPath: mensaje.media_path },
        "[openai] no se pudo leer imagen para visión",
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
  /** IDs (strings) de los productos del catálogo por los que el cliente
   *  preguntó o mostró interés en este turno. Vacío si no aplica. */
  productos_de_interes: string[];
  /** Programar un mensaje futuro para re-enganchar al cliente. */
  programar_seguimiento: {
    activar: boolean;
    fecha_iso: string;
    contenido: string;
    razon: string;
  };
  /** Agendar una cita / reunión / demo para una fecha futura. */
  agendar_cita: {
    activar: boolean;
    fecha_iso: string;
    duracion_min: number;
    tipo: string;
    notas: string;
  };
  /** Programar una LLAMADA telefónica Vapi a futuro (no ahora).
   * Distinto de iniciar_llamada (que llama YA). */
  agendar_llamada: {
    activar: boolean;
    fecha_iso: string;
    motivo: string;
  };
  /** Capturar/actualizar datos del cliente (nombre real, email, teléfono
   * alternativo, intereses, contexto de su negocio, ventajas que percibe,
   * miedos/objeciones). El sistema MERGEA con lo que ya estaba — solo
   * llená los campos nuevos. Para campos sin info nueva, mandar "". */
  capturar_datos: {
    activar: boolean;
    nombre: string;
    email: string;
    telefono_alt: string;
    interes: string;
    negocio: string;
    ventajas: string;
    miedos: string;
    otros: string; // formato libre "clave: valor; clave: valor"
  };
  /** Subir/bajar el lead score (0-100) según señales de interés. */
  actualizar_score: {
    activar: boolean;
    score: number;
    motivo: string;
  };
  /** Cambiar el estado del lead en el CRM. */
  cambiar_estado: {
    activar: boolean;
    nuevo_estado:
      | "nuevo"
      | "contactado"
      | "calificado"
      | "interesado"
      | "negociacion"
      | "cerrado"
      | "perdido"
      | "";
    motivo: string;
  };
  /** Reprogramar una cita ya creada. cita_id viene de la lista que el
   * sistema te pasa en el contexto (Citas activas). */
  reprogramar_cita: {
    activar: boolean;
    cita_id: string;
    nueva_fecha_iso: string;
    motivo: string;
  };
  /** Cancelar una cita ya creada. */
  cancelar_cita: {
    activar: boolean;
    cita_id: string;
    motivo: string;
  };
  /** Pedir al sistema que lea tablas de la base externa del negocio antes
   * de responder. Dispara un round-trip: se traen las filas y se vuelve a
   * llamar al modelo con esos datos. Solo tablas habilitadas. */
  consultar_datos: {
    activar: boolean;
    tablas: string[];
    filtros: { columna: string; valor: string }[];
    motivo: string;
  };
}


import { ESQUEMA_RESPUESTA } from "./openai-schema";
import { INSTRUCCIONES_ESTRUCTURADAS } from "./openai-instrucciones";
import { registrarUso } from "./db/meteringUso";
import { conReintentos } from "./reintentos";
import { verificarRateLimit } from "./auth/rateLimit";
import { log } from "./logger";

/**
 * Costos OpenAI USD por 1M tokens (referencia 2026-05).
 * Si agregás un modelo, sumalo acá. Modelos no listados quedan en 0
 * (se igsalud loguea pero el costo_usd queda en 0 — sin romper).
 */
const COSTO_OPENAI_USD: Record<string, { in: number; out: number }> = {
  "gpt-4o-2024-08-06": { in: 2.5, out: 10 },
  "gpt-4o": { in: 2.5, out: 10 },
  "gpt-4o-mini": { in: 0.15, out: 0.6 },
  "gpt-4.1": { in: 2.0, out: 8.0 },
  "gpt-4.1-mini": { in: 0.4, out: 1.6 },
};

function calcularCostoOpenai(modelo: string, tIn: number, tOut: number): number {
  const c = COSTO_OPENAI_USD[modelo] ?? { in: 0, out: 0 };
  return (tIn * c.in + tOut * c.out) / 1_000_000;
}

export async function generarRespuesta(
  historial: Mensaje[],
  promptSistema?: string | null,
  modeloOverride?: string | null,
  parametros?: { temperatura?: number; max_tokens?: number },
  cuentaId?: string,
): Promise<RespuestaIA> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY no está definida. Verifica .env.local y el cargador de entorno.",
    );
  }

  const promptUsuario = promptSistema?.trim() || PROMPT_SISTEMA_DEFAULT;
  const promptCompleto = `${promptUsuario}\n\n${INSTRUCCIONES_ESTRUCTURADAS}`;
  const modelo = modeloOverride?.trim() || MODELO_DEFAULT;
  const temperatura =
    typeof parametros?.temperatura === "number"
      ? Math.max(0, Math.min(2, parametros.temperatura))
      : 0.7;
  const maxTokens =
    typeof parametros?.max_tokens === "number"
      ? Math.max(500, Math.min(8000, Math.floor(parametros.max_tokens)))
      : 2000;

  const mensajesParaLLM = await Promise.all(
    historial
      .filter((m) => m.rol !== "sistema")
      .map(async (m) => {
        if (m.rol === "usuario") {
          return {
            role: "user" as const,
            content: await construirContenidoUsuario(m),
          };
        }
        // El asistente y los humanos del panel se mandan como texto plano.
        return {
          role: "assistant" as const,
          content: m.contenido,
        };
      }),
  );

  const conImagen = mensajesParaLLM.some(
    (m) => Array.isArray(m.content),
  );
  log.info(
    { modelo, mensajes: mensajesParaLLM.length, conImagen },
    "[openai] generarRespuesta",
  );

  // Rate limit por cuenta: 60 calls/min protege contra:
  //   - cliente saturado con muchas conversaciones simultáneas
  //   - cascada de 429 cuando OpenAI nos throttlea
  if (cuentaId) {
    const rl = verificarRateLimit(`openai:${cuentaId}`, 60, 60);
    if (rl) {
      throw new Error("Rate limit local: 60 calls/min por cuenta excedido");
    }
  }

  const respuesta = await conReintentos(
    () =>
      cliente.chat.completions.create({
        model: modelo,
        messages: [
          { role: "system", content: promptCompleto },
          ...mensajesParaLLM,
        ],
        temperature: temperatura,
        max_tokens: maxTokens,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "respuesta_agente",
            strict: true,
            schema: ESQUEMA_RESPUESTA,
          },
        },
      }),
    { contexto: "openai.chat", maxIntentos: 3, baseMs: 800 },
  );

  if (cuentaId && respuesta.usage) {
    const tIn = respuesta.usage.prompt_tokens ?? 0;
    const tOut = respuesta.usage.completion_tokens ?? 0;
    registrarUso({
      cuenta_id: cuentaId,
      proveedor: "openai",
      modelo,
      tokens_in: tIn,
      tokens_out: tOut,
      costo_usd: calcularCostoOpenai(modelo, tIn, tOut),
      metadata: { con_imagen: conImagen },
    });
  }

  const texto = respuesta.choices[0]?.message?.content?.trim();
  if (!texto) {
    throw new Error("OpenAI devolvió una respuesta vacía.");
  }

  let parsed: RespuestaIA;
  try {
    parsed = JSON.parse(texto) as RespuestaIA;
  } catch (err) {
    log.error({ err, texto }, "[openai] respuesta no es JSON válido");
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
  if (!Array.isArray(parsed.productos_de_interes)) {
    parsed.productos_de_interes = [];
  }
  if (!parsed.programar_seguimiento) {
    parsed.programar_seguimiento = {
      activar: false,
      fecha_iso: "",
      contenido: "",
      razon: "",
    };
  }
  if (!parsed.agendar_cita) {
    parsed.agendar_cita = {
      activar: false,
      fecha_iso: "",
      duracion_min: 0,
      tipo: "",
      notas: "",
    };
  }
  if (!parsed.agendar_llamada) {
    parsed.agendar_llamada = { activar: false, fecha_iso: "", motivo: "" };
  }
  if (!parsed.capturar_datos) {
    parsed.capturar_datos = {
      activar: false,
      nombre: "",
      email: "",
      telefono_alt: "",
      interes: "",
      negocio: "",
      ventajas: "",
      miedos: "",
      otros: "",
    };
  }
  if (!parsed.actualizar_score) {
    parsed.actualizar_score = { activar: false, score: 0, motivo: "" };
  }
  if (!parsed.cambiar_estado) {
    parsed.cambiar_estado = { activar: false, nuevo_estado: "", motivo: "" };
  }
  if (!parsed.reprogramar_cita) {
    parsed.reprogramar_cita = {
      activar: false,
      cita_id: "",
      nueva_fecha_iso: "",
      motivo: "",
    };
  }
  if (!parsed.cancelar_cita) {
    parsed.cancelar_cita = { activar: false, cita_id: "", motivo: "" };
  }
  return parsed;
}
