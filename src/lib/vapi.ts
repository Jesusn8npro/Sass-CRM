/**
 * Cliente para la API de Vapi (https://vapi.ai).
 * Doc: https://docs.vapi.ai/api-reference
 *
 * Cada cuenta tiene su propia api_key, assistant_id y phone_id —
 * así un usuario puede orquestar varios negocios independientes.
 *
 * Endpoints usados:
 *  - POST /assistant         crear/actualizar assistant
 *  - PATCH /assistant/{id}   modificar
 *  - GET /assistant/{id}     consultar
 *  - GET /phone-number       listar phone numbers de la cuenta Vapi
 *  - POST /call              iniciar llamada saliente
 *  - GET /call/{id}          consultar estado/transcripción
 *
 * Auth: header `Authorization: Bearer <api_key>`.
 */

const VAPI_API = "https://api.vapi.ai";

export interface VapiAssistant {
  id: string;
  name?: string;
  model?: {
    provider: string;
    model: string;
    messages?: Array<{ role: string; content: string }>;
  };
  voice?: { provider: string; voiceId: string };
  firstMessage?: string;
  serverUrl?: string;
  serverUrlSecret?: string;
}

export interface VapiPhoneNumber {
  id: string;
  number?: string;
  name?: string;
  provider?: string;
}

export interface VapiCall {
  id: string;
  status?: string;
  type?: string;
  startedAt?: string;
  endedAt?: string;
  endedReason?: string;
  cost?: number;
  customer?: { number?: string };
  transcript?: string;
  summary?: string;
  recordingUrl?: string;
  artifact?: {
    transcript?: string;
    recordingUrl?: string;
  };
  analysis?: {
    summary?: string;
    successEvaluation?: string;
  };
}

interface OpcionesAssistant {
  /** Nombre interno (visible solo en panel Vapi). */
  nombre: string;
  /** System prompt completo (cuenta + contexto + instrucciones de llamada). */
  systemPrompt: string;
  /** Frase inicial que dice el agente al contestar/llamar. */
  primerMensaje: string;
  /** Modelo OpenAI a usar (gpt-4o, gpt-4o-mini). */
  modelo: string;
  /** Voice ID de ElevenLabs configurado en la cuenta. */
  vozId: string;
  /** URL pública donde Vapi mandará webhooks de eventos. */
  serverUrl?: string;
  /** Secret que Vapi enviará en cada webhook para verificación. */
  serverUrlSecret?: string;
  /** Duración máxima en segundos. Default 600 (10 min). */
  maxSegundos?: number;
  /** Si true, Vapi graba la llamada y manda recordingUrl en el webhook. */
  grabar?: boolean;
}

function construirPayloadAssistant(opciones: OpcionesAssistant) {
  return {
    name: opciones.nombre,
    model: {
      provider: "openai",
      model: opciones.modelo || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: opciones.systemPrompt,
        },
      ],
    },
    voice: {
      provider: "11labs",
      voiceId: opciones.vozId,
      // Modelo multilingüe para que hable bien español.
      model: "eleven_multilingual_v2",
      stability: 0.5,
      similarityBoost: 0.9,
    },
    firstMessage: opciones.primerMensaje,
    // Idioma de la transcripción que Vapi hace en tiempo real.
    transcriber: { provider: "deepgram", model: "nova-2", language: "es" },
    serverUrl: opciones.serverUrl,
    serverUrlSecret: opciones.serverUrlSecret,
    // Configuración de duración y grabación.
    silenceTimeoutSeconds: 30,
    maxDurationSeconds:
      typeof opciones.maxSegundos === "number" && opciones.maxSegundos > 0
        ? Math.min(3600, Math.floor(opciones.maxSegundos))
        : 600,
    // recordingEnabled controla si Vapi guarda el audio (recording_url).
    recordingEnabled: opciones.grabar !== false,
  };
}

