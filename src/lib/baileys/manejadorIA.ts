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
  type Conversacion,
  type Cuenta,
} from "../baseDatos";
import { construirPromptSistema } from "../construirPrompt";
import { generarRespuesta, type RespuestaIA } from "../openai";
import { buscarConocimientoRelevante } from "../rag/buscar";
import {
  dormir,
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
  const historial = await obtenerHistorialReciente(conversacion.id, 20);
  console.log(`${prefijo} llamando LLM con ${historial.length} mensajes...`);

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

  const promptCompleto = construirPromptSistema(
    cuenta,
    conocimiento,
    biblioteca,
    productos,
    conversacion,
    citasActivas,
    chunksRAG,
  );

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
    );
  } catch (err) {
    const detalle =
      err instanceof Error ? err.message : JSON.stringify(err);
    console.error(`${prefijo} ✗ error llamando OpenAI: ${detalle}`);
    if (detalle.includes("401") || detalle.includes("invalid_api_key")) {
      console.error(
        `${prefijo}   → OPENAI_API_KEY inválida o revocada. Verificá .env.local.`,
      );
    } else if (detalle.includes("429") || detalle.includes("quota")) {
      console.error(
        `${prefijo}   → Sin créditos en OpenAI o rate limit. Recargá saldo en https://platform.openai.com/account/billing`,
      );
    } else if (detalle.includes("model") && detalle.includes("not found")) {
      console.error(
        `${prefijo}   → Modelo "${cuenta.modelo ?? "default"}" no existe o tu cuenta no tiene acceso. Cambialo a 'gpt-4o-mini' en /configuracion → Comportamiento.`,
      );
    }
    try {
      await sock.sendPresenceUpdate("paused", jidParaEnviar);
    } catch {}
    return;
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
  // texto / audio / media (ver instrucciones en openai.ts). Ya no hay
  // "modo espejo binario" que convierta toda la respuesta a voz.
  const tieneVoz =
    !!cuenta.voz_elevenlabs && cuenta.voz_elevenlabs.trim().length > 0;
  const tieneApiKeyEleven = !!process.env.ELEVENLABS_API_KEY;
  const puedeUsarVoz = tieneVoz && tieneApiKeyEleven;

  for (let i = 0; i < respuesta.partes.length; i++) {
    const parte = respuesta.partes[i]!;
    const esUltima = i === respuesta.partes.length - 1;
    const numParte = `${i + 1}/${respuesta.partes.length}`;

    if (parte.tipo === "media") {
      const idRaw = parte.media_id?.trim() ?? "";
      if (!idRaw) {
        console.warn(`${prefijo} parte ${numParte} media con id vacío, ignorada`);
      } else {
        const medio = await obtenerMedioPorIdentificador(cuenta.id, idRaw);
        if (!medio) {
          console.warn(
            `${prefijo} parte ${numParte} media id="${idRaw}" no existe en biblioteca, ignorada`,
          );
        } else {
          await dormir(1000);
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
}
