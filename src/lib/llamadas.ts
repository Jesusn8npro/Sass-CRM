/**
 * Lógica compartida para iniciar llamadas Vapi desde:
 *  - el botón Llamar del panel humano
 *  - el bot cuando la IA decide iniciar_llamada=true
 *
 * Centraliza:
 *  - validación de configuración Vapi en la cuenta
 *  - construcción de contexto desde el historial de WhatsApp
 *  - normalización del número
 *  - cooldown anti-spam (1 llamada por hora por conversación)
 *  - persistencia local de la llamada
 */

import {
  crearLlamadaVapi,
  insertarMensaje,
  listarLlamadasDeConversacion,
  obtenerAssistantDefault,
  obtenerHistorialReciente,
  type Conversacion,
  type Cuenta,
  type LlamadaVapi,
  type Mensaje,
} from "./baseDatos";
import { iniciarLlamada } from "./vapi";

const COOLDOWN_MS = 60 * 60 * 1000; // 1 hora

export interface ResultadoIniciar {
  ok: boolean;
  llamada?: LlamadaVapi;
  error?: string;
  motivoBloqueo?:
    | "vapi_no_configurado"
    | "cooldown"
    | "telefono_invalido"
    | "vapi_error";
}

function normalizarTelefonoE164(telefono: string): string | null {
  const limpio = telefono.replace(/[^\d+]/g, "");
  const conMas = limpio.startsWith("+") ? limpio : `+${limpio}`;
  const soloDigitos = conMas.replace(/[^\d]/g, "");
  if (soloDigitos.length < 8 || soloDigitos.length > 15) return null;
  return conMas;
}

async function dentroDeCooldown(conversacionId: string): Promise<boolean> {
  const llamadas = await listarLlamadasDeConversacion(conversacionId);
  if (llamadas.length === 0) return false;
  const ultima = llamadas[0]!; // ordenadas DESC por iniciada_en
  const ahora = Date.now();
  const ultimaMs = new Date(ultima.iniciada_en).getTime();
  return ahora - ultimaMs < COOLDOWN_MS;
}

function resumirHistorial(historial: Mensaje[], maxChars = 1500): string {
  // Tomamos los últimos N mensajes y armamos un resumen plano que la
  // IA del assistant Vapi va a leer al iniciar la llamada.
  const lineas: string[] = [];
  for (const m of historial.slice(-15)) {
    if (m.rol === "sistema") continue;
    const quien =
      m.rol === "usuario"
        ? "Cliente"
        : m.rol === "asistente"
        ? "Agente"
        : "Operador";
    const tipoMarca =
      m.tipo === "audio"
        ? " [audio]"
        : m.tipo === "imagen"
        ? " [imagen]"
        : m.tipo === "video"
        ? " [video]"
        : m.tipo === "documento"
        ? " [doc]"
        : "";
    const txt = (m.contenido ?? "").replace(/\s+/g, " ").trim();
    if (!txt) continue;
    lineas.push(`${quien}${tipoMarca}: ${txt.slice(0, 200)}`);
  }
  let texto = lineas.join("\n");
  if (texto.length > maxChars) {
    texto = "...\n" + texto.slice(-maxChars);
  }
  return texto;
}

async function construirContextoLlamada(
  cuenta: Cuenta,
  conversacion: Conversacion,
  motivo: string | null,
): Promise<string> {
  const historial = await obtenerHistorialReciente(conversacion.id, 30);
  const resumen = resumirHistorial(historial);
  const nombreCliente =
    conversacion.nombre?.trim() || `+${conversacion.telefono}`;

  const partes: string[] = [];
  partes.push(
    `CONTEXTO DE LA LLAMADA — esta es una llamada saliente que estás haciendo.`,
  );
  partes.push(
    `Estás llamando a ${nombreCliente} (número +${conversacion.telefono}) en nombre de ${cuenta.etiqueta}.`,
  );
  if (motivo && motivo.trim()) {
    partes.push(`Motivo principal de la llamada: ${motivo.trim()}`);
  }
  partes.push(
    `\nANTES de esta llamada, ya hablaste con esta persona por WhatsApp. Acá tenés el resumen de los últimos mensajes (más reciente abajo):`,
  );
  partes.push(`\n---\n${resumen}\n---`);
  partes.push(
    `\nINSTRUCCIONES: Continuá la conversación desde donde la dejaron por WhatsApp. NO empieces de cero ni hagas como que no sabés nada — referenciá lo que ya hablaron. Confirmá brevemente datos clave (nombre, motivo). Sé concreto: la idea es que la llamada cierre o avance lo que estaba abierto en chat.`,
  );
  return partes.join("\n");
}

function construirPrimerMensaje(
  cuenta: Cuenta,
  conversacion: Conversacion,
): string {
  const nombre = conversacion.nombre?.trim();
  if (nombre) {
    return `Hola ${nombre}, te llamo de ${cuenta.etiqueta} como te dije por WhatsApp. ¿Tenés un momento?`;
  }
  return `Hola, te llamo de ${cuenta.etiqueta}, seguimos lo que estábamos viendo por WhatsApp. ¿Tenés un momento?`;
}

