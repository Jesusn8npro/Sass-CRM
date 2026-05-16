/**
 * Funciones de envío del bot Baileys:
 * - parseFechaIso, dormir (helpers)
 * - enviarParteTexto, enviarParteAudio, enviarMedioBiblioteca (respuesta IA)
 * - obtenerMetadataAudio (audio metadata)
 * - enviarItemBandeja, procesarBandejaSalidaDeCuenta (outbox del panel humano)
 *
 * Cada send obtiene el sock fresco del gestor antes de enviar — el sock
 * que llega por parámetro pudo morir mientras la IA pensaba (code 440).
 */
import {
  generateMessageIDV2,
  getAudioDuration,
  getAudioWaveform,
  type WASocket,
} from "@whiskeysockets/baileys";
import { readFile as fsReadFileAsync } from "node:fs/promises";
import { obtenerGestor } from "./gestor";
import {
  incrementarIntentosBandeja,
  insertarMensaje,
  marcarBandejaEnviado,
  marcarBandejaFallido,
  obtenerConversacionPorId,
  obtenerPendientesBandejaDeCuenta,
  vincularEcoHumanoReciente,
  type Cuenta,
  type FilaBandejaSalida,
  type MedioBiblioteca,
  type Producto,
} from "../baseDatos";
import { generarAudioTTS } from "../elevenlabs";
import { asegurarFormatoVoz } from "./conversion";
import {
  borrarTemporal,
  descargarBiblioteca,
  descargarMediaChat,
  descargarProductoImagen,
  escribirTemporal,
  guardarMediaSubido,
} from "./medios";
import { recordarEnvioBot } from "./manejador";

/**
 * Pre-genera un msgId Y lo registra como "enviado por nosotros" ANTES
 * del sendMessage. Sin esto hay race: WhatsApp emite el echo via
 * messages.upsert antes que sock.sendMessage resuelva, y el handler
 * lo trata como "el operador respondió desde el celular" → duplica
 * el mensaje y dispara auto-handoff falso.
 */
function reservarMsgId(
  sock: WASocket,
  cuentaId: string,
  conversacionId: string | null = null,
): string {
  const msgId = generateMessageIDV2(sock.user?.id);
  recordarEnvioBot(cuentaId, msgId, conversacionId);
  return msgId;
}

export function parseFechaIso(iso: string | undefined): string | null {
  if (!iso || typeof iso !== "string") return null;
  let ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return null;
  const ahora = Date.now();
  const limiteFuturo = ahora + 365 * 86400 * 1000;
  const limiteMin = ahora + 5 * 60 * 1000;

  // [v2] Auto-corrección agresiva: si la IA mandó una fecha pasada
  // (típico bug por training cutoff donde asume año 2024), la rescatamos
  // moviendo el año al actual; si sigue pasada, al próximo año. Es
  // tolerante: corrige UN AÑO A LA VEZ hasta encontrar una fecha futura
  // dentro del rango (evita loops si la IA mandó algo absurdo como año 1).
  if (ms < limiteMin) {
    console.log(
      `[parseFechaIso] ⚠ fecha pasada recibida: "${iso}" — intentando auto-corregir...`,
    );
    const d = new Date(iso);
    if (Number.isFinite(d.getTime())) {
      const añoActual = new Date().getFullYear();
      // Probamos año actual, próximo, +2... hasta caer en rango futuro
      // dentro de 365 días o agotar 3 intentos.
      for (let delta = 0; delta <= 2; delta++) {
        const intento = new Date(d);
        intento.setFullYear(añoActual + delta);
        if (
          intento.getTime() >= limiteMin &&
          intento.getTime() <= limiteFuturo
        ) {
          console.log(
            `[parseFechaIso] ✓ auto-corregido: "${iso}" → "${intento.toISOString()}" (año ${añoActual + delta})`,
          );
          ms = intento.getTime();
          break;
        }
      }
    }
    if (ms < limiteMin) {
      console.warn(
        `[parseFechaIso] ✗ no se pudo auto-corregir "${iso}" — fuera de rango incluso ajustando año`,
      );
    }
  }

  // Validación final
  if (ms < limiteMin) return null;
  if (ms > limiteFuturo) return null;
  return new Date(ms).toISOString();
}

