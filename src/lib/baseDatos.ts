/**
 * Re-export de toda la capa de acceso a datos.
 * El código real vive en `src/lib/db/*` partido por dominio.
 * Este barrel se mantiene para no tocar los ~110 imports existentes.
 */
export * from "./db";
