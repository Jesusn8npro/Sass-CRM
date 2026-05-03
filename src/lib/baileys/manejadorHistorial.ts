/**
 * Funciones de historial de WhatsApp:
 * - procesarMensajeHistorico: parsea un mensaje viejo y lo guarda con
 *   timestamp original, marcado como histórico (NO dispara IA).
 * - dispararFetchHistorialContacto: pide los 50 mensajes anteriores a
 *   un mensaje pivote (background, llega vía 'messaging-history.set').
 * - pedirMasHistorialConversacion: export pública para "Cargar más" en panel.
 */
import {
  type WAMessage,
  type WASocket,
  type proto,
} from "@whiskeysockets/baileys";
import {
  insertarMensaje,
  obtenerOCrearConversacion,
  type TipoMensaje,
} from "../baseDatos";
import { desempacarMensaje, detectarTipoMedia } from "./medios";

function extraerTexto(mensaje: proto.IMessage | null | undefined): string | null {
  const inner = desempacarMensaje(mensaje);
  if (!inner) return null;
  if (inner.conversation) return inner.conversation;
  if (inner.extendedTextMessage?.text) return inner.extendedTextMessage.text;
  return null;
}

export async function procesarMensajeHistorico(
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
export function dispararFetchHistorialContacto(
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

