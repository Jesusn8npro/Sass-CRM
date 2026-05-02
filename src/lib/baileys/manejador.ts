import {
  getAudioDuration,
  getAudioWaveform,
  type WASocket,
  type proto,
  type WAMessage,
} from "@whiskeysockets/baileys";
import {
  contarMensajesDeConversacion,
  crearCita,
  crearSeguimiento,
  extraerEmailsDelTexto,
  extraerTelefonosDelTexto,
  guardarContactosEmail,
  guardarContactosTelefono,
  insertarMensaje,
  listarBiblioteca,
  listarProductosActivos,
  marcarConversacionNecesitaHumano,
  obtenerOCrearConversacion,
  obtenerConversacionPorId,
  obtenerHistorialReciente,
  obtenerMedioPorIdentificador,
  obtenerPendientesBandejaDeCuenta,
  obtenerCuenta,
  obtenerProducto,
  listarConocimientoDeCuenta,
  marcarBandejaEnviado,
  registrarInteresEnProducto,
  type Conversacion,
  type Cuenta,
  type FilaBandejaSalida,
  type MedioBiblioteca,
  type TipoMensaje,
} from "../baseDatos";
import { generarRespuesta, type RespuestaIA } from "../openai";
import { construirPromptSistema } from "../construirPrompt";
import { iniciarLlamadaConContexto } from "../llamadas";
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

