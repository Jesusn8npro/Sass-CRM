/**
 * Lógica de respuesta IA del bot:
 * - Toma el historial reciente, arma el system prompt, llama a OpenAI
 * - Despacha la respuesta como múltiples partes (texto / audio / media)
 * - Procesa los 12 tools que la IA puede activar (handoff, citas,
 *   llamadas, captura de datos, lead score, etiquetas, etc.)
 * - Incluye fallback heurístico para datos que la IA no captura
 *   (regex de nombre/email/ciudad/fecha/cantidad/tipo evento)
 */
import { type WASocket } from "@whiskeysockets/baileys";
import {
  listarBiblioteca,
  listarCitasActivasDeConversacion,
  listarConocimientoDeCuenta,
  listarProductosActivos,
  obtenerHistorialReciente,
  obtenerMedioPorIdentificador,
  obtenerProducto,
  type Conversacion,
  type Cuenta,
} from "../baseDatos";
import { construirPromptSistema } from "../construirPrompt";
import { consultarTablasExternas, obtenerColumnasPermitidas } from "../db/supabaseExterno";
import {
  mensajeFueraDeServicioCliente,
  verificarLimiteMensajes,
  yaSeNotificoCerca,
  yaSeNotificoLimite,
} from "../limitesPlan";
import { actualizarMemoriaSiNecesario } from "../memoria";
import { generarRespuesta, type RespuestaIA } from "../openai";
import { enviarAlertaOperador } from "../operadorPrivado";
import { urlApp } from "../emails/cliente";
import { buscarConocimientoRelevante } from "../rag/buscar";
import {
  dormir,
  enviarFotoProducto,
  enviarMedioBiblioteca,
  enviarParteAudio,
  enviarParteTexto,
} from "./manejadorEnvio";
import { procesarAccionesIA } from "./manejadorIA-acciones";
import { procesarCapturaIA } from "./manejadorIA-captura";

/** Detecta respuestas-cáscara tipo "voy a consultar / dame un momento" que
 * dejan al cliente esperando algo que el sistema NO va a ejecutar solo (no hay
 * un "después": o se consulta en este turno con consultar_datos, o no se
 * consulta). Sirve para forzar al agente a actuar y no colgar la conversación. */
function pareceMensajeDeEspera(respuesta: RespuestaIA): boolean {
  const texto = respuesta.partes
    .filter((p) => p.tipo !== "media")
    .map((p) => p.contenido)
    .join(" ")
    .toLowerCase();
  if (!texto.trim()) return false;
  return /\b(voy a (consultar|revisar|verificar|chequear|buscar)|d[eé]jame (consultar|revisar|verificar|chequear|buscar)|permit[ií]me (consultar|revisar|verificar)|dame un momento|un momento por favor|en un momento te|enseguida te (confirmo|digo|respondo|aviso)|ya te (confirmo|aviso|digo|respondo)|te (confirmo|aviso|respondo) en (un|unos)|estoy (consultando|revisando|verificando)|lo (consulto|reviso|verifico) y te)\b/.test(
    texto,
  );
}

// ============================================================
// Generar respuesta con IA y enviar como múltiples partes
// ============================================================

/**
 * Candado por conversación. Una respuesta tarda entre 5 y 20 segundos
 * (LLM + delays de 3-5s entre partes). Si en esa ventana entra otro
 * disparo para la misma conversación — buffer que venció, re-entrega de
 * WhatsApp, seguimiento programado — el segundo run leía un historial
 * sin las partes que el primero todavía no terminó de escribir y
 * generaba una respuesta CASI IDÉNTICA. El cliente veía todo dos veces.
 */
const respuestasEnCurso = new Set<string>();

export async function generarYEnviarRespuesta(
  sock: WASocket,
  cuenta: Cuenta,
  conversacion: Conversacion,
  jidParaEnviar: string,
  prefijo: string,
): Promise<void> {
  if (respuestasEnCurso.has(conversacion.id)) {
    console.log(
      `${prefijo} ⏭ ya hay una respuesta en curso para esta conversación — descarto el disparo duplicado`,
    );
    return;
  }
  respuestasEnCurso.add(conversacion.id);
  try {
    await generarYEnviarRespuestaInterna(
      sock,
      cuenta,
      conversacion,
      jidParaEnviar,
      prefijo,
    );
  } finally {
    respuestasEnCurso.delete(conversacion.id);
  }
}

