import {
  type WASocket,
  type proto,
} from "@whiskeysockets/baileys";
import {
  actualizarJidWaConversacion,
  cambiarModo,
  contarMensajesDeConversacion,
  extraerEmailsDelTexto,
  extraerTelefonosDelTexto,
  guardarContactosEmail,
  guardarContactosTelefono,
  insertarMensaje,
  marcarConversacionNecesitaHumano,
  obtenerConversacionPorJid,
  obtenerOCrearConversacion,
  obtenerConversacionPorId,
  obtenerCuenta,
  resetearPasoAutoSeguimiento,
  vincularEcoHumanoReciente,
  type Conversacion,
  type TipoMensaje,
} from "../baseDatos";
import { dispararWebhook } from "../webhooks";
import {
  dispararFetchHistorialContacto,
  procesarMensajeHistorico,
} from "./manejadorHistorial";
import { generarYEnviarRespuesta } from "./manejadorIA";
export { procesarBandejaSalidaDeCuenta } from "./manejadorEnvio";
export { pedirMasHistorialConversacion } from "./manejadorHistorial";
import { desempacarMensaje } from "./medios";
import { procesarMediaEntrante } from "./manejadorMedia";

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
  const desdeMi = !!clave.fromMe;

  if (remoteJid.endsWith("@s.whatsapp.net")) {
    return { jidParaEnviar, telefonoMostrable: telefonoDesdeJID(remoteJid) };
  }

  // Para @lid: senderPn es del SENDER, no del CHAT. En DM con fromMe=true
  // el sender soy yo (el dueño del cel conectado) → senderPn es MI número,
  // NO el del contacto. Si lo usáramos, crearíamos una conversación falsa
  // con nuestro propio teléfono. Por eso ignoramos senderPn cuando fromMe.
  // remoteJidAlt en cambio sí apunta al chat (al contacto), así que lo
  // chequeamos primero.
  const candidatos: string[] = [];
  if (typeof clave.remoteJidAlt === "string" && clave.remoteJidAlt.length > 0) {
    candidatos.push(clave.remoteJidAlt);
  }
  if (
    !desdeMi &&
    typeof clave.senderPn === "string" &&
    clave.senderPn.length > 0
  ) {
    candidatos.push(clave.senderPn);
  }
  for (const cand of candidatos) {
    if (cand.endsWith("@s.whatsapp.net")) {
      return { jidParaEnviar, telefonoMostrable: telefonoDesdeJID(cand) };
    }
  }

  // No pudimos resolver a un teléfono real. El caller debe intentar
  // buscar la conversación por jid_wa (= remoteJid @lid) antes de
  // crear una nueva.
  return null;
}

const timersBuffer = new Map<string, NodeJS.Timeout>();
function cancelarTimer(conversacionId: string): void {
  const t = timersBuffer.get(conversacionId);
  if (t) {
    clearTimeout(t);
    timersBuffer.delete(conversacionId);
  }
}

// Tracker de IDs enviados por nosotros (bot IA o humano vía panel).
// fromMe=true rebote: si el id ya está acá, lo descartamos (eco de un
// envío propio); si no está, lo guardamos como humano (tipeado manual).
// Guardamos también el conversacionId para mapear @lid → conv cuando
// el eco llega con un JID anónimo distinto al que mandamos.
interface InfoEnvio {
  conversacionId: string | null;
}
const idsEnviadosPorBot = new Map<string, Map<string, InfoEnvio>>();
const TTL_TRACKING_MS = 10 * 60 * 1000;

export function recordarEnvioBot(
  cuentaId: string,
  msgId: string | null | undefined,
  conversacionId: string | null = null,
): void {
  if (!msgId) return;
  let m = idsEnviadosPorBot.get(cuentaId);
  if (!m) {
    m = new Map();
    idsEnviadosPorBot.set(cuentaId, m);
  }
  m.set(msgId, { conversacionId });
  setTimeout(() => m.delete(msgId), TTL_TRACKING_MS);
}

function fueEnviadoPorNosotros(
  cuentaId: string,
  msgId: string | null | undefined,
): boolean {
  if (!msgId) return false;
  return !!idsEnviadosPorBot.get(cuentaId)?.has(msgId);
}

function obtenerConvDeEnvio(
  cuentaId: string,
  msgId: string | null | undefined,
): string | null {
  if (!msgId) return null;
  return idsEnviadosPorBot.get(cuentaId)?.get(msgId)?.conversacionId ?? null;
}

