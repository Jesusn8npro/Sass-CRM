/**
 * Helper de Supabase Storage.
 * Sube/lee/borra archivos de los buckets `productos`, `biblioteca` y
 * `media-chats`. Usa el cliente admin para bypasear RLS — la verificación
 * de propiedad ya la hacen las APIs vía requerirSesion + cuenta.usuario_id.
 *
 * Convención de paths: `<cuentaId>/<nombreArchivo>` (cuentaId UUID).
 * Esa convención es la que usan también las policies en storage.objects
 * para chequeo de pertenencia desde clientes authenticated.
 *
 * Estado: SCAFFOLDING — Fase 6.A.3. Las APIs de upload todavía guardan
 * en disco local. Una vez probado en local + EasyPanel, se cambia el
 * write-path para escribir en Storage en lugar del filesystem.
 */

import { crearClienteAdmin } from "./cliente-servidor";

export type BucketAlmacen = "productos" | "biblioteca" | "media-chats";

/**
 * Sube un buffer a un bucket. Devuelve la ruta dentro del bucket
 * (sin URL — para obtener URL firmada usar `urlFirmadaDe`).
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
 * Devuelve una URL firmada (temporal) para servir el archivo.
 * Por defecto 1 hora — suficiente para que el navegador cachee y muestre.
 */
export async function urlFirmadaDe(
  bucket: BucketAlmacen,
  ruta: string,
  segundos = 3600,
): Promise<string | null> {
  const supabase = crearClienteAdmin();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(ruta, segundos);
  if (error || !data) return null;
  return data.signedUrl;
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

/**
 * Verifica si un archivo existe en Storage. Útil para el modo híbrido
 * "leer de Storage primero, fallback a disco local".
 */
export async function existeArchivo(
  bucket: BucketAlmacen,
  ruta: string,
): Promise<boolean> {
  const supabase = crearClienteAdmin();
  // Listamos por prefijo y buscamos coincidencia exacta — list es la
  // única operación que no tira 404 por archivo inexistente.
  const partes = ruta.split("/");
  const archivo = partes.pop();
  const carpeta = partes.join("/");
  const { data, error } = await supabase.storage
    .from(bucket)
    .list(carpeta, { search: archivo, limit: 1 });
  if (error || !data) return false;
  return data.some((f) => f.name === archivo);
}