export function dormir(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Envía una parte de texto del bot: espera el delay configurado por
 * la cuenta (durante ese tiempo el "escribiendo..." sigue visible
 * porque el caller emite presence='composing' antes), guarda en DB
 * y envía por Baileys.
 *
 * `delayMs` viene del manejadorIA, que lo calcula a partir de
 * `cuenta.delay_entre_partes_segundos`. Pasarlo por argumento (en vez
 * de leer la cuenta acá) deja a esta función libre de fetchs y
 * mantiene la lógica de configuración en un solo lugar.
 */
export async function enviarParteTexto(
  sock: WASocket,
  cuentaId: string,
  conversacionId: string,
  jid: string,
  contenido: string,
  prefijo: string,
  numParte: string,
  delayMs: number,
): Promise<void> {
  if (delayMs > 0) await dormir(delayMs);

  // El sock que llegó por parámetro pudo haberse cerrado mientras la
  // IA pensaba (code 440 reconecta y deja un sock nuevo en el gestor).
  // Tomamos siempre el actual; sólo si no hay caemos al original.
  const sockActual = obtenerGestor().obtenerSocket(cuentaId) ?? sock;
  try {
    const msgId = reservarMsgId(sockActual, cuentaId, conversacionId);
    await enviarTextoConRetry(
      sockActual,
      cuentaId,
      jid,
      contenido,
      msgId,
      prefijo,
    );
    // Insertamos en DB DESPUÉS del envío para que el panel no muestre
    // mensajes que el cliente nunca recibió (caso conexión muerta).
    await insertarMensaje(cuentaId, conversacionId, "asistente", contenido, {
      wa_msg_id: msgId,
    });
    console.log(`${prefijo} → parte ${numParte} (texto) enviada`);
  } catch (err) {
    console.error(
      `${prefijo} error enviando parte ${numParte} texto (tras retry):`,
      err instanceof Error ? err.message : String(err),
    );
    try {
      const { registrarEvento } = await import("../db/eventosLog");
      registrarEvento({
        cuentaId,
        nivel: "error",
        contexto: "baileys.envio.texto",
        mensaje: `Falla al enviar parte ${numParte} (tras retry): ${err instanceof Error ? err.message : String(err)}`,
        metadata: { conversacionId, numParte },
      });
    } catch {
      /* ignorar */
    }
  }
}

/**
 * Envía un texto via sock.sendMessage con retry de 1 intento si la
 * primera vez devuelve "Connection Closed" / 428 / 440. Refresca el
 * sock del gestor antes del retry — si Baileys reconectó después del
 * primer intento, el sock viejo del closure ya no sirve.
 */
async function enviarTextoConRetry(
  sock: WASocket,
  cuentaId: string,
  jid: string,
  contenido: string,
  msgId: string,
  prefijo: string,
): Promise<void> {
  try {
    await sock.sendMessage(jid, { text: contenido }, { messageId: msgId });
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    const conexionCerrada =
      detalle.includes("Connection Closed") ||
      detalle.includes("Precondition Required") ||
      detalle.includes("428") ||
      detalle.includes("Timed Out") ||
      detalle.includes("440");
    if (!conexionCerrada) throw err;

    // 4s delay del gestor + 2s extra para handshake del nuevo sock.
    await dormir(6000);
    const sockFresco = obtenerGestor().obtenerSocket(cuentaId);
    if (!sockFresco) throw err;
    console.log(
      `${prefijo} ↻ retry texto tras "Connection Closed" con sock fresco`,
    );
    await sockFresco.sendMessage(jid, { text: contenido }, { messageId: msgId });
  }
}

/**
 * Envía una parte como nota de voz: pide TTS a ElevenLabs, convierte
 * el MP3 a OGG/Opus, guarda en DB y manda por Baileys con metadata
 * (seconds + waveform) para que WhatsApp lo muestre como nota de voz.
 * Devuelve true si se envió OK, false si falló (caller hace fallback).
 */
export async function enviarParteAudio(
  sock: WASocket,
  cuenta: Cuenta,
  conversacionId: string,
  jid: string,
  texto: string,
  prefijo: string,
  numParte: string,
  delayMs: number,
): Promise<boolean> {
  let archivoTempEntrada: string | null = null;
  let archivoTempSalida: string | null = null;
  try {
    if (delayMs > 0) await dormir(delayMs);
    try {
      await sock.sendPresenceUpdate("recording", jid);
    } catch {}
    const ttsInicio = Date.now();
    // Retry 1 vez si ElevenLabs falla con error de red transitorio
    // (Connection Closed, ECONNRESET, timeout). Con backoff de 800ms.
    let tts;
    try {
      tts = await generarAudioTTS(texto, cuenta.voz_elevenlabs!, cuenta.id);
    } catch (err) {
      const detalle = err instanceof Error ? err.message : String(err);
      const transient =
        detalle.includes("Connection Closed") ||
        detalle.includes("ECONNRESET") ||
        detalle.includes("ETIMEDOUT") ||
        detalle.includes("fetch failed") ||
        detalle.includes("socket hang up") ||
        detalle.includes("Timed Out");
      if (!transient) throw err;
      console.warn(
        `${prefijo} ⚠ ElevenLabs falló (${detalle.slice(0, 80)}) — retry en 800ms`,
      );
      await dormir(800);
      tts = await generarAudioTTS(texto, cuenta.voz_elevenlabs!, cuenta.id);
    }
    const ttsDur = Date.now() - ttsInicio;
    console.log(
      `${prefijo} 🔊 parte ${numParte} TTS (${tts.buffer.length}b, ${ttsDur}ms)`,
    );

    // Para correr ffmpeg necesitamos un archivo real en disco.
    // Lo escribimos en os.tmpdir(), procesamos, y subimos el
    // resultado a Storage (bucket media-chats).
    archivoTempEntrada = escribirTemporal(tts.buffer, tts.extension);
    let rutaParaMeta = archivoTempEntrada;
    let bufferFinal = tts.buffer;
    let extFinal = tts.extension;
    try {
      const conv = await asegurarFormatoVoz(archivoTempEntrada);
      if (conv.rutaAbsoluta !== archivoTempEntrada) {
        archivoTempSalida = conv.rutaAbsoluta;
        rutaParaMeta = conv.rutaAbsoluta;
        bufferFinal = await fsReadFileAsync(conv.rutaAbsoluta);
        extFinal = conv.nombre.split(".").pop() ?? extFinal;
      }
    } catch (errConv) {
      console.warn(`${prefijo} no se pudo convertir TTS:`, errConv);
    }

    const guardado = await guardarMediaSubido(cuenta.id, bufferFinal, extFinal);
    const mediaPathTTS = guardado.rutaRelativa;

    const meta = await obtenerMetadataAudio(rutaParaMeta);
    const contenidoTTS = {
      audio: bufferFinal,
      mimetype: "audio/ogg; codecs=opus",
      ptt: true,
      seconds: meta.seconds,
      waveform: meta.waveform,
    } as unknown as Parameters<typeof sock.sendMessage>[1];

    // Sock fresco del gestor — el del closure pudo morir mientras TTS.
    let sockActual = obtenerGestor().obtenerSocket(cuenta.id) ?? sock;
    let msgId = reservarMsgId(sockActual, cuenta.id, conversacionId);

    // Retry sobre sock.sendMessage si "Connection Closed" / 440 / 428.
    // El TTS ya gastó plata en ElevenLabs, no queremos perderlo.
    try {
      await sockActual.sendMessage(jid, contenidoTTS, { messageId: msgId });
    } catch (err) {
      const detalle = err instanceof Error ? err.message : String(err);
      const conexionCerrada =
        detalle.includes("Connection Closed") ||
        detalle.includes("Precondition Required") ||
        detalle.includes("428") ||
        detalle.includes("440") ||
        detalle.includes("Timed Out");
      if (!conexionCerrada) throw err;

      console.warn(
        `${prefijo} ⚠ envío audio falló por "${detalle.slice(0, 60)}" — esperando 6s a reconexión y retry`,
      );
      // 4s delay del gestor + 2s extra para handshake = 6s total.
      await dormir(6000);
      const sockFresco = obtenerGestor().obtenerSocket(cuenta.id);
      if (!sockFresco) {
        console.error(
          `${prefijo} sin sock fresco tras esperar — cae a texto`,
        );
        return false;
      }
      sockActual = sockFresco;
      // Generar msgId nuevo asociado al sock nuevo
      msgId = reservarMsgId(sockActual, cuenta.id, conversacionId);
      try {
        await sockActual.sendMessage(jid, contenidoTTS, { messageId: msgId });
        console.log(`${prefijo} ↻ retry audio OK con sock fresco`);
      } catch (err2) {
        const detalle2 = err2 instanceof Error ? err2.message : String(err2);
        console.error(
          `${prefijo} retry audio tambien fallo: ${detalle2.slice(0, 100)} — cae a texto`,
        );
        return false;
      }
    }

    // Insertar después del send para no desincronizar panel con WhatsApp.
    await insertarMensaje(cuenta.id, conversacionId, "asistente", texto, {
      tipo: "audio",
      media_path: mediaPathTTS,
      wa_msg_id: msgId,
    });
    console.log(
      `${prefijo} → parte ${numParte} (audio) enviada (${meta.seconds}s)`,
    );
    return true;
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    // El error puede venir de ElevenLabs O de Baileys (sock.sendMessage).
    // Logueamos sin atribuir mal — el caller ya hace fallback a texto.
    console.error(
      `${prefijo} error parte ${numParte} audio: ${detalle.slice(0, 200)}`,
    );
    try {
      const { registrarEvento } = await import("../db/eventosLog");
      registrarEvento({
        cuentaId: cuenta.id,
        nivel: "error",
        contexto: "baileys.envio.audio",
        mensaje: `Falla al enviar parte ${numParte} audio (TTS o Baileys): ${detalle.slice(0, 400)}`,
        metadata: { conversacionId, numParte },
      });
    } catch {
      /* ignorar */
    }
    return false;
  } finally {
    if (archivoTempEntrada) borrarTemporal(archivoTempEntrada);
    if (archivoTempSalida) borrarTemporal(archivoTempSalida);
  }
}

/**
 * Envía un medio de la biblioteca de la cuenta como mensaje del bot.
 * Inserta también un registro en mensajes (rol=asistente) con el path
 * correcto para que el panel lo muestre en la conversación.
 */
export async function enviarMedioBiblioteca(
  sock: WASocket,
  jid: string,
  medio: MedioBiblioteca,
  cuentaId: string,
  conversacionId: string,
  prefijo: string,
): Promise<void> {
  // Para que el panel muestre el medio, guardamos el path con prefijo
  // "biblio:" como media_path. La burbuja del panel lo resuelve a
  // /api/biblioteca/<idCuenta>/<archivo>.
  const mediaPathPanel = `biblio:${medio.ruta_archivo}`;

  // Descargamos el contenido de Storage y se lo pasamos a Baileys como
  // Buffer en vez de URL — más portable entre instancias del bot.
  const descargado = await descargarBiblioteca(medio.ruta_archivo);
  if (!descargado) {
    console.error(
      `${prefijo} medio biblioteca ${medio.identificador} no existe en Storage`,
    );
    return;
  }
  const { buffer } = descargado;

  // Sock fresco del gestor — el del closure pudo cerrarse.
  const sockActual = obtenerGestor().obtenerSocket(cuentaId) ?? sock;
  try {
    const msgId = reservarMsgId(sockActual, cuentaId, conversacionId);
    const opts = { messageId: msgId };
    if (medio.tipo === "imagen") {
      await sockActual.sendMessage(jid, { image: buffer }, opts);
    } else if (medio.tipo === "video") {
      await sockActual.sendMessage(jid, { video: buffer }, opts);
    } else if (medio.tipo === "audio") {
      await sockActual.sendMessage(
        jid,
        { audio: buffer, mimetype: "audio/mpeg", ptt: false },
        opts,
      );
    } else if (medio.tipo === "documento") {
      await sockActual.sendMessage(
        jid,
        {
          document: buffer,
          fileName: medio.identificador,
          mimetype: "application/octet-stream",
        },
        opts,
      );
    }
    // Insertar tras el send para no desincronizar panel con WhatsApp.
    await insertarMensaje(cuentaId, conversacionId, "asistente", "", {
      tipo: medio.tipo,
      media_path: mediaPathPanel,
      wa_msg_id: msgId,
    });
    console.log(
      `${prefijo} → biblioteca:${medio.identificador} (${medio.tipo}) enviado`,
    );
  } catch (err) {
    console.error(
      `${prefijo} error enviando medio biblioteca ${medio.identificador}:`,
      err,
    );
  }
}

/**
 * Obtiene metadata necesaria para que WhatsApp acepte un audio como nota
 * de voz. Sin estos campos, las versiones nuevas de WhatsApp / Baileys 6.7.9+
 * muestran "este audio ya no está disponible" al recipiente.
 */
async function obtenerMetadataAudio(
  rutaArchivo: string,
): Promise<{ seconds: number; waveform: Uint8Array | undefined }> {
  let seconds = 1;
  let waveform: Uint8Array | undefined;
  try {
    const dur = await getAudioDuration(rutaArchivo);
    if (typeof dur === "number" && dur > 0) seconds = Math.round(dur);
  } catch (err) {
    console.warn("[audio] no se pudo obtener duración:", err);
  }
  try {
    waveform = await getAudioWaveform(rutaArchivo);
  } catch (err) {
    console.warn("[audio] no se pudo obtener waveform:", err);
  }
  return { seconds, waveform };
}
/**
 * Envía la foto de un producto al cliente. Resuelve la imagen así:
 *   1) Si el producto tiene `imagen_url_externa` no vacía → fetch del
 *      buffer (timeout 8s, max 8MB) y se envía como image. media_path
 *      en DB queda como `url:<URL>` para que el panel la renderice
 *      directo desde el origen externo.
 *   2) Sino, si tiene `imagen_path` → descarga del bucket `productos`
 *      y se envía. media_path en DB queda como el path interno (sin
 *      prefijo) — `BurbujaMensaje` lo resuelve via `/api/media/...`.
 *      // NOTA: la ruta interna de productos hoy se sirve via
 *      //       /api/productos/<path> en el modal. La burbuja apunta
 *      //       a /api/media/<idCuenta>/<archivo>; si la convención no
 *      //       matchea, el panel mostrará el alt — lo importante es
 *      //       que el cliente reciba la imagen por WhatsApp.
 *   3) Si no tiene foto → no-op (warning).
 *
 * Errores de red en URL externa → log y skip silencioso (no romper
 * el flujo de la respuesta IA).
 */
export async function enviarFotoProducto(
  sock: WASocket,
  jid: string,
  cuentaId: string,
  conversacionId: string,
  producto: Producto,
  prefijo: string,
): Promise<void> {
  const urlExterna = producto.imagen_url_externa?.trim() ?? "";
  const pathInterno = producto.imagen_path?.trim() ?? "";

  let buffer: Buffer | null = null;
  let mediaPathPanel: string | null = null;

  if (urlExterna) {
    // Validamos protocolo http/https (no file:// ni rutas privadas)
    if (!/^https?:\/\//i.test(urlExterna)) {
      console.warn(
        `${prefijo} foto producto ${producto.id}: URL externa con protocolo inválido, ignorada`,
      );
      return;
    }
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(urlExterna, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) {
        console.warn(
          `${prefijo} foto producto ${producto.id}: HTTP ${res.status} fetcheando ${urlExterna}`,
        );
        return;
      }
      const ab = await res.arrayBuffer();
      if (ab.byteLength > 8 * 1024 * 1024) {
        console.warn(
          `${prefijo} foto producto ${producto.id}: imagen externa pesa ${ab.byteLength}b > 8MB, skip`,
        );
        return;
      }
      buffer = Buffer.from(ab);
      mediaPathPanel = `url:${urlExterna}`;
    } catch (err) {
      const detalle = err instanceof Error ? err.message : String(err);
      console.warn(
        `${prefijo} foto producto ${producto.id}: error fetcheando URL externa: ${detalle.slice(0, 100)}`,
      );
      return;
    }
  } else if (pathInterno) {
    const desc = await descargarProductoImagen(pathInterno);
    if (!desc) {
      console.warn(
        `${prefijo} foto producto ${producto.id}: imagen_path "${pathInterno}" no existe en bucket`,
      );
      return;
    }
    buffer = desc.buffer;
    mediaPathPanel = pathInterno;
  } else {
    console.warn(
      `${prefijo} foto producto ${producto.id}: sin imagen disponible (skip)`,
    );
    return;
  }

  const sockActual = obtenerGestor().obtenerSocket(cuentaId) ?? sock;
  try {
    const msgId = reservarMsgId(sockActual, cuentaId, conversacionId);
    await sockActual.sendMessage(jid, { image: buffer }, { messageId: msgId });
    await insertarMensaje(cuentaId, conversacionId, "asistente", "", {
      tipo: "imagen",
      media_path: mediaPathPanel,
      wa_msg_id: msgId,
    });
    console.log(
      `${prefijo} → foto producto "${producto.nombre}" (id ${producto.id}) enviada`,
    );
  } catch (err) {
    console.error(
      `${prefijo} error enviando foto producto ${producto.id}:`,
      err instanceof Error ? err.message : String(err),
    );
  }
}