interface OpcionesIniciar {
  cuenta: Cuenta;
  conversacion: Conversacion;
  /** Si null, usamos el teléfono de la conversación. */
  telefonoOverride?: string | null;
  /** Razón / motivo (lo escribe la IA o el operador humano). */
  motivo?: string | null;
  /** True si la llamada fue disparada por la IA (loggin distinto). */
  origen: "ia" | "humano";
  /** Si viene, override el assistant default de la cuenta. Útil
   *  cuando el operador (o la IA) elige "vendedor" / "soporte" /
   *  "cobranza" para esta llamada específica. */
  assistantIdOverride?: string | null;
  /** Override del firstMessage del assistant solo para esta llamada. */
  primerMensajeOverride?: string | null;
}

export async function iniciarLlamadaConContexto(
  opciones: OpcionesIniciar,
): Promise<ResultadoIniciar> {
  const { cuenta, conversacion, motivo, origen } = opciones;

  if (!cuenta.vapi_api_key?.trim()) {
    return {
      ok: false,
      error: "Falta API key de Vapi en la cuenta.",
      motivoBloqueo: "vapi_no_configurado",
    };
  }
  if (!cuenta.vapi_phone_id?.trim()) {
    return {
      ok: false,
      error: "Falta Phone Number ID de Vapi.",
      motivoBloqueo: "vapi_no_configurado",
    };
  }
  // Resolver assistant a usar: override > default de la cuenta (vapi_assistant_id legacy
  // o assistants_vapi.es_default=true) > error.
  let assistantIdAUsar = opciones.assistantIdOverride?.trim() || null;
  if (!assistantIdAUsar) {
    // 1) Intentar assistant default de la nueva tabla
    const def = await obtenerAssistantDefault(cuenta.id);
    if (def?.vapi_assistant_id?.trim()) {
      assistantIdAUsar = def.vapi_assistant_id.trim();
    } else if (cuenta.vapi_assistant_id?.trim()) {
      // 2) Fallback al campo legacy en cuentas
      assistantIdAUsar = cuenta.vapi_assistant_id.trim();
    }
  }
  if (!assistantIdAUsar) {
    return {
      ok: false,
      error:
        "No hay assistant Vapi configurado. Creá uno en Configuración → Assistants Vapi.",
      motivoBloqueo: "vapi_no_configurado",
    };
  }

  const telefonoOriginal = opciones.telefonoOverride ?? conversacion.telefono;
  const telefonoE164 = normalizarTelefonoE164(telefonoOriginal);
  if (!telefonoE164) {
    return {
      ok: false,
      error: "Número inválido (debe estar en E.164 con código de país).",
      motivoBloqueo: "telefono_invalido",
    };
  }

  if (await dentroDeCooldown(conversacion.id)) {
    return {
      ok: false,
      error:
        "Ya se hizo una llamada a esta conversación hace menos de una hora. Esperá antes de volver a llamar.",
      motivoBloqueo: "cooldown",
    };
  }

  const contexto = await construirContextoLlamada(
    cuenta,
    conversacion,
    motivo ?? null,
  );
  const primerMensaje = construirPrimerMensaje(cuenta, conversacion);

  try {
    const respuesta = await iniciarLlamada(cuenta.vapi_api_key, {
      assistantId: assistantIdAUsar,
      phoneNumberId: cuenta.vapi_phone_id,
      numeroCliente: telefonoE164,
      nombreCliente: conversacion.nombre ?? undefined,
      metadata: {
        cuenta_id: cuenta.id,
        conversacion_id: conversacion.id,
        origen,
      },
      contextoAdicional: contexto,
      primerMensajeOverride:
        opciones.primerMensajeOverride?.trim() || primerMensaje,
    });

    if (!respuesta.id) {
      return {
        ok: false,
        error: "Vapi no devolvió call_id.",
        motivoBloqueo: "vapi_error",
      };
    }

    const soloDigitos = telefonoE164.replace(/[^\d]/g, "");
    const llamada = await crearLlamadaVapi(
      cuenta.id,
      conversacion.id,
      respuesta.id,
      soloDigitos,
      "saliente",
    );

    // Mensaje sistema visible en el panel
    try {
      const prefijo = origen === "ia" ? "🤖📞" : "👤📞";
      const linea = `${prefijo} Llamada saliente iniciada${motivo ? ` — ${motivo}` : ""}`;
      await insertarMensaje(cuenta.id, conversacion.id, "sistema", linea, {
        tipo: "sistema",
      });
    } catch {
      // ignorar
    }

    return { ok: true, llamada };
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: detalle.slice(0, 500),
      motivoBloqueo: "vapi_error",
    };
  }
}
