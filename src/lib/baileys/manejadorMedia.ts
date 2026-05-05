/**
 * Procesa mensajes entrantes con media (audio/imagen/video/documento):
 * los descarga, los sube a Storage, y devuelve el contenido textual
 * para guardar en mensajes.contenido (transcripción si es audio,
 * caption si es imagen/video, fileName si es documento).
 */
import { type WAMessage, type WASocket } from "@whiskeysockets/baileys";
import { type TipoMensaje } from "../baseDatos";
import {
  borrarMediaChat,
  descargarYGuardarMedia,
  detectarTipoMedia,
  transcribirAudio,
} from "./medios";

export async function procesarMediaEntrante(
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
    const texto = await transcribirAudio(
      descargado.buffer,
      descargado.nombreArchivo,
      cuentaId,
    );
    const dur = Date.now() - inicio;
    if (texto) {
      console.log(`${prefijo} ✓ transcripción (${dur}ms): "${texto.slice(0, 80)}"`);
      contenido = texto;
      // El audio ya está como texto en `mensajes.contenido`. Borramos
      // el archivo del bucket para no acumular storage indefinidamente.
      // Best-effort: si falla, no rompemos el flujo.
      void borrarMediaChat(descargado.rutaRelativa).catch((err) => {
        console.warn(`${prefijo} no se pudo borrar audio post-transcripción:`, err);
      });
      return { tipo: info.tipo, contenido, mediaPath: null };
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
