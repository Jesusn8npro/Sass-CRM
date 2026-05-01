import {
  getAudioDuration,
  getAudioWaveform,
  type WASocket,
  type proto,
  type WAMessage,
} from "@whiskeysockets/baileys";
import {
  insertarMensaje,
  listarBiblioteca,
  marcarConversacionNecesitaHumano,
  obtenerOCrearConversacion,
  obtenerConversacionPorId,
  obtenerHistorialReciente,
  obtenerMedioPorIdentificador,
  obtenerPendientesBandejaDeCuenta,
  obtenerCuenta,
  listarConocimientoDeCuenta,
  marcarBandejaEnviado,
  type Conversacion,
  type Cuenta,
  type FilaBandejaSalida,
  type MedioBiblioteca,
  type TipoMensaje,
} from "../baseDatos";
import { generarRespuesta, type RespuestaIA } from "../openai";
import { construirPromptSistema } from "../construirPrompt";
import {
  descargarYGuardarMedia,
  desempacarMensaje,
  detectarTipoMedia,
  guardarMediaSubido,
  rutaAbsolutaDeBiblioteca,
  rutaAbsolutaDeMedia,
  transcribirAudio,
} from "./medios";
import { generarAudioTTS } from "../elevenlabs";
import { asegurarFormatoVoz } from "./conversion";

function extraerTexto(mensaje: proto.IMessage | null | undefined): string | null {
  // Desempacar wrappers ephemeral/viewOnce/etc antes de extraer
  const inner = desempacarMensaje(mensaje);
  if (!inner) return null;
  if (inner.conversation) return inner.conversation;
  if (inner.extendedTextMessage?.text) return inner.extendedTextMessage.text;
  return null;
}

function telefonoDesdeJID(jid: string): string {
  const sinSufijo = jid.split("@")[0] ?? "";
  return sinSufijo.split(":")[0] ?? "";
}

interface ClaveMensajeExtendida {
  remoteJid?: string | null;
  remoteJidAlt?: string | null;
  senderPn?: string | null;
  fromMe?: boolean | null;
}

function resolverIdentidad(clave: ClaveMensajeExtendida): {
  jidParaEnviar: string;
  telefonoMostrable: string;
} | null {
  const remoteJid = clave.remoteJid;
  if (!remoteJid) return null;
  const jidParaEnviar = remoteJid;
  if (remoteJid.endsWith("@s.whatsapp.net")) {
    return { jidParaEnviar, telefonoMostrable: telefonoDesdeJID(remoteJid) };
  }
  const candidatos = [clave.remoteJidAlt, clave.senderPn].filter(
    (x): x is string => typeof x === "string" && x.length > 0,
  );
  for (const cand of candidatos) {
    if (cand.endsWith("@s.whatsapp.net")) {
      return { jidParaEnviar, telefonoMostrable: telefonoDesdeJID(cand) };
    }
  }
  return { jidParaEnviar, telefonoMostrable: telefonoDesdeJID(remoteJid) };
}

const timersBuffer = new Map<number, NodeJS.Timeout>();
function cancelarTimer(conversacionId: number): void {
  const t = timersBuffer.get(conversacionId);
  if (t) {
    clearTimeout(t);
    timersBuffer.delete(conversacionId);
  }
}

// ============================================================
// Tracker de IDs que enviamos nosotros (bot IA o humano vía panel).
// WhatsApp nos rebota nuestros propios envíos como messages.upsert con
// fromMe=true. Sin este tracker NO podríamos distinguir entre:
//   (a) mensaje enviado por nuestro código (ya guardado en DB)
//   (b) mensaje tipeado manualmente desde el celular conectado
// (b) sí queremos guardarlo para que aparezca en el panel como humano.
// (a) lo descartamos para no duplicar.
// ============================================================
const idsEnviadosPorBot = new Map<number, Set<string>>();
const TTL_TRACKING_MS = 10 * 60 * 1000;

export function recordarEnvioBot(
  cuentaId: number,
  msgId: string | null | undefined,
): void {
  if (!msgId) return;
  let s = idsEnviadosPorBot.get(cuentaId);
  if (!s) {
    s = new Set();
    idsEnviadosPorBot.set(cuentaId, s);
  }
  s.add(msgId);
  setTimeout(() => s.delete(msgId), TTL_TRACKING_MS);
}