// Bandeja de salida — envía mensajes humanos / multimedia desde el panel
// ============================================================
async function enviarItemBandeja(
  sock: WASocket,
  jid: string,
  item: FilaBandejaSalida,
): Promise<string> {
  const tipo = item.tipo;
  // Pre-generamos el msgId y lo registramos como envío nuestro ANTES de
  // sendMessage. Sin esto, el echo via messages.upsert llega antes que
  // recordarEnvioBot y se duplica el mensaje en el panel.
  const msgId = reservarMsgId(sock, item.cuenta_id, item.conversacion_id);
  const opts = { messageId: msgId };

  if (tipo === "texto" || tipo === "sistema") {
    await sock.sendMessage(jid, { text: item.contenido }, opts);
  } else if (!item.media_path) {
    // Falta la media: enviamos el contenido como texto fallback
    await sock.sendMessage(
      jid,
      { text: item.contenido || "[media no disponible]" },
      opts,
    );
  } else {
    const descargado = await descargarMediaChat(item.media_path);
    if (!descargado) {
      console.error(
        `[bandeja] media ${item.media_path} no encontrada en Storage ni local — enviando texto fallback`,
      );
      await sock.sendMessage(
        jid,
        { text: item.contenido || "[media no disponible]" },
        opts,
      );
    } else {
      const { buffer } = descargado;
      const nombreArchivo = item.media_path.split("/").pop() ?? "";
      const ext = nombreArchivo.split(".").pop()?.toLowerCase() ?? "";

      if (tipo === "imagen") {
        await sock.sendMessage(
          jid,
          { image: buffer, caption: item.contenido || undefined },
          opts,
        );
      } else if (tipo === "video") {
        await sock.sendMessage(
          jid,
          { video: buffer, caption: item.contenido || undefined },
          opts,
        );
      } else if (tipo === "audio") {
        // WhatsApp sólo acepta nota de voz (ptt) en OGG/Opus. Si el
        // archivo no es .ogg, lo convertimos en este momento — si falla,
        // mandamos como audio normal (ptt:false) con su mime real para
        // que al menos el receptor pueda reproducirlo.
        let bufferEnvio = buffer;
        let extEnvio = ext;
        const tmpEntrada = escribirTemporal(buffer, ext || "bin");
        let tmpSalida: string | null = null;
        try {
          if (extEnvio !== "ogg") {
            const conv = await asegurarFormatoVoz(tmpEntrada);
            if (conv.rutaAbsoluta !== tmpEntrada) {
              tmpSalida = conv.rutaAbsoluta;
              bufferEnvio = await fsReadFileAsync(conv.rutaAbsoluta);
              extEnvio = conv.nombre.split(".").pop() ?? extEnvio;
            }
          }

          const esOgg = extEnvio === "ogg";
          let mimetype = "audio/ogg; codecs=opus";
          if (extEnvio === "mp3" || extEnvio === "mpeg") mimetype = "audio/mpeg";
          else if (extEnvio === "m4a" || extEnvio === "mp4") mimetype = "audio/mp4";
          else if (extEnvio === "wav") mimetype = "audio/wav";
          else if (extEnvio === "webm") mimetype = "audio/webm; codecs=opus";

          const rutaParaMeta = tmpSalida ?? tmpEntrada;
          const meta = await obtenerMetadataAudio(rutaParaMeta);

          const contenidoAudio = {
            audio: bufferEnvio,
            mimetype,
            // ptt sólo si realmente es OGG/Opus — si no, WhatsApp muestra
            // "este audio ya no está disponible" al receptor.
            ptt: esOgg,
            seconds: meta.seconds,
            waveform: esOgg ? meta.waveform : undefined,
          } as unknown as Parameters<typeof sock.sendMessage>[1];
          await sock.sendMessage(jid, contenidoAudio, opts);
        } finally {
          borrarTemporal(tmpEntrada);
          if (tmpSalida) borrarTemporal(tmpSalida);
        }
      } else if (tipo === "documento") {
        await sock.sendMessage(
          jid,
          {
            document: buffer,
            fileName: item.contenido || nombreArchivo || "documento",
            mimetype: "application/octet-stream",
          },
          opts,
        );
      } else {
        await sock.sendMessage(
          jid,
          { text: item.contenido || "[mensaje]" },
          opts,
        );
      }
    }
  }

  return msgId;
}

