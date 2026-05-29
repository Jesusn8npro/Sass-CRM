/**
 * Cifrado simétrico de secretos sensibles (AES-256-GCM).
 *
 * Se usa para guardar credenciales de terceros que DEBEN ser recuperables
 * (ej: la service_role key del Supabase externo de cada cuenta). A diferencia
 * de las API keys propias —que se hashean SHA-256 y nunca se recuperan—, acá
 * necesitamos el texto original para reconectar, así que ciframos en vez de
 * hashear.
 *
 * Clave maestra: `CLAVE_CIFRADO_SECRETOS` (64 hex = 32 bytes). Si falta o es
 * inválida, lanzamos en vez de degradar a texto plano: preferimos fallar
 * ruidosamente antes que guardar un secreto sin cifrar.
 *
 * Formato del blob cifrado: `v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>`.
 * El prefijo de versión permite rotar el esquema más adelante y detectar
 * valores legacy en texto plano.
 */
import crypto from "node:crypto";

const PREFIJO_VERSION = "v1";
const ALGORITMO = "aes-256-gcm";
const IV_BYTES = 12; // recomendado para GCM

function obtenerClaveMaestra(): Buffer {
  const hex = process.env.CLAVE_CIFRADO_SECRETOS?.trim();
  if (!hex) {
    throw new Error(
      "Falta CLAVE_CIFRADO_SECRETOS en el entorno. Es obligatoria para cifrar secretos de terceros.",
    );
  }
  const clave = Buffer.from(hex, "hex");
  if (clave.length !== 32) {
    throw new Error(
      "CLAVE_CIFRADO_SECRETOS debe ser 64 caracteres hex (32 bytes).",
    );
  }
  return clave;
}

/** Cifra un texto plano y devuelve el blob versionado listo para guardar. */
export function cifrar(textoPlano: string): string {
  const clave = obtenerClaveMaestra();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITMO, clave, iv);
  const cifrado = Buffer.concat([
    cipher.update(textoPlano, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    PREFIJO_VERSION,
    iv.toString("hex"),
    authTag.toString("hex"),
    cifrado.toString("hex"),
  ].join(":");
}

/**
 * Descifra un blob producido por `cifrar`. Si el valor no tiene el prefijo
 * `v1:` se asume legacy en texto plano y se devuelve tal cual (compat).
 */
export function descifrar(blob: string): string {
  if (!blob.startsWith(`${PREFIJO_VERSION}:`)) return blob;
  const [, ivHex, authTagHex, cifradoHex] = blob.split(":");
  if (!ivHex || !authTagHex || !cifradoHex) {
    throw new Error("Blob cifrado malformado.");
  }
  const clave = obtenerClaveMaestra();
  const decipher = crypto.createDecipheriv(
    ALGORITMO,
    clave,
    Buffer.from(ivHex, "hex"),
  );
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const descifrado = Buffer.concat([
    decipher.update(Buffer.from(cifradoHex, "hex")),
    decipher.final(),
  ]);
  return descifrado.toString("utf8");
}