const timersBuffer = new Map<string, NodeJS.Timeout>();
function cancelarTimer(conversacionId: string): void {
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
const idsEnviadosPorBot = new Map<string, Set<string>>();
const TTL_TRACKING_MS = 10 * 60 * 1000;

export function recordarEnvioBot(
  cuentaId: string,
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
  cuentaId: string,
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
  cuentaId: string,
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
  const promptCompleto = construirPromptSistema(
    cuenta,
    conocimiento,
    biblioteca,
    productos,
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

  // Si el LLM detectó que el cliente preguntó por productos, registrar
  // interés (cliente_360 lo lista, dashboard lo agrega a "productos top").
  if (
    Array.isArray(respuesta.productos_de_interes) &&
    respuesta.productos_de_interes.length > 0
  ) {
    for (const idRaw of respuesta.productos_de_interes) {
      const id = typeof idRaw === "string" ? idRaw.trim() : "";
      if (!id) continue;
      const prod = await obtenerProducto(id);
      if (!prod || prod.cuenta_id !== cuenta.id) continue;
      try {
        await registrarInteresEnProducto(conversacion.id, prod.id, cuenta.id);
        console.log(
          `${prefijo} 🛍 interés registrado: producto "${prod.nombre}" (id ${prod.id})`,
        );
      } catch (err) {
        console.error(`${prefijo} error registrando interés:`, err);
      }
    }
  }

  // Si el LLM decidió transferir a humano, ejecutar el handoff
  if (respuesta.transferir_a_humano.activar) {
    const razon =
      respuesta.transferir_a_humano.razon?.trim() || "Sin razón provista";
    console.log(`${prefijo} 🤝 HANDOFF a humano: ${razon}`);
    await marcarConversacionNecesitaHumano(conversacion.id, razon);
  }

  // Si el LLM decidió iniciar una llamada Vapi, dispararla con el
  // contexto de la conversación (cooldown 1h por conversación).
  if (respuesta.iniciar_llamada?.activar) {
    const razon = respuesta.iniciar_llamada.razon?.trim() || null;
    console.log(`${prefijo} 📞 IA pide iniciar llamada: ${razon ?? "—"}`);
    try {
      const r = await iniciarLlamadaConContexto({
        cuenta,
        conversacion,
        motivo: razon,
        origen: "ia",
      });
      if (r.ok) {
        console.log(
          `${prefijo} ✓ llamada Vapi disparada por IA (call_id ${r.llamada?.vapi_call_id})`,
        );
      } else {
        console.warn(
          `${prefijo} ✗ no se inició llamada (${r.motivoBloqueo}): ${r.error}`,
        );
        // Si fue por cooldown, dejamos un mensaje sistema para que se
        // entienda en el panel por qué la IA no llamó.
        if (r.motivoBloqueo === "cooldown") {
          try {
            await insertarMensaje(
              cuenta.id,
              conversacion.id,
              "sistema",
              `[IA quiso llamar pero hay otra llamada reciente, cooldown activo]`,
              { tipo: "sistema" },
            );
          } catch {}
        }
      }
    } catch (err) {
      console.error(`${prefijo} error disparando llamada IA:`, err);
    }
  }

  // Programar seguimiento futuro si la IA lo decidió
  if (respuesta.programar_seguimiento?.activar) {
    const ps = respuesta.programar_seguimiento;
    const fecha = parseFechaIso(ps.fecha_iso);
    if (fecha === null) {
      console.warn(
        `${prefijo} ⚠ programar_seguimiento con fecha_iso inválida: "${ps.fecha_iso}"`,
      );
    } else if (!ps.contenido?.trim()) {
      console.warn(`${prefijo} ⚠ programar_seguimiento sin contenido, ignorado`);
    } else {
      try {
        const s = await crearSeguimiento(
          cuenta.id,
          conversacion.id,
          ps.contenido.trim(),
          fecha,
          "ia",
        );
        console.log(
          `${prefijo} ⏰ seguimiento ${s.id} programado para ${new Date(fecha).toISOString()}: ${ps.razon ?? ""}`,
        );
      } catch (err) {
        console.error(`${prefijo} error programando seguimiento:`, err);
      }
    }
  }

  // Agendar cita si la IA lo decidió
  if (respuesta.agendar_cita?.activar) {
    const ac = respuesta.agendar_cita;
    const fecha = parseFechaIso(ac.fecha_iso);
    if (fecha === null) {
      console.warn(
        `${prefijo} ⚠ agendar_cita con fecha_iso inválida: "${ac.fecha_iso}"`,
      );
    } else {
      try {
        const c = await crearCita(cuenta.id, {
          conversacion_id: conversacion.id,
          cliente_nombre: conversacion.nombre ?? `+${conversacion.telefono}`,
          cliente_telefono: conversacion.telefono,
          fecha_hora: fecha,
          duracion_min: ac.duracion_min > 0 ? ac.duracion_min : 30,
          tipo: ac.tipo?.trim() || null,
          notas: ac.notas?.trim() || null,
        });
        console.log(
          `${prefijo} 📅 cita ${c.id} agendada: ${new Date(fecha).toISOString()} (${ac.tipo})`,
        );
        // Mensaje sistema visible en el panel
        try {
          await insertarMensaje(
            cuenta.id,
            conversacion.id,
            "sistema",
            `📅 Cita agendada: ${ac.tipo || "(sin tipo)"} el ${new Date(fecha).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}${ac.notas ? ` — ${ac.notas}` : ""}`,
            { tipo: "sistema" },
          );
        } catch {}
      } catch (err) {
        console.error(`${prefijo} error agendando cita:`, err);
      }
    }
  }
}

function parseFechaIso(iso: string | undefined): string | null {
  if (!iso || typeof iso !== "string") return null;
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return null;
  const ahora = Date.now();
  // Solo aceptamos fechas futuras (entre 5 min y 1 año adelante)
  if (ms < ahora + 5 * 60 * 1000) return null;
  if (ms > ahora + 365 * 86400 * 1000) return null;
  return new Date(ms).toISOString();
}

function dormir(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Envía una parte de texto del bot: calcula un delay natural según
 * largo, guarda en DB y envía por Baileys. No emite presence updates
 * (eso lo hace el caller entre partes).
 */
async function enviarParteTexto(
  sock: WASocket,
  cuentaId: string,
  conversacionId: string,
  jid: string,
  contenido: string,
  prefijo: string,
  numParte: string,
): Promise<void> {
  const charsPorSegundo = 35;
  const delayMs = Math.min(
    4000,
    Math.max(800, (contenido.length / charsPorSegundo) * 1000),
  );
  await dormir(delayMs);

  await insertarMensaje(cuentaId, conversacionId, "asistente", contenido);
  try {
    const enviado = await sock.sendMessage(jid, { text: contenido });
    recordarEnvioBot(cuentaId, enviado?.key?.id);
    console.log(`${prefijo} → parte ${numParte} (texto) enviada`);
  } catch (err) {
    console.error(`${prefijo} error enviando parte ${numParte} texto:`, err);
  }
}

/**
 * Envía una parte como nota de voz: pide TTS a ElevenLabs, convierte
 * el MP3 a OGG/Opus, guarda en DB y manda por Baileys con metadata
 * (seconds + waveform) para que WhatsApp lo muestre como nota de voz.
 * Devuelve true si se envió OK, false si falló (caller hace fallback).
 */
async function enviarParteAudio(
  sock: WASocket,
  cuenta: Cuenta,
  conversacionId: string,
  jid: string,
  texto: string,
  prefijo: string,
  numParte: string,
): Promise<boolean> {
  try {
    try {
      await sock.sendPresenceUpdate("recording", jid);
    } catch {}
    const ttsInicio = Date.now();
    const tts = await generarAudioTTS(texto, cuenta.voz_elevenlabs!);
    const ttsDur = Date.now() - ttsInicio;
    console.log(
      `${prefijo} 🔊 parte ${numParte} TTS (${tts.buffer.length}b, ${ttsDur}ms)`,
    );
    const guardado = guardarMediaSubido(
      cuenta.id,
      tts.buffer,
      tts.extension,
    );

    let rutaTTS = guardado.rutaAbsoluta;
    let mediaPathTTS = guardado.rutaRelativa;
    try {
      const conv = await asegurarFormatoVoz(guardado.rutaAbsoluta);
      if (conv.nombre !== guardado.nombreArchivo) {
        rutaTTS = conv.rutaAbsoluta;
        mediaPathTTS = `${cuenta.id}/${conv.nombre}`;
      }
    } catch (errConv) {
      console.warn(`${prefijo} no se pudo convertir TTS:`, errConv);
    }

    await insertarMensaje(cuenta.id, conversacionId, "asistente", texto, {
      tipo: "audio",
      media_path: mediaPathTTS,
    });

    const meta = await obtenerMetadataAudio(rutaTTS);
    const contenidoTTS = {
      audio: { url: rutaTTS },
      mimetype: "audio/ogg; codecs=opus",
      ptt: true,
      seconds: meta.seconds,
      waveform: meta.waveform,
    } as unknown as Parameters<typeof sock.sendMessage>[1];
    const enviado = await sock.sendMessage(jid, contenidoTTS);
    recordarEnvioBot(cuenta.id, enviado?.key?.id);
    console.log(
      `${prefijo} → parte ${numParte} (audio) enviada (${meta.seconds}s)`,
    );
    return true;
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    console.error(
      `${prefijo} error parte ${numParte} audio (ElevenLabs):`,
      detalle,
    );
    try {
      await insertarMensaje(
        cuenta.id,
        conversacionId,
        "sistema",
        `[ElevenLabs falló: ${detalle.slice(0, 200)}] — fallback a texto.`,
        { tipo: "sistema" },
      );
    } catch {}
    return false;
  }
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
  cuentaId: string,
  conversacionId: string,
  prefijo: string,
): Promise<void> {
  const ruta = rutaAbsolutaDeBiblioteca(medio.ruta_archivo);
  // Para que el panel muestre la imagen, copiamos el path con prefijo "biblio:"
  // como media_path. La burbuja del panel sabrá resolverlo al endpoint correcto.
  const mediaPathPanel = `biblio:${medio.ruta_archivo}`;

  // Insertar mensaje en DB para que aparezca en el panel
  await insertarMensaje(cuentaId, conversacionId, "asistente", "", {
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
  cuentaId: string,
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

        const cuenta = await obtenerCuenta(cuentaId);
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

        const conversacion = await obtenerOCrearConversacion(
          cuentaId,
          telefonoMostrable,
          msg.pushName ?? null,
          jidParaEnviar,
        );

        // Detectar si la conversación está vacía ANTES de insertar.
        // Si es la primera vez que vemos a este contacto en nuestra DB,
        // disparamos fetch on-demand del historial para que la IA tenga
        // contexto en sus próximas respuestas.
        const eraConversacionNueva =
          (await contarMensajesDeConversacion(conversacion.id)) === 0;

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
          await insertarMensaje(cuentaId, conversacion.id, "humano", contenido, {
            tipo,
            media_path: mediaPath,
            wa_msg_id: msg.key.id ?? null,
          });
          // Cancelar cualquier timer de buffer pendiente: ya respondió un humano
          cancelarTimer(conversacion.id);
          continue;
        }

        await insertarMensaje(cuentaId, conversacion.id, "usuario", contenido, {
          tipo,
          media_path: mediaPath,
          wa_msg_id: msg.key.id ?? null,
        });

        // Conversación nueva → en background traemos los últimos 50
        // mensajes de WhatsApp de este contacto. Llegan vía
        // 'messaging-history.set' y se insertan como históricos
        // (sin disparar IA, con timestamp original).
        if (eraConversacionNueva && msg.key && msg.messageTimestamp) {
          dispararFetchHistorialContacto(
            sock,
            cuentaId,
            conversacion.id,
            msg,
            prefijo,
          );
        }

        // Extracción de emails: si el cliente tipeó un email en el mensaje
        // (texto, transcripción de audio, o caption de imagen), lo capturamos
        // en contactos_email para usar después en CRM/email marketing.
        try {
          const emails = extraerEmailsDelTexto(contenido);
          if (emails.length > 0) {
            const { nuevos, sospechosos } = await guardarContactosEmail(
              cuentaId,
              conversacion.id,
              emails,
            );
            if (nuevos > 0) {
              console.log(
                `${prefijo} 📧 ${nuevos} email(s) nuevos capturados: [${emails.join(", ")}]`,
              );
            }
            if (sospechosos.length > 0) {
              console.log(
                `${prefijo} ⚠ email(s) sospechoso(s) (revisar): [${sospechosos.join(", ")}]`,
              );
            }
          }
        } catch (err) {
          console.error(`${prefijo} error extrayendo emails:`, err);
        }

        // Extracción de teléfonos: capturamos números mencionados en
        // el mensaje (excluyendo el propio número del cliente).
        try {
          const tels = extraerTelefonosDelTexto(contenido);
          if (tels.length > 0) {
            const nuevos = await guardarContactosTelefono(
              cuentaId,
              conversacion.id,
              tels,
              telefonoMostrable,
            );
            if (nuevos > 0) {
              console.log(
                `${prefijo} 📱 ${nuevos} tel(s) nuevo(s) capturados: [${tels.join(", ")}]`,
              );
            }
          }
        } catch (err) {
          console.error(`${prefijo} error extrayendo teléfonos:`, err);
        }

        const fresca = await obtenerConversacionPorId(conversacion.id);
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
            const cuentaFresca = await obtenerCuenta(cuentaId);
            if (!cuentaFresca || cuentaFresca.esta_archivada) return;
            const convFresca = await obtenerConversacionPorId(idConv);
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

  // ============================================================
  // Historial bajo demanda: 'messaging-history.set' llega como respuesta
  // a sock.fetchMessageHistory() (o al sync inicial si syncFullHistory=true).
  // Insertamos como históricos: sin disparar IA, con timestamp original,
  // upsert por wa_msg_id para idempotencia entre reconexiones.
  // ============================================================
  sock.ev.on("messaging-history.set", async ({ messages, progress, isLatest }) => {
    if (!messages || messages.length === 0) return;
    console.log(
      `${prefijo} 📜 historial recibido: ${messages.length} msgs (progress=${progress ?? "?"}, isLatest=${isLatest ?? "?"})`,
    );
    let insertados = 0;
    for (const m of messages) {
      try {
        await procesarMensajeHistorico(m, cuentaId, prefijo);
        insertados++;
      } catch (err) {
        console.error(`${prefijo} error procesando msg histórico:`, err);
      }
    }
    if (insertados > 0) {
      console.log(`${prefijo} 📜 ${insertados} msgs históricos guardados`);
    }
  });
}

// ============================================================
// Procesa UN mensaje histórico: lo asocia a su conversación
// (creándola si no existe) y lo inserta marcado como histórico.
// NUNCA dispara IA ni encola respuesta.
// ============================================================
async function procesarMensajeHistorico(
  m: WAMessage,
  cuentaId: string,
  prefijo: string,
): Promise<void> {
  const remoteJid = m.key?.remoteJid;
  if (!remoteJid || !m.key?.id) return;
  if (remoteJid.endsWith("@g.us")) return;
  if (remoteJid.endsWith("@broadcast")) return;
  if (remoteJid.endsWith("@newsletter")) return;

  // Timestamp original del mensaje (Long o number, en segundos).
  const tsRaw = m.messageTimestamp;
  if (!tsRaw) return;
  const tsNum = typeof tsRaw === "number" ? tsRaw : Number(tsRaw);
  if (!Number.isFinite(tsNum) || tsNum <= 0) return;
  const creadoEn = new Date(tsNum * 1000).toISOString();

  // Identidad / teléfono
  const sinSufijo = remoteJid.split("@")[0] ?? "";
  const telefono = sinSufijo.split(":")[0] ?? "";
  if (!telefono) return;

  // Texto + tipo (sin descargar media — claves E2E suelen estar expiradas)
  const textoPlano = extraerTexto(m.message);
  const infoMedia = !textoPlano ? detectarTipoMedia(m) : null;
  let tipo: TipoMensaje = "texto";
  let contenido = "";
  if (textoPlano) {
    contenido = textoPlano;
  } else if (infoMedia) {
    tipo = infoMedia.tipo;
    contenido = infoMedia.caption?.trim() || `[${infoMedia.tipo} histórico]`;
  } else {
    return; // sin contenido reconocible
  }

  // Conversación (si no existe la creamos para que el panel la muestre)
  const conv = await obtenerOCrearConversacion(
    cuentaId,
    telefono,
    m.pushName ?? null,
    remoteJid,
  );

  const rol = m.key.fromMe ? "humano" : "usuario";
  await insertarMensaje(cuentaId, conv.id, rol, contenido, {
    tipo,
    media_path: null, // media histórica no la bajamos
    wa_msg_id: m.key.id,
    creado_en: creadoEn,
    es_historico: true,
  });
  // Sin extracción de emails/teléfonos para no spamear logs.
  void prefijo;
}

// ============================================================
// Dispara fetchMessageHistory para una conversación específica.
// Pide los 50 mensajes anteriores al que acabamos de recibir.
// La respuesta llega async vía 'messaging-history.set'.
// ============================================================
function dispararFetchHistorialContacto(
  sock: WASocket,
  cuentaId: string,
  conversacionId: string,
  msgPivote: WAMessage,
  prefijo: string,
): void {
  void cuentaId;
  void conversacionId;
  if (!msgPivote.key || !msgPivote.messageTimestamp) return;
  const ts = msgPivote.messageTimestamp;
  const tsNum = typeof ts === "number" ? ts : Number(ts);
  if (!Number.isFinite(tsNum)) return;

  // Background — no bloqueamos el procesamiento del mensaje real.
  void (async () => {
    try {
      const reqId = await sock.fetchMessageHistory(50, msgPivote.key, ts);
      console.log(
        `${prefijo} 📜 pidiendo historial on-demand para nueva conv (req ${reqId})`,
      );
    } catch (err) {
      console.warn(`${prefijo} fetchMessageHistory falló (no es crítico):`, err);
    }
  })();
}

/**
 * Pide más historial de una conversación específica desde el mensaje
 * más viejo que tenemos. Llamado desde la API cuando el usuario clickea
 * "Cargar mensajes anteriores" en el panel.
 *
 * Devuelve el reqId de Baileys (los mensajes llegan async via
 * 'messaging-history.set' y se guardan vía procesarMensajeHistorico).
 */
export async function pedirMasHistorialConversacion(
  sock: WASocket,
  msgMasViejoKey: { id: string; remoteJid: string; fromMe: boolean },
  msgMasViejoTimestampIso: string,
  cantidad = 50,
): Promise<string> {
  const ts = Math.floor(new Date(msgMasViejoTimestampIso).getTime() / 1000);
  return await sock.fetchMessageHistory(
    Math.min(50, Math.max(1, cantidad)),
    msgMasViejoKey as WAMessage["key"],
    ts,
  );
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
      await enviarItemBandeja(sock, jid, item);
      await marcarBandejaEnviado(item.id);
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