async function generarYEnviarRespuestaInterna(
  sock: WASocket,
  cuenta: Cuenta,
  conversacion: Conversacion,
  jidParaEnviar: string,
  prefijo: string,
): Promise<void> {
  // ============================================================
  // GUARD-RAIL: límite de plan.
  // Si el usuario llegó a su tope mensual de mensajes IA, NO llamamos
  // a OpenAI (ahorra tu plata) y notificamos al operador 1 vez por mes.
  // Al cliente le mandamos un mensaje genérico "fuera de servicio" sin
  // exponer que es por un límite.
  // ============================================================
  try {
    const lim = await verificarLimiteMensajes(cuenta.usuario_id);
    if (lim.lleno) {
      const yaNotif = await yaSeNotificoLimite(cuenta.id);
      if (!yaNotif) {
        // Mensaje al cliente (1 sola vez al hit)
        try {
          const { enviarParteTexto } = await import("./manejadorEnvio");
          await enviarParteTexto(
            sock,
            cuenta.id,
            conversacion.id,
            jidParaEnviar,
            mensajeFueraDeServicioCliente(cuenta),
            prefijo,
            "1/1",
            0,
          );
        } catch {
          /* ignorar — caemos al marcador igual */
        }
        // Marcador para no notificar de nuevo este mes
        try {
          const { insertarMensaje } = await import("../baseDatos");
          await insertarMensaje(
            cuenta.id,
            conversacion.id,
            "sistema",
            "[limite_plan_alcanzado_mes]",
            { tipo: "sistema" },
          );
        } catch {
          /* ignorar */
        }
        // Alerta al operador privado (separada de la cuenta — fire and forget)
        void enviarAlertaOperador(
          cuenta,
          `🚫 Límite mensual alcanzado (plan ${lim.plan.toUpperCase()}: ${lim.usados}/${lim.limite} mensajes IA).\n\n` +
            `El agente NO está respondiendo a clientes nuevos. Subí de plan para reanudar:\n` +
            `${urlApp()}/app/mi-cuenta/upgrade`,
        );
      }
      console.warn(
        `${prefijo} ⛔ límite mensual alcanzado (${lim.usados}/${lim.limite}). Skipeando respuesta IA.`,
      );
      return;
    }
    if (lim.cerca) {
      const yaNotif = await yaSeNotificoCerca(cuenta.id);
      if (!yaNotif) {
        try {
          const { insertarMensaje } = await import("../baseDatos");
          await insertarMensaje(
            cuenta.id,
            conversacion.id,
            "sistema",
            "[limite_plan_cerca_mes]",
            { tipo: "sistema" },
          );
        } catch {
          /* ignorar */
        }
        void enviarAlertaOperador(
          cuenta,
          `⚠️ Tu cuenta llegó al 90% del límite mensual (${lim.usados}/${lim.limite} mensajes IA).\n\n` +
            `Considerá subir de plan antes de quedarte sin servicio:\n` +
            `${urlApp()}/app/mi-cuenta/upgrade`,
        );
      }
      // No bloqueamos — solo advertimos.
    }
  } catch (errLim) {
    // Si el chequeo de límites falla (DB caída, plan no existe, etc.) NO
    // bloqueamos al usuario — preferible procesar de más que de menos.
    console.warn(
      `${prefijo} ⚠ check de límite falló (sigo igual):`,
      errLim instanceof Error ? errLim.message : errLim,
    );
  }

  // Ventana de contexto literal — configurable por cuenta (default 20).
  // Mensajes anteriores (si memoria_largo_plazo=true) se condensan en
  // conversacion.resumen_contexto y se inyectan al system prompt.
  const ventanaContexto = Math.max(5, Math.min(200, cuenta.mensajes_contexto || 20));
  const historial = await obtenerHistorialReciente(conversacion.id, ventanaContexto);
  console.log(
    `${prefijo} llamando LLM con ${historial.length} mensajes (ventana=${ventanaContexto}${conversacion.resumen_contexto?.trim() ? ", +resumen" : ""})...`,
  );

  try {
    await sock.presenceSubscribe(jidParaEnviar);
  } catch {}
  try {
    await sock.sendPresenceUpdate("composing", jidParaEnviar);
  } catch {}

  const conocimiento = await listarConocimientoDeCuenta(cuenta.id);
  const biblioteca = await listarBiblioteca(cuenta.id);
  const productos = await listarProductosActivos(cuenta.id);
  const citasActivas = await listarCitasActivasDeConversacion(conversacion.id);

  // RAG: tomamos los últimos 3 mensajes del usuario (reciente contexto)
  // y buscamos chunks similares. Si la cuenta no tiene chunks indexados
  // o la búsqueda no da matches, buscarConocimientoRelevante devuelve
  // [] y construirPromptSistema cae al modo dump tradicional.
  const ultimosUsuario = historial
    .filter((m) => m.rol === "usuario")
    .slice(-3)
    .map((m) => m.contenido)
    .join("\n");
  const chunksRAG = ultimosUsuario
    ? await buscarConocimientoRelevante(cuenta.id, ultimosUsuario, { k: 5 })
    : [];

  let promptCompleto = construirPromptSistema(
    cuenta,
    conocimiento,
    biblioteca,
    productos,
    conversacion,
    citasActivas,
    chunksRAG,
  );

  // Si la cuenta conectó su Supabase y habilitó tablas, le avisamos al
  // agente qué puede consultar en vivo (la acción consultar_datos).
  const bdExternaActiva =
    cuenta.agente_bd_externa_habilitada &&
    Array.isArray(cuenta.agente_tablas_permitidas) &&
    cuenta.agente_tablas_permitidas.length > 0;
  if (bdExternaActiva) {
    const telVerificado = (conversacion.telefono ?? "").replace(/[^0-9]/g, "");
    const telVerif10 = telVerificado.slice(-10);
    const nombreCliente =
      conversacion.datos_capturados?.nombre?.trim() ||
      conversacion.nombre?.trim() ||
      "";
    // Columnas reales de las tablas de ESTE negocio (genérico, cacheado).
    const columnasTablas = await obtenerColumnasPermitidas(cuenta.id);
    const tablasDesc =
      Object.keys(columnasTablas).length > 0
        ? Object.entries(columnasTablas)
            .map(([t, c]) => `• ${t} (${c.slice(0, 20).join(", ")})`)
            .join("\n")
        : cuenta.agente_tablas_permitidas.map((t) => `• ${t}`).join("\n");
    promptCompleto +=
      `\n\n## BASE DE DATOS DEL NEGOCIO (en vivo, solo lectura)\n` +
      `Estas son TUS tablas reales y sus columnas (de tu propio Supabase). Elegí la relevante por su nombre y columnas:\n${tablasDesc}\n` +
      `REGLA CRÍTICA #1 — CERO INVENCIÓN (LA MÁS IMPORTANTE): TODO dato concreto que menciones (nombres de tutoriales/canciones/cursos/productos, artistas, precios, qué hay de tal artista) DEBE salir de una consulta a la base hecha en ESTE turno. Está TERMINANTEMENTE PROHIBIDO listar o nombrar items "de memoria" o de tu conocimiento general (ej: canciones famosas de un artista que NO consultaste). Si no lo consultaste, NO lo digas. Para CUALQUIER pregunta de catálogo/inventario/"qué tenés de X"/precios DEBÉS activar consultar_datos AHORA. Si la consulta vuelve vacía, decí honestamente "no encontré X en el catálogo" y ofrecé ver lo que sí hay — NUNCA inventes para rellenar. PROHIBIDOS los placeholders/relleno tipo "otro tutorial que mencionaste", "Canción 2", "y más": si tenés el ID de algo (ej: una inscripción con tutorial_id o curso_id) pero NO su título, consultá su tabla por ESE id (ej: tutoriales con valores=[esos ids], o cursos) ANTES de responder; si aún no lo conseguiste, NO lo incluyas en la lista.\n` +
      `BÚSQUEDA POR NOMBRE/ARTISTA (parcial): para "qué tenés de [artista]" o buscar por título, usá un filtro con operador "contiene" (ej: {columna:"artista", valor:"Diomedes", operador:"contiene"}). Probá también la columna de acordeonista/autor si existe. Para ids/emails usá operador "eq".\n` +
      `PROHIBIDO DIFERIR: nunca digas "déjame verificar", "un momento", "te aviso cuando tenga la info", "verifico y te confirmo" ni nada que posponga. NO existe un "después" — el sistema consulta AHORA cuando activás consultar_datos y te devuelve los datos para que respondas YA. No anuncies que vas a buscar: BUSCALO.\n` +
      `Cómo elegir y consultar: deducí por el NOMBRE y las COLUMNAS de arriba qué tabla tiene lo que pide el cliente (ej: una tabla de productos/cursos para catálogo y precios; una de clientes/perfiles para su cuenta). Para listados de catálogo dejá "filtros" VACÍO y buscá en las filas. Usá SIEMPRE los nombres de columna REALES de arriba — no inventes columnas.\n` +
      `NAVEGÁ POR PASOS (encadená consultas): si el dato vive repartido en varias tablas relacionadas, hacelo en pasos y PODÉS consultar de nuevo mirando el resultado anterior. Ejemplo típico "qué cursos/tutoriales tiene un cliente": 1) consultá la tabla de clientes/perfiles filtrando por su email o teléfono → obtené su "id". 2) consultá la tabla que relaciona cliente↔contenido (ej: inscripciones) filtrando por ese id (columna usuario_id) → obtené los ids de cursos/tutoriales. 3) consultá las tablas de cursos/tutoriales con el filtro "valores" = esa lista de ids (trae varios de una) → obtené los TÍTULOS. Después respondé con los títulos reales. Tenés varias consultas disponibles en el mismo turno: usalas hasta tener la info completa. Si después de buscar no encontrás algo, decilo con honestidad; NUNCA inventes títulos ni datos.\n` +
      `REGLA "QUÉ INCLUYE / QUÉ TRAE X" (ej: canciones de un paquete, lecciones de un curso) — HACELO EN 2 PASOS, NUNCA en uno: PASO 1) consultá la tabla principal (la de paquetes/cursos) y ubicá X por su título para sacar su id REAL (un UUID de la base; NUNCA lo inventes ni uses algo tipo "binomio_id"). PASO 2) consultá la tabla de items FILTRANDO por ese id real (filtros=[{columna: la_fk_del_paquete, valor: el_id}]). Cada item ya viene con el título de su tutorial anidado: listá SOLO esos, en orden, sin mezclar con otros paquetes y sin inventar. Si consultás los items SIN filtro traés los de TODOS los paquetes mezclados — no lo hagas.\n` +
      `\n### SEGURIDAD — datos personales de un cliente\n` +
      `Identidad VERIFICADA de quien te escribe: teléfono WhatsApp = ${telVerificado || "(desconocido)"} (últimos 10 dígitos = ${telVerif10 || "?"})${nombreCliente ? `, nombre = ${nombreCliente}` : ""}.\n` +
      `- Para datos personales/de cuenta (si está registrado, sus cursos, sus pagos): SIEMPRE consultá con "filtros" usando el dato del PROPIO cliente (su teléfono verificado de arriba, o el email que te dé). NUNCA consultes datos personales sin filtro.\n` +
      `- BÚSQUEDA: para ubicar a un cliente, buscalo en la tabla de perfiles/usuarios por la columna de EMAIL REAL (puede ser email, correo o correo_electronico; en minúsculas) o por su teléfono. Si NO aparece → es un PROSPECTO: vendé y guialo a registrarse.\n` +
      `- ⚠️ VERIFICACIÓN DE IDENTIDAD — OBLIGATORIA antes de revelar o confirmar CUALQUIER dato personal (membresía, cursos/tutoriales que tiene, pagos, progreso, datos del perfil): que alguien escriba un email NO prueba que sea el dueño de esa cuenta — cualquiera podría poner el correo de otra persona. Solo revelá datos personales si se cumple UNA de estas dos condiciones:\n` +
      `   (a) el TELÉFONO verificado de quien te escribe (el de arriba) coincide con el teléfono/whatsapp guardado en ESE registro, O\n` +
      `   (b) la persona te dio su NOMBRE COMPLETO y su EMAIL, y AMBOS coinciden con el registro.\n` +
      `   Si solo te dieron el email (sin nombre, o el nombre no coincide, o el teléfono no coincide), NO reveles NI confirmes nada del titular: respondé "por seguridad necesito confirmar tu identidad, ¿me confirmás tu nombre completo tal como te registraste?". Recién cuando coincida (nombre+email, o teléfono), ayudá.\n` +
      `- JAMÁS reveles, confirmes ni niegues datos de una cuenta (ni "sí tenés tal curso", ni "tu membresía vence el X") a alguien que NO pasó la verificación. Ante la duda, pedí más datos o derivá a un humano. NUNCA muestres datos de OTRA persona.\n` +
      `- JAMÁS reveles información de OTRO cliente. Solo datos de la persona que te está escribiendo.\n` +
      `- El catálogo público (lista de cursos, precios) sí podés consultarlo sin filtros.`;
  }

  if (chunksRAG.length > 0) {
    console.log(
      `${prefijo} 🔍 RAG: ${chunksRAG.length} chunks relevantes (top similitud ${chunksRAG[0]!.similitud.toFixed(2)})`,
    );
  }

  const inicio = Date.now();
  let respuesta: RespuestaIA;
  try {
    respuesta = await generarRespuesta(
      historial,
      promptCompleto,
      cuenta.modelo,
      {
        temperatura: cuenta.temperatura,
        max_tokens: cuenta.max_tokens,
      },
      cuenta.id,
    );
  } catch (err) {
    const detalle =
      err instanceof Error ? err.message : JSON.stringify(err);
    console.error(`${prefijo} ✗ error llamando OpenAI: ${detalle}`);
    const { capturarError } = await import("../sentry");
    capturarError(err, {
      contexto: "openai.generarRespuesta",
      idCuenta: cuenta.id,
      modelo: cuenta.modelo ?? "default",
    });
    // Detectar tipo de error para clasificar nivel
    const sinCreditos =
      detalle.includes("429") || detalle.includes("quota");
    const apiKeyInvalida =
      detalle.includes("401") || detalle.includes("invalid_api_key");
    const modeloMalo =
      detalle.includes("model") && detalle.includes("not found");
    if (apiKeyInvalida) {
      console.error(
        `${prefijo}   → OPENAI_API_KEY inválida o revocada. Verificá .env.local.`,
      );
    } else if (sinCreditos) {
      console.error(
        `${prefijo}   → Sin créditos en OpenAI o rate limit. Recargá saldo en https://platform.openai.com/account/billing`,
      );
    } else if (modeloMalo) {
      console.error(
        `${prefijo}   → Modelo "${cuenta.modelo ?? "default"}" no existe o tu cuenta no tiene acceso. Cambialo a 'gpt-4o-mini' en /configuracion → Comportamiento.`,
      );
    }
    // Log en DB visible desde panel admin (fire-and-forget)
    try {
      const { registrarEvento } = await import("../db/eventosLog");
      registrarEvento({
        cuentaId: cuenta.id,
        // sin créditos / api key inválida son críticos: el SaaS no responde
        nivel: sinCreditos || apiKeyInvalida ? "critical" : "error",
        contexto: "openai.generarRespuesta",
        mensaje: detalle.slice(0, 500),
        metadata: {
          modelo: cuenta.modelo ?? "default",
          tipo: apiKeyInvalida
            ? "api_key_invalida"
            : sinCreditos
              ? "sin_creditos_o_rate_limit"
              : modeloMalo
                ? "modelo_no_disponible"
                : "otro",
        },
      });
    } catch {
      /* ignorar */
    }
    // No pudimos generar respuesta (ej: OpenAI sin cuota/429, API key, red).
    // En vez de dejar al cliente en silencio total, le avisamos algo breve.
    try {
      await enviarParteTexto(
        sock,
        cuenta.id,
        conversacion.id,
        jidParaEnviar,
        "Disculpá, estamos teniendo un inconveniente técnico en este momento. Ya lo estamos revisando y te respondemos a la brevedad. 🙏",
        prefijo,
        "1/1",
        0,
      );
    } catch {}
    try {
      await sock.sendPresenceUpdate("paused", jidParaEnviar);
    } catch {}
    return;
  }
  // Navegación por pasos: el agente puede ENCADENAR varias consultas
  // (ej: perfil → inscripciones → títulos). Loop acotado a MAX_CONSULTAS
  // para no disparar latencia/costo. Cada vuelta le pasamos lo acumulado.
  const MAX_CONSULTAS = 4;
  const MAX_ANTI_DEFER = 2;
  let datosAcumulados: Record<string, Record<string, unknown>[]> = {};
  let nConsultas = 0;
  let nAntiDefer = 0;
  let errorRoundTrip = false;
  while (true) {
    // (A) El modelo pidió datos: ejecutamos la consulta y le devolvemos las
    // filas para que arme la respuesta final (o encadene otra consulta).
    if (
      bdExternaActiva &&
      respuesta.consultar_datos?.activar &&
      nConsultas < MAX_CONSULTAS
    ) {
      nConsultas++;
      const tablas = respuesta.consultar_datos.tablas ?? [];
      const filtros = Array.isArray(respuesta.consultar_datos.filtros)
        ? respuesta.consultar_datos.filtros
        : [];
      console.log(
        `${prefijo} 🗄️ consultar_datos #${nConsultas}: ${tablas.join(", ") || "(sin tablas)"} filtros=${JSON.stringify(filtros)} — ${respuesta.consultar_datos.motivo || ""}`,
      );
      let datos: Record<string, Record<string, unknown>[]> = {};
      try {
        datos = await consultarTablasExternas(cuenta.id, tablas, filtros);
      } catch (err) {
        console.error(
          `${prefijo} ✗ error consultando base externa: ${err instanceof Error ? err.message : String(err)}`,
        );
        break;
      }
      datosAcumulados = { ...datosAcumulados, ...datos };
      const quedan = MAX_CONSULTAS - nConsultas;
      const promptConDatos =
        `${promptCompleto}\n\n## DATOS YA CONSULTADOS EN LA BASE (acumulado de ${nConsultas} consulta/s)\n` +
        `${JSON.stringify(datosAcumulados).slice(0, 40000)}\n\n` +
        `Si con estos datos ya podés responder al cliente, HACELO ahora (consultar_datos.activar=false) con los datos REALES, redactando natural. ` +
        `Si todavía te falta un dato relacionado (ej: ya tenés ids y te faltan sus títulos), activá consultar_datos OTRA VEZ con la tabla y filtros que faltan${quedan > 0 ? ` (te quedan ${quedan} consultas)` : " (es tu última consulta)"}. Si una consulta volvió vacía, NO inventes: decílo con honestidad.`;
      try {
        respuesta = await generarRespuesta(
          historial,
          promptConDatos,
          cuenta.modelo,
          { temperatura: cuenta.temperatura, max_tokens: cuenta.max_tokens },
          cuenta.id,
        );
      } catch (err) {
        console.error(
          `${prefijo} ✗ error OpenAI en round-trip de consulta #${nConsultas}: ${err instanceof Error ? err.message : String(err)}`,
        );
        errorRoundTrip = true;
        break;
      }
      continue;
    }
    // (B) GUARD ANTI-CUELGUE: el modelo mandó un mensaje de ESPERA ("voy a
    // consultar / dame un momento") SIN activar la consulta. Eso deja la
    // conversación colgada. Lo forzamos a consultar YA o a responder directo.
    if (nAntiDefer < MAX_ANTI_DEFER && pareceMensajeDeEspera(respuesta)) {
      // Si llegamos acá con un mensaje de espera es porque NO vamos a consultar
      // (o activar=false, o ya se agotaron las consultas). En ambos casos hay
      // que forzar una respuesta y no dejar la conversación colgada.
      nAntiDefer++;
      const puedeConsultarMas = bdExternaActiva && nConsultas < MAX_CONSULTAS;
      console.warn(
        `${prefijo} ⏳ respuesta de espera detectada (intento ${nAntiDefer}/${MAX_ANTI_DEFER}) — forzando acción inmediata`,
      );
      const datosTxt = Object.keys(datosAcumulados).length
        ? `\n\n## DATOS YA CONSULTADOS\n${JSON.stringify(datosAcumulados).slice(0, 40000)}`
        : "";
      const promptForzado =
        `${promptCompleto}\n\n## CORRECCIÓN URGENTE — NO DIFIERAS\n` +
        `Tu respuesta anterior fue un mensaje de ESPERA ("voy a consultar / dame un momento / déjame revisar"). ` +
        `Eso está PROHIBIDO: deja al cliente colgado porque NO hay un "después" — el sistema no sigue solo. ` +
        (puedeConsultarMas
          ? `Si necesitás datos de la base, activá consultar_datos AHORA (activar=true) con la tabla y los filtros correctos: el sistema te devuelve las filas en el acto. `
          : `Ya consultaste la base; respondé YA con los datos que tengas. Si no encontraste el dato, decílo con honestidad y ofrecé una alternativa (otro email, pasar a soporte). NO consultes de nuevo. `) +
        `Si no necesitás datos, respondé YA con lo que sabés. NUNCA mandes mensajes de espera ni prometas responder más tarde.` +
        datosTxt;
      try {
        respuesta = await generarRespuesta(
          historial,
          promptForzado,
          cuenta.modelo,
          { temperatura: cuenta.temperatura, max_tokens: cuenta.max_tokens },
          cuenta.id,
        );
      } catch (err) {
        console.error(
          `${prefijo} ✗ error OpenAI en guard anti-cuelgue: ${err instanceof Error ? err.message : String(err)}`,
        );
        errorRoundTrip = true;
        break;
      }
      continue;
    }
    break;
  }

  // BLINDAJE FINAL: pase lo que pase, NUNCA dejamos la conversación sin
  // respuesta. Si un round-trip falló o el modelo no devolvió contenido
  // enviable, mandamos un fallback en lugar de colgar el chat.
  const tieneContenidoEnviable = respuesta.partes.some((p) =>
    p.tipo === "media" ? !!p.media_id?.trim() : !!p.contenido?.trim(),
  );
  if (errorRoundTrip || !tieneContenidoEnviable) {
    console.warn(
      `${prefijo} ⚠ respuesta vacía o error en round-trip — enviando fallback para no colgar el chat`,
    );
    respuesta.partes = [
      {
        tipo: "texto",
        contenido:
          "Perdoná, se me complicó procesar eso en este momento. ¿Me lo repetís, por favor? Si sigue fallando te paso con una persona del equipo.",
        media_id: "",
      },
    ];
  }

  const duracion = Date.now() - inicio;
  // Log detallado de qué tools activó la IA — esencial para diagnosticar
  // por qué no captura datos. Si todo viene en false, hay que revisar
  // el prompt o el modelo.
  const toolsDisparadas: string[] = [];
  if (respuesta.transferir_a_humano?.activar) toolsDisparadas.push("HANDOFF");
  if (respuesta.iniciar_llamada?.activar) toolsDisparadas.push("LLAMAR_YA");
  if (respuesta.agendar_llamada?.activar) toolsDisparadas.push("LLAMADA_FUTURA");
  if (respuesta.agendar_cita?.activar) toolsDisparadas.push("CITA");
  if (respuesta.reprogramar_cita?.activar) toolsDisparadas.push("REPROG_CITA");
  if (respuesta.cancelar_cita?.activar) toolsDisparadas.push("CANCEL_CITA");
  if (respuesta.programar_seguimiento?.activar)
    toolsDisparadas.push("SEGUIMIENTO");
  if (respuesta.capturar_datos?.activar) {
    const c = respuesta.capturar_datos;
    const camposLlenos: string[] = [];
    if (c.nombre?.trim()) camposLlenos.push(`nombre="${c.nombre}"`);
    if (c.email?.trim()) camposLlenos.push(`email="${c.email}"`);
    if (c.telefono_alt?.trim()) camposLlenos.push(`tel_alt="${c.telefono_alt}"`);
    if (c.interes?.trim()) camposLlenos.push(`interes="${c.interes.slice(0, 30)}"`);
    if (c.negocio?.trim()) camposLlenos.push(`negocio="${c.negocio.slice(0, 30)}"`);
    if (c.ventajas?.trim()) camposLlenos.push("ventajas+");
    if (c.miedos?.trim()) camposLlenos.push("miedos+");
    if (c.otros?.trim()) camposLlenos.push(`otros="${c.otros.slice(0, 40)}"`);
    toolsDisparadas.push(`CAPTURA[${camposLlenos.join(", ")}]`);
  }
  if (respuesta.actualizar_score?.activar) {
    toolsDisparadas.push(`SCORE→${respuesta.actualizar_score.score}`);
  }
  if (respuesta.cambiar_estado?.activar && respuesta.cambiar_estado.nuevo_estado) {
    toolsDisparadas.push(`ESTADO→${respuesta.cambiar_estado.nuevo_estado}`);
  }
  if (
    Array.isArray(respuesta.productos_de_interes) &&
    respuesta.productos_de_interes.length > 0
  ) {
    toolsDisparadas.push(`PRODS×${respuesta.productos_de_interes.length}`);
  }
  console.log(
    `${prefijo} LLM respondió en ${duracion}ms (${respuesta.partes.length} parte${respuesta.partes.length === 1 ? "" : "s"}) tools=[${toolsDisparadas.join(" ") || "ninguna"}]`,
  );

  // Despachar cada parte según su tipo. La AI eligió una mezcla de
  // texto / audio / media (ver instrucciones en openai.ts).
  const tieneVoz =
    !!cuenta.voz_elevenlabs && cuenta.voz_elevenlabs.trim().length > 0;
  const tieneApiKeyEleven = !!process.env.ELEVENLABS_API_KEY;
  const puedeUsarVoz = tieneVoz && tieneApiKeyEleven;

  // Post-procesador para modo espejo_voz: si el cliente mandó audio
  // y la IA NO eligió ninguna parte tipo="audio" (a veces se olvida
  // de la instrucción), forzamos la primera parte de texto a audio.
  // Esto convierte el "soft constraint" del prompt en "hard guarantee".
  if (
    cuenta.modo_respuesta === "espejo_voz" &&
    puedeUsarVoz &&
    historial[historial.length - 1]?.tipo === "audio" &&
    !respuesta.partes.some((p) => p.tipo === "audio" && p.contenido.trim())
  ) {
    const idxPrimerTexto = respuesta.partes.findIndex(
      (p) =>
        (p.tipo === "texto" || !p.tipo) && p.contenido.trim().length > 0,
    );
    if (idxPrimerTexto >= 0) {
      respuesta.partes[idxPrimerTexto]!.tipo = "audio";
      console.log(
        `${prefijo} 🔊 espejo_voz: forzando parte ${idxPrimerTexto + 1} a audio (cliente mandó audio, IA no respondió con voz)`,
      );
    }
  }

  // Delay entre partes — configurable por cuenta (default 3s).
  // Se aplica ANTES de cada envío. Como el caller emite presence
  // 'composing' antes del loop y al final de cada parte, durante
  // este delay se ve "escribiendo..." al cliente.
  // Un delay fijo hace que todas las partes salgan exactamente igual de
  // espaciadas, y eso se nota como bot. Lo variamos ±25% alrededor del valor
  // configurado (con el default de 4s queda entre 3 y 5s), sorteando de nuevo
  // en cada parte. Si el dueño lo pone en 0, sigue siendo 0.
  const delayBaseSeg = Math.max(0, Math.min(30, cuenta.delay_entre_partes_segundos ?? 4));
  const delayPartesMs = () =>
    delayBaseSeg === 0
      ? 0
      : Math.round(delayBaseSeg * 1000 * (0.75 + Math.random() * 0.5));

  for (let i = 0; i < respuesta.partes.length; i++) {
    const parte = respuesta.partes[i]!;
    const esUltima = i === respuesta.partes.length - 1;
    const numParte = `${i + 1}/${respuesta.partes.length}`;

    if (parte.tipo === "media") {
      const idRaw = parte.media_id?.trim() ?? "";
      if (!idRaw) {
        console.warn(`${prefijo} parte ${numParte} media con id vacío, ignorada`);
      } else if (idRaw.startsWith("producto:")) {
        // Foto de un producto del catálogo (no de la biblioteca)
        const productoId = idRaw.slice("producto:".length).trim();
        if (!productoId) {
          console.warn(
            `${prefijo} parte ${numParte} media producto: con id vacío, ignorada`,
          );
        } else {
          const prod = await obtenerProducto(productoId);
          if (!prod || prod.cuenta_id !== cuenta.id) {
            console.warn(
              `${prefijo} parte ${numParte} producto:${productoId} no existe o no pertenece a esta cuenta, ignorada`,
            );
          } else {
            const esperaMs = delayPartesMs();
            if (esperaMs > 0) await dormir(esperaMs);
            await enviarFotoProducto(
              sock,
              jidParaEnviar,
              cuenta.id,
              conversacion.id,
              prod,
              prefijo,
            );
          }
        }
      } else {
        const medio = await obtenerMedioPorIdentificador(cuenta.id, idRaw);
        if (!medio) {
          console.warn(
            `${prefijo} parte ${numParte} media id="${idRaw}" no existe en biblioteca, ignorada`,
          );
        } else {
          const esperaMs = delayPartesMs();
          if (esperaMs > 0) await dormir(esperaMs);
          await enviarMedioBiblioteca(
            sock,
            jidParaEnviar,
            medio,
            cuenta.id,
            conversacion.id,
            prefijo,
          );
        }
      }
    } else if (parte.tipo === "audio" && parte.contenido.trim()) {
      // Si la cuenta no tiene voz configurada, caemos a texto.
      const exito = puedeUsarVoz
        ? await enviarParteAudio(
            sock,
            cuenta,
            conversacion.id,
            jidParaEnviar,
            parte.contenido.trim(),
            prefijo,
            numParte,
            delayPartesMs(),
          )
        : false;
      if (!exito) {
        if (!puedeUsarVoz) {
          console.log(
            `${prefijo} parte ${numParte} pedida como audio pero falta voz_elevenlabs/API key → texto`,
          );
        }
        await enviarParteTexto(
          sock,
          cuenta.id,
          conversacion.id,
          jidParaEnviar,
          parte.contenido,
          prefijo,
          numParte,
          delayPartesMs(),
        );
      }
    } else if (parte.contenido.trim()) {
      await enviarParteTexto(
        sock,
        cuenta.id,
        conversacion.id,
        jidParaEnviar,
        parte.contenido,
        prefijo,
        numParte,
        delayPartesMs(),
      );
    }

    if (!esUltima) {
      try {
        await sock.sendPresenceUpdate("composing", jidParaEnviar);
      } catch {}
    } else {
      try {
        await sock.sendPresenceUpdate("paused", jidParaEnviar);
      } catch {}
    }
  }

  // Procesar acciones de la IA (productos, handoff, llamadas, citas, seguimientos)
  await procesarAccionesIA(respuesta, cuenta, conversacion, citasActivas, prefijo);

  // Procesar captura de datos / score / estado del lead (con fallback heurístico)
  await procesarCapturaIA(respuesta, historial, cuenta, conversacion, prefijo);

  // Memoria a largo plazo — fire and forget. Si la conversación creció
  // más allá de la ventana, este job genera/actualiza el resumen
  // acumulativo con gpt-4o-mini para que el próximo turno tenga
  // contexto completo sin explotar tokens. No bloquea la respuesta:
  // los errores se loguean adentro y nunca propagan.
  void actualizarMemoriaSiNecesario(conversacion, cuenta);
}