function fueEnviadoPorNosotros(
  cuentaId: number,
  msgId: string | null | undefined,
): boolean {
  if (!msgId) return false;
  return !!idsEnviadosPorBot.get(cuentaId)?.has(msgId);
}

// ============================================================
// Procesar mensaje multimedia entrante (audio/imagen/video/documento)
// Devuelve el contenido en texto que se va a guardar en mensajes.contenido
// (transcripción si es audio, caption o "[imagen]" si no hay caption, etc).
// ============================================================
async function procesarMediaEntrante(
  sock: WASocket,
  msg: WAMessage,
  cuentaId: number,
  prefijo: string,
): Promise<{
  tipo: TipoMensaje;
  contenido: string;
  mediaPath: string | null;
} | null> {
  const info = detectarTipoMedia(msg);
  if (!info) return null;

  const descargado = await descargarYGuardarMedia(
    sock,
    msg,
    cuentaId,
    info.tipo,
    info.mime,
  );
  if (!descargado) {
    return {
      tipo: info.tipo,
      contenido: `[${info.tipo} no pudo descargarse]`,
      mediaPath: null,
    };
  }

  let contenido = info.caption ?? "";

  if (info.tipo === "audio") {
    console.log(`${prefijo} 🎤 transcribiendo audio (${descargado.tamano} bytes)...`);
    const inicio = Date.now();
    const texto = await transcribirAudio(descargado.rutaAbsoluta);
    const dur = Date.now() - inicio;
    if (texto) {
      console.log(`${prefijo} ✓ transcripción (${dur}ms): "${texto.slice(0, 80)}"`);
      contenido = texto;
    } else {
      contenido = "[audio sin transcripción]";
    }
  } else if (!contenido) {
    contenido =
      info.tipo === "imagen"
        ? "[imagen sin descripción]"
        : info.tipo === "video"
        ? "[video sin descripción]"
        : "[documento]";
  }

  return {
    tipo: info.tipo,
    contenido,
    mediaPath: descargado.rutaRelativa,
  };
}