async function requestVapi<T = unknown>(
  apiKey: string,
  metodo: "GET" | "POST" | "PATCH" | "DELETE",
  ruta: string,
  cuerpo?: unknown,
): Promise<T> {
  const res = await fetch(`${VAPI_API}${ruta}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
  });
  if (!res.ok) {
    const detalle = await res.text().catch(() => "");
    if (res.status === 401) {
      throw new Error("Vapi 401: API key inválida.");
    }
    if (res.status === 404) {
      throw new Error(`Vapi 404 en ${ruta}: recurso no encontrado.`);
    }
    if (res.status === 402) {
      throw new Error(
        "Vapi 402: sin créditos o plan insuficiente para esta acción.",
      );
    }
    throw new Error(`Vapi ${res.status} en ${ruta}: ${detalle.slice(0, 400)}`);
  }
  return (await res.json()) as T;
}

// ============================================================
// Assistants
// ============================================================
export async function crearAssistant(
  apiKey: string,
  opciones: OpcionesAssistant,
): Promise<VapiAssistant> {
  return requestVapi<VapiAssistant>(
    apiKey,
    "POST",
    "/assistant",
    construirPayloadAssistant(opciones),
  );
}

export async function actualizarAssistant(
  apiKey: string,
  assistantId: string,
  opciones: OpcionesAssistant,
): Promise<VapiAssistant> {
  return requestVapi<VapiAssistant>(
    apiKey,
    "PATCH",
    `/assistant/${encodeURIComponent(assistantId)}`,
    construirPayloadAssistant(opciones),
  );
}

export async function obtenerAssistant(
  apiKey: string,
  assistantId: string,
): Promise<VapiAssistant> {
  return requestVapi<VapiAssistant>(
    apiKey,
    "GET",
    `/assistant/${encodeURIComponent(assistantId)}`,
  );
}

// ============================================================
// Phone numbers (los que la cuenta Vapi tiene configurados)
// ============================================================
export async function listarPhoneNumbers(
  apiKey: string,
): Promise<VapiPhoneNumber[]> {
  return requestVapi<VapiPhoneNumber[]>(apiKey, "GET", "/phone-number");
}

// ============================================================
// Calls
// ============================================================
export interface OpcionesIniciarLlamada {
  assistantId: string;
  phoneNumberId: string;
  /** Número del cliente en formato E.164 (con +código país). */
  numeroCliente: string;
  /** Nombre opcional para el customer (logging). */
  nombreCliente?: string;
  /** Metadata libre que vuelve en los webhooks. La usamos para
   *  vincular la llamada con la conversación local. */
  metadata?: Record<string, unknown>;
  /** Override del firstMessage del assistant solo para esta llamada
   *  (ej: "Hola Juan, te llamo de Lapeira como te dije por WhatsApp"). */
  primerMensajeOverride?: string;
  /** Contexto adicional que se inyecta como mensaje system extra,
   *  por encima del prompt base del assistant. Sirve para pasarle a
   *  Vapi el resumen de la conversación previa de WhatsApp. */
  contextoAdicional?: string;
}

export async function iniciarLlamada(
  apiKey: string,
  opciones: OpcionesIniciarLlamada,
): Promise<VapiCall> {
  // Vapi acepta assistantOverrides para personalizar parte del assistant
  // SOLO para esta llamada sin tocar el assistant compartido.
  // Doc: https://docs.vapi.ai/api-reference/calls/create
  const assistantOverrides: Record<string, unknown> = {};
  if (opciones.primerMensajeOverride) {
    assistantOverrides.firstMessage = opciones.primerMensajeOverride;
  }
  if (opciones.contextoAdicional) {
    // Vapi acepta un array adicional de messages que se injecta al inicio
    // del system. No reemplaza, agrega.
    assistantOverrides.model = {
      messages: [
        {
          role: "system" as const,
          content: opciones.contextoAdicional,
        },
      ],
    };
  }

  const cuerpo: Record<string, unknown> = {
    assistantId: opciones.assistantId,
    phoneNumberId: opciones.phoneNumberId,
    customer: {
      number: opciones.numeroCliente,
      name: opciones.nombreCliente,
    },
    metadata: opciones.metadata,
  };
  if (Object.keys(assistantOverrides).length > 0) {
    cuerpo.assistantOverrides = assistantOverrides;
  }
  return requestVapi<VapiCall>(apiKey, "POST", "/call", cuerpo);
}

export async function obtenerLlamada(
  apiKey: string,
  callId: string,
): Promise<VapiCall> {
  return requestVapi<VapiCall>(
    apiKey,
    "GET",
    `/call/${encodeURIComponent(callId)}`,
  );
}

// ============================================================
// Verificación del webhook (Vapi manda x-vapi-secret en headers
// si configuraste serverUrlSecret en el assistant).
// ============================================================
export function verificarSecretWebhook(
  headerSecret: string | null | undefined,
  esperado: string | null | undefined,
): boolean {
  if (!esperado) return true; // sin secret configurado, pasa cualquier cosa
  if (!headerSecret) return false;
  return headerSecret === esperado;
}
