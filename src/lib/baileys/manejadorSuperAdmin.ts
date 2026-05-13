/**
 * Manejador de mensajes entrantes del SUPER-ADMIN global del SaaS.
 *
 * Cuando el manejador principal (`manejador.ts`) detecta que el teléfono
 * remitente pertenece a un super-admin (`public.super_admins`), desvía
 * el mensaje acá en vez de procesarlo con la IA normal del agente.
 *
 * Acá:
 *  1. Parseamos el comando (`/usuarios`, `/reporte`, etc).
 *  2. Ejecutamos la lógica y obtenemos respuesta textual.
 *  3. La encolamos en la `bandeja_salida` para que el procesador
 *     existente la mande con todos sus retries / rate limits.
 *  4. Auditamos la acción en `admin_acciones`.
 */
import type { WASocket } from "@whiskeysockets/baileys";
import {
  encolarBandejaSalida,
  insertarMensaje,
  registrarAccionAdmin,
  type Conversacion,
  type SuperAdmin,
} from "../baseDatos";
import {
  ejecutarComandoAdmin,
  parsearComandoAdmin,
} from "../admin/comandos";
import {
  conversarConAdminNL,
  motorAdminActivo,
} from "../admin/conversacionAdmin";
import { calcularCostoAnthropicUSD, MODELO_ANTHROPIC_DEFAULT } from "../anthropic";
import {
  calcularCostoOpenAIAdminUSD,
  MODELO_OPENAI_ADMIN_DEFAULT,
} from "../openaiAdminToolCalling";
import { registrarUso } from "../db/meteringUso";

export interface ParamsManejoSuperAdmin {
  /** Socket activo de la cuenta receptora */
  sock: WASocket;
  /** ID de la cuenta receptora (la que recibió el mensaje admin) */
  cuentaId: string;
  /** Conversación donde llegó el mensaje */
  conversacion: Conversacion;
  /** Teléfono del super-admin (ya validado) */
  telefonoAdmin: string;
  /** Texto que escribió el admin */
  texto: string;
  /** JID para responder (mismo que llegó) */
  jidParaEnviar: string;
  /** Datos del super-admin (ya cargado por el caller) */
  superAdmin: SuperAdmin;
  /** Prefijo de log */
  prefijo: string;
}

/**
 * Maneja un mensaje del super-admin. NO genera respuesta IA — solo
 * ejecuta comandos administrativos.
 */
export async function manejarMensajeSuperAdmin(
  params: ParamsManejoSuperAdmin,
): Promise<void> {
  const { texto, superAdmin, prefijo, conversacion } = params;

  console.log(
    `${prefijo} 👑 super-admin ${superAdmin.email} (conv=${conversacion.id.slice(0, 8)}) → "${texto.slice(0, 80)}"`,
  );

  // Estrategia dual:
  //   1. Primero intentamos parsear como comando slash determinístico
  //      (/post, /reporte, /publicar, etc). Si matchea, ejecutamos el
  //      handler determinístico — rápido, sin costo IA, fallback safe.
  //   2. Si NO matchea, desviamos a Claude Haiku 4.5 con tool calling
  //      para conversación en lenguaje natural.
  //
  // El Patrón puede usar cualquiera de los dos modos indistinto. Los
  // slash commands son la red de seguridad si Claude se cae o si hay
  // que ejecutar algo crítico sin riesgo de mala interpretación.
  const cmd = parsearComandoAdmin(texto);

  if (cmd) {
    await procesarComandoSlash(params, cmd);
    return;
  }

  // No matcheó ningún slash → conversación natural con Claude
  await procesarConversacionNatural(params);
}

async function procesarComandoSlash(
  params: ParamsManejoSuperAdmin,
  cmd: ReturnType<typeof parsearComandoAdmin>,
): Promise<void> {
  if (!cmd) return;
  const { superAdmin, prefijo } = params;

  const inicio = Date.now();
  let respuesta: string;
  let resultado: Record<string, unknown>;
  let error: string | null = null;
  try {
    const ejec = await ejecutarComandoAdmin(cmd, {
      superAdminEmail: superAdmin.email,
      superAdminNombre: superAdmin.nombre,
    });
    respuesta = ejec.respuesta;
    resultado = ejec.resultado;
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    respuesta = `❌ Error interno ejecutando /${cmd.comando}.\n\n${error.slice(0, 200)}`;
    resultado = {};
    console.error(`${prefijo} error en comando admin ${cmd.comando}:`, err);
  }
  const ms = Date.now() - inicio;

  await responderAdmin(params, respuesta);

  void registrarAccionAdmin({
    superAdminId: superAdmin.id,
    origen: "whatsapp",
    accion: cmd.comando,
    payload: {
      args: cmd.args,
      cuenta_id: params.cuentaId,
      conv_id: params.conversacion.id,
    },
    resultado: { ...resultado, ms },
    error,
  });
}