// ============================================================
// Generar respuesta con IA y enviar como múltiples partes
// ============================================================
async function generarYEnviarRespuesta(
  sock: WASocket,
  cuenta: Cuenta,
  conversacion: Conversacion,
  jidParaEnviar: string,
  prefijo: string,
): Promise<void> {
  const historial = obtenerHistorialReciente(conversacion.id, 20);
  console.log(`${prefijo} llamando LLM con ${historial.length} mensajes...`);

  try {
    await sock.presenceSubscribe(jidParaEnviar);
  } catch {}
  try {
    await sock.sendPresenceUpdate("composing", jidParaEnviar);
  } catch {}

  const conocimiento = listarConocimientoDeCuenta(cuenta.id);
  const biblioteca = listarBiblioteca(cuenta.id);
  const promptCompleto = construirPromptSistema(
    cuenta,
    conocimiento,
    biblioteca,
  );

  const inicio = Date.now();
  let respuesta: RespuestaIA;
  try {
    respuesta = await generarRespuesta(
      historial,
      promptCompleto,
      cuenta.modelo,
    );
  } catch (err) {
    console.error(`${prefijo} error llamando OpenAI:`, err);
    try {
      await sock.sendPresenceUpdate("paused", jidParaEnviar);
    } catch {}
    return;
  }
  const duracion = Date.now() - inicio;
  console.log(
    `${prefijo} LLM respondió en ${duracion}ms (${respuesta.partes.length} parte${respuesta.partes.length === 1 ? "" : "s"}${respuesta.transferir_a_humano.activar ? ", HANDOFF" : ""})`,
  );

  // Modo espejo: respondemos con voz si la cuenta tiene voz_elevenlabs
  // y CUALQUIERA de los últimos 2 mensajes del usuario fue audio. Esto
  // evita el caso "el cliente mandó audio + un texto rápido aclaratorio
  // → bot debería seguir en modo audio". Más robusto que mirar solo el
  // último mensaje.
  const mensajesUsuario = historial.filter((m) => m.rol === "usuario");
  const ultimosDos = mensajesUsuario.slice(-2);
  const huboAudioReciente = ultimosDos.some((m) => m.tipo === "audio");
  const tieneVoz =
    !!cuenta.voz_elevenlabs && cuenta.voz_elevenlabs.trim().length > 0;
  const tieneApiKey = !!process.env.ELEVENLABS_API_KEY;
  const debeResponderConVoz = tieneVoz && tieneApiKey && huboAudioReciente;

  console.log(
    `${prefijo} 🔍 espejo check: voz_elevenlabs=${tieneVoz ? `"${cuenta.voz_elevenlabs!.trim().slice(0, 12)}..."` : "VACÍO"}, ELEVENLABS_API_KEY=${tieneApiKey ? "OK" : "FALTA"}, últimos 2 user=[${ultimosDos.map((m) => m.tipo).join(",") || "vacío"}], audio reciente=${huboAudioReciente} → ${debeResponderConVoz ? "RESPONDE CON VOZ" : "responde con texto"}`,
  );

  if (debeResponderConVoz) {
    console.log(
      `${prefijo} 🪞 espejo: cliente envió audio → respondemos con voz`,
    );
    const textoCompleto = respuesta.partes
      .map((p) => p.contenido.trim())
      .filter((s) => s.length > 0)
      .join("\n\n");
    if (textoCompleto) {
      try {
        // "Grabando audio..."
        try {
          await sock.sendPresenceUpdate("recording", jidParaEnviar);
        } catch {}
        const ttsInicio = Date.now();
        // En este branch debeResponderConVoz ya garantizó voz_elevenlabs no nulo
        const tts = await generarAudioTTS(
          textoCompleto,
          cuenta.voz_elevenlabs!,
        );
        const ttsDur = Date.now() - ttsInicio;
        console.log(
          `${prefijo} 🔊 audio ElevenLabs generado (${tts.buffer.length} bytes, ${ttsDur}ms)`,
        );
        const guardado = guardarMediaSubido(
          cuenta.id,
          tts.buffer,
          tts.extension,
        );

        // Convertir MP3 → OGG/Opus para que llegue como nota de voz, no como
        // archivo de audio o documento. Sin esta conversión WhatsApp puede
        // mostrarlo como "audio no disponible".
        let rutaTTS = guardado.rutaAbsoluta;
        let mediaPathTTS = guardado.rutaRelativa;
        try {
          const conv = await asegurarFormatoVoz(guardado.rutaAbsoluta);
          if (conv.nombre !== guardado.nombreArchivo) {
            rutaTTS = conv.rutaAbsoluta;
            mediaPathTTS = `${cuenta.id}/${conv.nombre}`;
            console.log(`${prefijo} 🔄 TTS convertido a OGG/Opus`);
          }
        } catch (errConv) {
          console.warn(`${prefijo} no se pudo convertir TTS:`, errConv);
        }

        insertarMensaje(
          cuenta.id,
          conversacion.id,
          "asistente",
          textoCompleto,
          { tipo: "audio", media_path: mediaPathTTS },
        );

        // Metadata para que WhatsApp lo acepte como nota de voz
        const metaTTS = await obtenerMetadataAudio(rutaTTS);
        const contenidoTTS = {
          audio: { url: rutaTTS },
          mimetype: "audio/ogg; codecs=opus",
          ptt: true,
          seconds: metaTTS.seconds,
          waveform: metaTTS.waveform,
        } as unknown as Parameters<typeof sock.sendMessage>[1];
        try {
          const enviadoTTS = await sock.sendMessage(jidParaEnviar, contenidoTTS);
          recordarEnvioBot(cuenta.id, enviadoTTS?.key?.id);
          console.log(`${prefijo} → audio enviado`);
        } catch (errEnvio) {
          console.error(`${prefijo} error enviando audio:`, errEnvio);
        } finally {
          try {
            await sock.sendPresenceUpdate("paused", jidParaEnviar);
          } catch {}
        }

        if (respuesta.transferir_a_humano.activar) {
          const razon =
            respuesta.transferir_a_humano.razon?.trim() || "Sin razón";
          console.log(`${prefijo} 🤝 HANDOFF a humano: ${razon}`);
          marcarConversacionNecesitaHumano(conversacion.id, razon);
        }
        return;
      } catch (err) {
        const detalle = err instanceof Error ? err.message : String(err);
        console.error(
          `${prefijo} error con ElevenLabs, caigo a texto:`,
          detalle,
        );
        // Insertamos un mensaje sistema visible en el panel para que el
        // usuario sepa exactamente por qué no llegó el audio.
        try {
          insertarMensaje(
            cuenta.id,
            conversacion.id,
            "sistema",
            `[ElevenLabs falló: ${detalle.slice(0, 200)}] — respondo con texto.`,
            { tipo: "sistema" },
          );
        } catch {}
        // Fallback: continuar con multi-parte de texto abajo
      }
    }
  }

  // Enviar cada parte con delays naturales. Cada parte puede ser texto
  // (mensaje normal) o media (archivo de la biblioteca de la cuenta).
  for (let i = 0; i < respuesta.partes.length; i++) {
    const parte = respuesta.partes[i]!;
    const esUltima = i === respuesta.partes.length - 1;

    if (parte.tipo === "media") {
      // Resolver media_id contra la biblioteca de la cuenta
      const idRaw = parte.media_id?.trim() ?? "";
      if (!idRaw) {
        console.warn(`${prefijo} parte media con id vacío, ignorada`);
      } else {
        const medio = obtenerMedioPorIdentificador(cuenta.id, idRaw);
        if (!medio) {
          console.warn(
            `${prefijo} parte media id="${idRaw}" no existe en biblioteca, ignorada`,
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
    } else {
      // Parte de texto
      const charsPorSegundo = 35;
      const delayMs = Math.min(
        4000,
        Math.max(800, (parte.contenido.length / charsPorSegundo) * 1000),
      );
      await dormir(delayMs);

      insertarMensaje(
        cuenta.id,
        conversacion.id,
        "asistente",
        parte.contenido,
      );
      try {
        const enviado = await sock.sendMessage(jidParaEnviar, {
          text: parte.contenido,
        });
        recordarEnvioBot(cuenta.id, enviado?.key?.id);
        console.log(
          `${prefijo} → parte ${i + 1}/${respuesta.partes.length} (texto) enviada`,
        );
      } catch (errEnvio) {
        console.error(`${prefijo} error enviando parte:`, errEnvio);
      }
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

  // Si el LLM decidió transferir a humano, ejecutar el handoff
  if (respuesta.transferir_a_humano.activar) {
    const razon =
      respuesta.transferir_a_humano.razon?.trim() || "Sin razón provista";
    console.log(`${prefijo} 🤝 HANDOFF a humano: ${razon}`);
    marcarConversacionNecesitaHumano(conversacion.id, razon);
  }
}

function dormir(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Envía un medio de la biblioteca de la cuenta como mensaje del bot.
 * Inserta también un registro en mensajes (rol=asistente) con el path
 * correcto para que el panel lo muestre en la conversación.
 */
async function enviarMedioBiblioteca(
  sock: WASocket,
  jid: string,
  medio: MedioBiblioteca,
  cuentaId: number,
  conversacionId: number,
  prefijo: string,
): Promise<void> {
  const ruta = rutaAbsolutaDeBiblioteca(medio.ruta_archivo);
  // Para que el panel muestre la imagen, copiamos el path con prefijo "biblio:"
  // como media_path. La burbuja del panel sabrá resolverlo al endpoint correcto.
  const mediaPathPanel = `biblio:${medio.ruta_archivo}`;

  // Insertar mensaje en DB para que aparezca en el panel
  insertarMensaje(cuentaId, conversacionId, "asistente", "", {
    tipo: medio.tipo,
    media_path: mediaPathPanel,
  });

  let resultado: { key?: { id?: string | null } } | undefined;
  try {
    if (medio.tipo === "imagen") {
      resultado = await sock.sendMessage(jid, {
        image: { url: ruta },
      });
    } else if (medio.tipo === "video") {
      resultado = await sock.sendMessage(jid, {
        video: { url: ruta },
      });
    } else if (medio.tipo === "audio") {
      resultado = await sock.sendMessage(jid, {
        audio: { url: ruta },
        mimetype: "audio/mpeg",
        ptt: false,
      });
    } else if (medio.tipo === "documento") {
      resultado = await sock.sendMessage(jid, {
        document: { url: ruta },
        fileName: medio.identificador,
        mimetype: "application/octet-stream",
      });
    }
    recordarEnvioBot(cuentaId, resultado?.key?.id);
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

export function registrarManejadores(
  sock: WASocket,
  cuentaId: number,
  etiquetaCuenta: string,
): void {
  const prefijo = `[bot:${etiquetaCuenta}]`;

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      try {
        const clave = msg.key as ClaveMensajeExtendida;
        const remoteJid = clave.remoteJid;
        const desdeMi = !!clave.fromMe;

        if (!remoteJid) continue;
        if (remoteJid.endsWith("@g.us")) continue;
        if (remoteJid.endsWith("@broadcast")) continue;
        if (remoteJid.endsWith("@newsletter")) continue;

        // Si el mensaje fromMe es eco de algo que enviamos nosotros
        // (bot IA o panel humano), ya está en DB. Skip para no duplicar.
        if (desdeMi && fueEnviadoPorNosotros(cuentaId, msg.key.id)) {
          continue;
        }

        const identidad = resolverIdentidad(clave);
        if (!identidad) continue;
        const { jidParaEnviar, telefonoMostrable } = identidad;
        if (!telefonoMostrable) continue;

        const cuenta = obtenerCuenta(cuentaId);
        if (!cuenta || cuenta.esta_archivada) continue;

        // ---- Procesar contenido del mensaje ----
        // Primero intentar texto plano, después media (audio/imagen/etc)
        const textoPlano = extraerTexto(msg.message);
        let tipo: TipoMensaje = "texto";
        let contenido = "";
        let mediaPath: string | null = null;

        if (textoPlano) {
          contenido = textoPlano;
        } else {
          const procesado = await procesarMediaEntrante(
            sock,
            msg,
            cuentaId,
            prefijo,
          );
          if (!procesado) {
            // Log diagnóstico: el mensaje llegó pero no detectamos
            // ni texto ni tipo de media reconocido. Probablemente
            // un tipo nuevo (sticker, contact, location, etc).
            const claves = msg.message ? Object.keys(msg.message) : [];
            console.log(
              `${prefijo}   mensaje ignorado (no es texto ni media reconocido). claves=[${claves.join(",")}]`,
            );
            continue;
          }
          tipo = procesado.tipo;
          contenido = procesado.contenido;
          mediaPath = procesado.mediaPath;
        }

        if (!contenido && !mediaPath) continue;

        const conversacion = obtenerOCrearConversacion(
          cuentaId,
          telefonoMostrable,
          msg.pushName ?? null,
          jidParaEnviar,
        );

        const previewLog =
          tipo === "texto"
            ? `"${contenido.slice(0, 80)}"`
            : `[${tipo}] ${contenido.slice(0, 60)}`;
        console.log(
          `${prefijo} ← ${conversacion.nombre ?? telefonoMostrable} (+${telefonoMostrable}): ${previewLog}`,
        );

        // Si fue enviado desde el celular conectado manualmente
        // (fromMe=true pero no es eco de un envío nuestro), lo guardamos
        // como rol=humano para que aparezca en el panel y NO disparamos
        // la IA (ya respondió la persona).
        if (desdeMi) {
          insertarMensaje(cuentaId, conversacion.id, "humano", contenido, {
            tipo,
            media_path: mediaPath,
          });
          // Cancelar cualquier timer de buffer pendiente: ya respondió un humano
          cancelarTimer(conversacion.id);
          continue;
        }

        insertarMensaje(cuentaId, conversacion.id, "usuario", contenido, {
          tipo,
          media_path: mediaPath,
        });

        const fresca = obtenerConversacionPorId(conversacion.id);
        if (!fresca || fresca.modo !== "IA") {
          console.log(
            `${prefijo} conversación ${conversacion.id} en modo HUMANO, no respondo automáticamente.`,
          );
          cancelarTimer(conversacion.id);
          continue;
        }

        // Buffering opcional
        if (cuenta.buffer_segundos > 0) {
          cancelarTimer(conversacion.id);
          const idConv = conversacion.id;
          const timer = setTimeout(async () => {
            timersBuffer.delete(idConv);
            const cuentaFresca = obtenerCuenta(cuentaId);
            if (!cuentaFresca || cuentaFresca.esta_archivada) return;
            const convFresca = obtenerConversacionPorId(idConv);
            if (!convFresca || convFresca.modo !== "IA") return;
            try {
              await generarYEnviarRespuesta(
                sock,
                cuentaFresca,
                convFresca,
                jidParaEnviar,
                prefijo,
              );
            } catch (err) {
              console.error(`${prefijo} error en respuesta diferida:`, err);
            }
          }, cuenta.buffer_segundos * 1000);
          timersBuffer.set(conversacion.id, timer);
          console.log(
            `${prefijo} buffer ${cuenta.buffer_segundos}s armado para ${conversacion.nombre ?? telefonoMostrable}`,
          );
          continue;
        }

        await generarYEnviarRespuesta(
          sock,
          cuenta,
          fresca,
          jidParaEnviar,
          prefijo,
        );
      } catch (err) {
        console.error(`${prefijo} error procesando mensaje entrante:`, err);
      }
    }
  });
}

// ============================================================
// Bandeja de salida — envía mensajes humanos / multimedia desde el panel
// ============================================================
async function enviarItemBandeja(
  sock: WASocket,
  jid: string,
  item: FilaBandejaSalida,
): Promise<void> {
  const tipo = item.tipo;
  let resultado: { key?: { id?: string | null } } | undefined;

  if (tipo === "texto" || tipo === "sistema") {
    resultado = await sock.sendMessage(jid, { text: item.contenido });
  } else if (!item.media_path) {
    // Falta la media: enviamos el contenido como texto fallback
    resultado = await sock.sendMessage(jid, {
      text: item.contenido || "[media no disponible]",
    });
  } else {
    const ruta = rutaAbsolutaDeMedia(item.media_path);
    if (tipo === "imagen") {
      resultado = await sock.sendMessage(jid, {
        image: { url: ruta },
        caption: item.contenido || undefined,
      });
    } else if (tipo === "video") {
      resultado = await sock.sendMessage(jid, {
        video: { url: ruta },
        caption: item.contenido || undefined,
      });
    } else if (tipo === "audio") {
      const ext = ruta.split(".").pop()?.toLowerCase() ?? "";
      let mimetype = "audio/ogg; codecs=opus";
      if (ext === "mp3" || ext === "mpeg") mimetype = "audio/mpeg";
      else if (ext === "m4a" || ext === "mp4") mimetype = "audio/mp4";
      else if (ext === "wav") mimetype = "audio/wav";
      else if (ext === "ogg" || ext === "opus" || ext === "webm")
        mimetype = "audio/ogg; codecs=opus";
      // Metadata crítica para que WhatsApp muestre nota de voz correctamente:
      // sin seconds + waveform aparece "este audio ya no está disponible".
      const meta = await obtenerMetadataAudio(ruta);
      // Los tipos públicos de Baileys no exponen `waveform` pero Baileys
      // sí lo procesa correctamente en runtime. Cast vía unknown.
      const contenidoAudio = {
        audio: { url: ruta },
        mimetype,
        ptt: true,
        seconds: meta.seconds,
        waveform: meta.waveform,
      } as unknown as Parameters<typeof sock.sendMessage>[1];
      resultado = await sock.sendMessage(jid, contenidoAudio);
    } else if (tipo === "documento") {
      resultado = await sock.sendMessage(jid, {
        document: { url: ruta },
        fileName: item.contenido || "documento",
        mimetype: "application/octet-stream",
      });
    } else {
      resultado = await sock.sendMessage(jid, {
        text: item.contenido || "[mensaje]",
      });
    }
  }

  recordarEnvioBot(item.cuenta_id, resultado?.key?.id);
}

export async function procesarBandejaSalidaDeCuenta(
  sock: WASocket,
  cuentaId: number,
  etiquetaCuenta: string,
): Promise<void> {
  const pendientes = obtenerPendientesBandejaDeCuenta(cuentaId, 20);
  if (pendientes.length === 0) return;

  const prefijo = `[bot:${etiquetaCuenta}]`;
  for (const item of pendientes) {
    const conv = obtenerConversacionPorId(item.conversacion_id);
    const jid = conv?.jid_wa ?? `${item.telefono}@s.whatsapp.net`;
    try {
      await enviarItemBandeja(sock, jid, item);
      marcarBandejaEnviado(item.id);
      console.log(
        `${prefijo} → ${item.tipo} humano enviado a ${item.telefono}`,
      );
    } catch (err) {
      console.error(
        `${prefijo} falló envío de bandeja ${item.id} (reintentará):`,
        err,
      );
    }
  }
}
