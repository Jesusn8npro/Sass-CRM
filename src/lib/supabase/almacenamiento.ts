/**
 * Helper de Supabase Storage.
 * Sube/lee/borra archivos de los buckets `productos`, `biblioteca` y
 * `media-chats`. Usa el cliente admin para bypasear RLS — la verificación
 * de propiedad ya la hacen las APIs vía requerirSesion + cuenta.usuario_id.
 *
 * Convención de paths: `<cuentaId>/<nombreArchivo>` (cuentaId UUID).
 */

import { crearClienteAdmin } from "./cliente-servidor";

export type BucketAlmacen = "productos" | "biblioteca" | "media-chats";

/**
 * Sube un buffer a un bucket. Devuelve la ruta dentro del bucket.
 */
export async function subirArchivo(
  bucket: BucketAlmacen,
  cuentaId: string,
  nombreArchivo: string,
  contenido: Buffer | Uint8Array | Blob,
  mime?: string,
): Promise<{ ruta: string }> {
  const ruta = `${cuentaId}/${nombreArchivo}`;
  const supabase = crearClienteAdmin();
  const { error } = await supabase.storage.from(bucket).upload(ruta, contenido, {
    contentType: mime,
    upsert: false,
  });
  if (error) {
    throw new Error(`[storage:${bucket}] subir ${ruta}: ${error.message}`);
  }
  return { ruta };
}

/**
 * Descarga el archivo como Buffer (para servirlo desde una API que
 * proxy-ea el contenido sin exponer URL firmada).
 */
export async function descargarArchivo(
  bucket: BucketAlmacen,
  ruta: string,
): Promise<{ buffer: Buffer; mime: string } | null> {
  const supabase = crearClienteAdmin();
  const { data, error } = await supabase.storage.from(bucket).download(ruta);
  if (error || !data) return null;
  const arr = await data.arrayBuffer();
  return {
    buffer: Buffer.from(arr),
    mime: data.type || "application/octet-stream",
  };
}

export async function borrarArchivo(
  bucket: BucketAlmacen,
  ruta: string,
): Promise<void> {
  const supabase = crearClienteAdmin();
  const { error } = await supabase.storage.from(bucket).remove([ruta]);
  if (error) {
    throw new Error(`[storage:${bucket}] borrar ${ruta}: ${error.message}`);
  }
}