async function procesarConversacionNatural(
  params: ParamsManejoSuperAdmin,
): Promise<void> {
  const { cuentaId, conversacion, texto, superAdmin, prefijo, sock, jidParaEnviar } = params;

  const inicio = Date.now();
  let respuesta = "";
  let tokensIn = 0;
  let tokensOut = 0;
  let toolsEjecutadas = 0;
  let nombresTools: string[] = [];
  let error: string | null = null;

  // Mostrar "escribiendo..." mientras el agente procesa (puede tardar 60-120s)
  try { await sock.sendPresenceUpdate("composing", jidParaEnviar); } catch { /* no-op */ }

  try {
    const r = await conversarConAdminNL({
      conversacionId: conversacion.id,
      textoEntrante: texto,
      superAdmin,
    });
    respuesta = r.respuesta;
    tokensIn = r.tokensIn;
    tokensOut = r.tokensOut;
    toolsEjecutadas = r.toolsEjecutadas;
    nombresTools = r.nombresTools;
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    console.error(`${prefijo} error en conversación NL admin:`, err);
    respuesta = construirMensajeErrorAmigable(error);
  } finally {
    try { await sock.sendPresenceUpdate("paused", jidParaEnviar); } catch { /* no-op */ }
  }

  const ms = Date.now() - inicio;
  await responderAdmin(params, respuesta);

  // Metering del consumo IA (según motor activo openai/anthropic)
  if (!error && (tokensIn > 0 || tokensOut > 0)) {
    const motor = motorAdminActivo();
    const modelo =
      motor === "anthropic"
        ? MODELO_ANTHROPIC_DEFAULT
        : MODELO_OPENAI_ADMIN_DEFAULT;
    const costo =
      motor === "anthropic"
        ? calcularCostoAnthropicUSD(modelo, tokensIn, tokensOut)
        : calcularCostoOpenAIAdminUSD(modelo, tokensIn, tokensOut);
    registrarUso({
      cuenta_id: cuentaId,
      proveedor: motor,
      modelo,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      costo_usd: costo,
      metadata: {
        tipo: "agente_admin_nl",
        motor,
        tools: nombresTools,
        ms,
      },
    });
  }

  void registrarAccionAdmin({
    superAdminId: superAdmin.id,
    origen: "whatsapp",
    accion: "conversacion_natural",
    payload: {
      texto: texto.slice(0, 500),
      cuenta_id: cuentaId,
      conv_id: conversacion.id,
    },
    resultado: {
      ms,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      tools_ejecutadas: toolsEjecutadas,
      tools: nombresTools,
    },
    error,
  });
}

/**
 * Encola la respuesta en la bandeja_salida. Reusa toda la infraestructura
 * existente de envío con retries / rate limits / dedup de echo.
 *
 * También inserta una fila en `mensajes` con rol=asistente para que la
 * conversación se vea coherente en el panel del cliente dueño de la cuenta
 * (aunque ese cliente normalmente no debería ver esta conversación porque
 * es entre vos como SaaS-admin y su número).
 */
/**
 * Convierte errores técnicos del SDK Anthropic/red en mensajes
 * accionables para el Patrón. No expone el stack ni payloads crudos.
 */
function construirMensajeErrorAmigable(errorMsg: string): string {
  const lower = errorMsg.toLowerCase();

  // 401 — key inválida (puede ser OpenAI o Anthropic según motor activo)
  if (
    lower.includes("invalid x-api-key") ||
    lower.includes("authentication_error") ||
    lower.includes("incorrect api key") ||
    lower.includes("invalid_api_key") ||
    lower.includes("401")
  ) {
    const motor = motorAdminActivo();
    const proveedor = motor === "anthropic" ? "Anthropic" : "OpenAI";
    const variable =
      motor === "anthropic" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY";
    const formatoEsperado =
      motor === "anthropic"
        ? "Debe empezar con `sk-ant-api03-` UNA sola vez, ~108 caracteres"
        : "Debe empezar con `sk-proj-` o `sk-`, sin espacios";
    return [
      `❌ Patrón, la API key de ${proveedor} no es válida.`,
      ``,
      `Verificá en Easy Panel la variable *${variable}*:`,
      `· ${formatoEsperado}`,
      `· Sin espacios al inicio o final`,
      ``,
      `Mientras tanto podés usar slash commands. Escribí *ayuda* para la lista.`,
    ].join("\n");
  }

  // 429 — rate limit
  if (lower.includes("rate_limit") || lower.includes("429")) {
    return [
      `⏳ Patrón, llegamos al rate limit de Anthropic.`,
      ``,
      `Esperá 30 segundos y volvé a escribirme, o usá un slash command.`,
    ].join("\n");
  }

  // 529 / overloaded
  if (lower.includes("overloaded") || lower.includes("529")) {
    return [
      `⚠️ Patrón, Anthropic está sobrecargada justo ahora.`,
      ``,
      `Volvé a intentarlo en 1-2 minutos. Para algo urgente, slash command.`,
    ].join("\n");
  }

  // 402 / insufficient credit
  if (lower.includes("credit_balance") || lower.includes("insufficient")) {
    return [
      `💳 Patrón, se acabó el saldo de Anthropic.`,
      ``,
      `Recargá en https://console.anthropic.com/settings/billing`,
      `Mientras, los slash commands siguen funcionando.`,
    ].join("\n");
  }

  // Genérico
  return [
    `❌ Patrón, no pude procesar tu mensaje con el agente IA.`,
    ``,
    `Detalle técnico: ${errorMsg.slice(0, 200)}`,
    ``,
    `Probá con un slash command — escribí *ayuda* para la lista.`,
  ].join("\n");
}

async function responderAdmin(
  params: ParamsManejoSuperAdmin,
  texto: string,
): Promise<void> {
  const { cuentaId, conversacion, telefonoAdmin } = params;

  // Encolar para que el procesador de bandeja la envíe en el próximo tick.
  // El procesador la manda con retries del manejadorEnvio + dedup de echo.
  try {
    await encolarBandejaSalida(
      cuentaId,
      conversacion.id,
      telefonoAdmin,
      texto,
      { tipo: "texto", media_path: null },
    );
  } catch (err) {
    // Fallback: insertar directo en mensajes y dejar que el panel lo muestre.
    // Si la bandeja falla, al menos queda audit del intento de respuesta.
    console.error(`${params.prefijo} no se pudo encolar respuesta admin:`, err);
    await insertarMensaje(cuentaId, conversacion.id, "asistente", texto, {
      tipo: "texto",
      media_path: null,
      wa_msg_id: null,
    });
  }
}