const MAX_INTENTOS_BANDEJA = 3;

/** Detecta errores de conexión cerrada de WhatsApp (Baileys 428). */
function esErrorConexion(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("Connection Closed") ||
    msg.includes("Precondition Required") ||
    msg.includes("Connection Terminated") ||
    msg.includes("Stream Errored")
  );
}

export async function procesarBandejaSalidaDeCuenta(
  sock: WASocket,
  cuentaId: string,
  etiquetaCuenta: string,
): Promise<void> {
  const pendientes = await obtenerPendientesBandejaDeCuenta(cuentaId, 20);
  if (pendientes.length === 0) return;

  const prefijo = `[bot:${etiquetaCuenta}]`;

  for (const item of pendientes) {
    const conv = await obtenerConversacionPorId(item.conversacion_id);
    const jid = conv?.jid_wa ?? `${item.telefono}@s.whatsapp.net`;
    try {
      const msgId = await enviarItemBandeja(sock, jid, item);
      await marcarBandejaEnviado(item.id);
      try {
        await vincularEcoHumanoReciente(
          item.cuenta_id,
          item.conversacion_id,
          msgId,
          item.contenido,
          item.media_path,
        );
      } catch {
        /* no-op: si falla, el dedup en handler del echo lo agarra */
      }
      console.log(`${prefijo} → ${item.tipo} humano enviado a ${item.telefono}`);
    } catch (err) {
      const intentosAhora = (item.intentos ?? 0) + 1;

      if (esErrorConexion(err)) {
        // Conexión cerrada: marcar fallido y PARAR — no tiene sentido seguir
        // intentando con los demás items de esta cuenta en este ciclo.
        await marcarBandejaFallido(item.id).catch(() => null);
        console.warn(
          `${prefijo} conexión cerrada — item ${item.id} descartado. ` +
          `Reencolar manualmente o esperar reconexión.`,
        );
        break;
      }

      if (intentosAhora >= MAX_INTENTOS_BANDEJA) {
        // Agotó reintentos: marcar como fallido definitivamente
        await marcarBandejaFallido(item.id).catch(() => null);
        console.error(
          `${prefijo} bandeja ${item.id} falló ${intentosAhora} veces — descartado.`,
          err instanceof Error ? err.message : err,
        );
      } else {
        // Primer o segundo intento: solo incrementar y loguear una vez
        await incrementarIntentosBandeja(item.id, item.intentos ?? 0).catch(() => null);
        if (intentosAhora === 1) {
          console.warn(
            `${prefijo} falló envío de bandeja ${item.id} (intento ${intentosAhora}/${MAX_INTENTOS_BANDEJA}):`,
            err instanceof Error ? err.message : err,
          );
        }
      }
    }
  }
}