export function registrarManejadores(
  sock: WASocket,
  cuentaId: string,
  etiquetaCuenta: string,
): void {
  const prefijo = `[bot:${etiquetaCuenta}]`;

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    // Aceptamos "notify" (mensajes en tiempo real) Y "append"
    // (mensajes que WhatsApp re-entrega tras reconectar).
    // Sin "append", el primer mensaje del cliente después de un
    // reconnect quedaba en limbo hasta que llegaba un segundo mensaje.
    // La idempotencia por wa_msg_id evita duplicados (ver insertarMensaje).
    if (type !== "notify" && type !== "append") return;

    for (const msg of messages) {
      try {
        const clave = msg.key as ClaveMensajeExtendida;
        const remoteJid = clave.remoteJid;
        const desdeMi = !!clave.fromMe;

        // Log de debug al inicio absoluto: nos permite diagnosticar
        // si un mensaje llegó pero se descartó silenciosamente más
        // adelante (filtros, dedupe, error en parser, etc).
        console.log(
          `${prefijo} 📥 evento entrante type=${type} remoteJid=${remoteJid ?? "null"} fromMe=${desdeMi} msgId=${msg.key.id ?? "?"}`,
        );

        if (!remoteJid) continue;
        if (remoteJid.endsWith("@g.us")) continue;
        if (remoteJid.endsWith("@broadcast")) continue;
        if (remoteJid.endsWith("@newsletter")) continue;

        // Si el mensaje fromMe es eco de algo que enviamos nosotros
        // (bot IA o panel humano), ya está en DB. Skip para no duplicar.
        // Aprovechamos para grabar jid_wa = @lid si el eco vino con LID
        // y la conversación todavía tiene el JID viejo @s.whatsapp.net —
        // así, cuando el operador escriba manualmente desde el celular,
        // podremos mapear su mensaje a la conversación correcta.
        if (desdeMi && fueEnviadoPorNosotros(cuentaId, msg.key.id)) {
          if (remoteJid && remoteJid.endsWith("@lid")) {
            const convId = obtenerConvDeEnvio(cuentaId, msg.key.id);
            if (convId) {
              try {
                const conv = await obtenerConversacionPorId(convId);
                if (conv && conv.jid_wa !== remoteJid) {
                  await actualizarJidWaConversacion(convId, remoteJid);
                }
              } catch (err) {
                console.error(
                  `${prefijo} error grabando @lid de eco:`,
                  err,
                );
              }
            }
          }
          continue;
        }

        const identidad = resolverIdentidad(clave);
        // Si no resolvimos a teléfono pero tenemos un @lid, intentamos
        // encontrar la conversación que ya existe con ese jid_wa.
        // Esto cubre el caso del cel conectado mandando a un contacto
        // cuyo chat WhatsApp marca como @lid.
        let convExistentePorJid: Conversacion | null = null;
        let jidParaEnviar: string;
        let telefonoMostrable: string;
        if (identidad) {
          jidParaEnviar = identidad.jidParaEnviar;
          telefonoMostrable = identidad.telefonoMostrable;
        } else {
          convExistentePorJid = await obtenerConversacionPorJid(
            cuentaId,
            remoteJid,
          );
          if (!convExistentePorJid) {
            console.warn(
              `${prefijo} ⚠ no se pudo resolver teléfono real ni encontrar conv por jid_wa para remoteJid=${remoteJid} (senderPn=${clave.senderPn ?? "null"}, remoteJidAlt=${clave.remoteJidAlt ?? "null"}, fromMe=${desdeMi}) — mensaje descartado`,
            );
            continue;
          }
          jidParaEnviar = remoteJid;
          telefonoMostrable = convExistentePorJid.telefono;
        }
        if (!telefonoMostrable) continue;

        const cuenta = await obtenerCuenta(cuentaId);
        if (!cuenta) {
          console.warn(
            `${prefijo} ⚠ cuenta ${cuentaId} no existe en DB — mensaje ignorado`,
          );
          continue;
        }
        if (cuenta.esta_archivada) {
          console.warn(
            `${prefijo} ⚠ cuenta archivada — mensaje ignorado`,
          );
          continue;
        }

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

        const conversacion =
          convExistentePorJid ??
          (await obtenerOCrearConversacion(
            cuentaId,
            telefonoMostrable,
            msg.pushName ?? null,
            jidParaEnviar,
          ));

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
          // Antes de insertar, verificamos si es eco de un mensaje humano
          // que el panel ya guardó hace pocos segundos sin wa_msg_id —
          // si lo es, sólo actualizamos su wa_msg_id (evita duplicados).
          const yaVinculado = msg.key.id
            ? await vincularEcoHumanoReciente(
                cuentaId,
                conversacion.id,
                msg.key.id,
                contenido,
                mediaPath,
              )
            : false;
          if (!yaVinculado) {
            await insertarMensaje(
              cuentaId,
              conversacion.id,
              "humano",
              contenido,
              {
                tipo,
                media_path: mediaPath,
                wa_msg_id: msg.key.id ?? null,
              },
            );
          }
          // Cancelar cualquier timer de buffer pendiente: ya respondió un humano
          cancelarTimer(conversacion.id);
          // Auto-handoff: si la conversación estaba en modo IA y el
          // operador respondió desde su celular, pasamos a HUMANO para
          // que el bot no compita con la persona. Cuando quiera devolverle
          // el control a la IA, lo cambia desde el panel.
          if (!yaVinculado) {
            try {
              const convFresca = await obtenerConversacionPorId(conversacion.id);
              if (convFresca && convFresca.modo === "IA") {
                await cambiarModo(conversacion.id, "HUMANO");
                console.log(
                  `${prefijo} 🤝 auto-handoff: operador respondió desde celular → modo HUMANO`,
                );
              }
            } catch (err) {
              console.error(`${prefijo} error en auto-handoff:`, err);
            }
          }
          continue;
        }

        await insertarMensaje(cuentaId, conversacion.id, "usuario", contenido, {
          tipo,
          media_path: mediaPath,
          wa_msg_id: msg.key.id ?? null,
        });

        // El cliente respondió → resetear contador de auto-seguimientos
        // para que si el bot vuelve a mandar y el cliente vuelve a
        // callarse, los recordatorios arranquen desde el paso 1.
        try {
          await resetearPasoAutoSeguimiento(conversacion.id);
        } catch (err) {
          console.error(`${prefijo} error reseteando auto-seg:`, err);
        }

        // Handoff inmediato por palabras clave configuradas en /configuracion.
        // Si el cliente escribe "hablar con humano", "agente humano", etc.,
        // disparamos handoff sin pasar por la IA y ya el operador atiende.
        if (cuenta.palabras_handoff?.trim() && contenido) {
          const palabras = cuenta.palabras_handoff
            .split(",")
            .map((p) => p.trim().toLowerCase())
            .filter(Boolean);
          const textoLower = contenido.toLowerCase();
          const matched = palabras.find((p) => textoLower.includes(p));
          if (matched) {
            console.log(
              `${prefijo} 🤝 handoff por palabra clave "${matched}" — el cliente pidió humano`,
            );
            try {
              await marcarConversacionNecesitaHumano(
                conversacion.id,
                `Cliente pidió hablar con humano (palabra clave: "${matched}")`,
              );
              dispararWebhook(cuentaId, "handoff_humano", {
                conversacion_id: conversacion.id,
                telefono: telefonoMostrable,
                nombre: conversacion.nombre,
                razon: `palabra clave: ${matched}`,
              });
            } catch (err) {
              console.error(`${prefijo} error en handoff por palabra:`, err);
            }
            continue; // No pasamos a la IA
          }
        }

        // Webhooks: notificar que llegó mensaje + (si la conv es nueva)
        // que apareció contacto nuevo. Fire-and-forget — no bloquea.
        dispararWebhook(cuentaId, "mensaje_recibido", {
          conversacion_id: conversacion.id,
          telefono: telefonoMostrable,
          nombre: conversacion.nombre,
          tipo,
          contenido,
          media_path: mediaPath,
          wa_msg_id: msg.key.id ?? null,
        });
        if (eraConversacionNueva) {
          dispararWebhook(cuentaId, "contacto_nuevo", {
            conversacion_id: conversacion.id,
            telefono: telefonoMostrable,
            nombre: conversacion.nombre,
            primer_mensaje: contenido,
          });
        }

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
        if (!fresca) {
          console.warn(
            `${prefijo} ⚠ conversación ${conversacion.id} no existe — no respondo`,
          );
          cancelarTimer(conversacion.id);
          continue;
        }
        if (fresca.modo !== "IA") {
          console.log(
            `${prefijo} ⏸ conv en modo ${fresca.modo} (necesita_humano=${fresca.necesita_humano}) — no respondo. Cambialo a IA en el panel para que el bot retome.`,
          );
          cancelarTimer(conversacion.id);
          continue;
        }
        // Pre-check OpenAI antes de armar la respuesta
        if (!process.env.OPENAI_API_KEY) {
          console.error(
            `${prefijo} ✗ NO HAY OPENAI_API_KEY — el bot no puede generar respuesta. Agregala en .env.local y reiniciá.`,
          );
          continue;
        }
        console.log(
          `${prefijo} ✓ generando respuesta IA para ${conversacion.nombre ?? telefonoMostrable}...`,
        );

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
