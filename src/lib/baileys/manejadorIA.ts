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

// ============================================================
// Generar respuesta con IA y enviar como múltiples partes
// ============================================================
export async function generarYEnviarRespuesta(
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
      `REGLA CRÍTICA: para CUALQUIER pregunta sobre el catálogo, qué hay disponible, precios, si tienen algo específico, o datos de la cuenta del cliente, DEBÉS activar "consultar_datos" con la tabla relevante EN ESE MISMO TURNO. NUNCA respondas de memoria ni digas que algo "no existe / no tenemos" sin haber consultado primero la base.\n` +
      `PROHIBIDO DIFERIR: nunca digas "déjame verificar", "un momento", "te aviso cuando tenga la info", "verifico y te confirmo" ni nada que posponga. NO existe un "después" — el sistema consulta AHORA cuando activás consultar_datos y te devuelve los datos para que respondas YA. No anuncies que vas a buscar: BUSCALO.\n` +
      `Cómo elegir y consultar: deducí por el NOMBRE y las COLUMNAS de arriba qué tabla tiene lo que pide el cliente (ej: una tabla de productos/cursos para catálogo y precios; una de clientes/perfiles para su cuenta). Para listados de catálogo dejá "filtros" VACÍO y buscá en las filas. Usá SIEMPRE los nombres de columna REALES de arriba — no inventes columnas.\n` +
      `NAVEGÁ POR PASOS (encadená consultas): si el dato vive repartido en varias tablas relacionadas, hacelo en pasos y PODÉS consultar de nuevo mirando el resultado anterior. Ejemplo típico "qué cursos/tutoriales tiene un cliente": 1) consultá la tabla de clientes/perfiles filtrando por su email o teléfono → obtené su "id". 2) consultá la tabla que relaciona cliente↔contenido (ej: inscripciones) filtrando por ese id (columna usuario_id) → obtené los ids de cursos/tutoriales. 3) consultá las tablas de cursos/tutoriales con el filtro "valores" = esa lista de ids (trae varios de una) → obtené los TÍTULOS. Después respondé con los títulos reales. Tenés varias consultas disponibles en el mismo turno: usalas hasta tener la info completa. Si después de buscar no encontrás algo, decilo con honestidad; NUNCA inventes títulos ni datos.\n` +
      `\n### SEGURIDAD — datos personales de un cliente\n` +
      `Identidad VERIFICADA de quien te escribe: teléfono WhatsApp = ${telVerificado || "(desconocido)"} (últimos 10 dígitos = ${telVerif10 || "?"})${nombreCliente ? `, nombre = ${nombreCliente}` : ""}.\n` +
      `- Para datos personales/de cuenta (si está registrado, sus cursos, sus pagos): SIEMPRE consultá con "filtros" usando el dato del PROPIO cliente (su teléfono verificado de arriba, o el email que te dé). NUNCA consultes datos personales sin filtro.\n` +
      `- ¿CLIENTE EXISTENTE o PROSPECTO? Para saberlo, buscalo en la tabla de clientes/perfiles filtrando por su EMAIL (en minúsculas) si te lo dio, o por su teléfono. Si APARECE → es cliente registrado: ayudalo con su cuenta (y si querés listar qué tiene, encadená a la tabla de inscripciones/compras como en "navegá por pasos"). Si NO aparece → es un PROSPECTO: vendé y guialo a registrarse. No le pidas el teléfono: ya lo tenés verificado arriba.\n` +
      `- Antes de entregar info personal, confirmá que coincide con esta persona (que el email/nombre del registro encaje con el cliente). Si los datos NO coinciden o no encontrás su registro, NO inventes ni des datos de otro: decí que no encontrás su registro con ese dato y pedí otro (email alternativo, etc.).\n` +
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
    try {
      await sock.sendPresenceUpdate("paused", jidParaEnviar);
    } catch {}
    return;
  }
  // Navegación por pasos: el agente puede ENCADENAR varias consultas
  // (ej: perfil → inscripciones → títulos). Loop acotado a MAX_CONSULTAS
  // para no disparar latencia/costo. Cada vuelta le pasamos lo acumulado.
  const MAX_CONSULTAS = 4;
  let datosAcumulados: Record<string, Record<string, unknown>[]> = {};
  let nConsultas = 0;
  while (
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
      `${JSON.stringify(datosAcumulados).slice(0, 12000)}\n\n` +
      `Si con estos datos ya podés responder al cliente, HACELO ahora (consultar_datos.activar=false) con los datos REALES, redactando natural. ` +
      `Si todavía te falta un dato relacionado (ej: ya tenés ids y te faltan sus títulos), activá consultar_datos OTRA VEZ con la tabla y filtros que faltan${quedan > 0 ? ` (te quedan ${quedan} consultas)` : " (es tu última consulta)"}. Si una consulta volvió vacía, NO inventes: decílo con honestidad.`;
    respuesta = await generarRespuesta(
      historial,
      promptConDatos,
      cuenta.modelo,
      { temperatura: cuenta.temperatura, max_tokens: cuenta.max_tokens },
      cuenta.id,
    );
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
  const delayPartesMs = Math.round(
    Math.max(0, Math.min(30, cuenta.delay_entre_partes_segundos ?? 3)) * 1000,
  );

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
            if (delayPartesMs > 0) await dormir(delayPartesMs);
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
          if (delayPartesMs > 0) await dormir(delayPartesMs);
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
            delayPartesMs,
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
          delayPartesMs,
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
        delayPartesMs,
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
