/**
 * Capa de acceso a datos sobre Supabase Postgres.
 *
 * Cada archivo de este directorio cubre un dominio (cuentas,
 * conversaciones, mensajes, citas, etc.) y este barrel los re-exporta
 * todos. Usar imports desde `@/lib/baseDatos` o `@/lib/db` indistinto.
 *
 * Convenciones:
 *   - IDs son UUIDs (string).
 *   - Timestamps son strings ISO 8601 (timestamptz de Postgres).
 *   - Para comparar timestamps usar `new Date(s).getTime()`.
 *   - El bot usa el cliente admin (service_role). Las APIs llamadas
 *     desde el browser DEBEN verificar `cuenta.usuario_id ===
 *     auth.uid()` antes de invocar estas funciones (ver
 *     `src/lib/auth/sesion.ts`).
 */

export * from "./tipos";
export * from "./usuarios";
export * from "./cuentas";
export * from "./conversaciones";
export * from "./mensajes";
export * from "./bandejaSalida";
export * from "./conocimiento";
export * from "./respuestasRapidas";
export * from "./etiquetas";
export * from "./biblioteca";
export * from "./etapas";
export * from "./contactosEmail";
export * from "./contactosTelefono";
export * from "./productos";
export * from "./interesProducto";
export * from "./inversiones";
export * from "./seguimientos";
export * from "./citas";
export * from "./llamadasVapi";
export * from "./metricas";
export * from "./assistantsVapi";
export * from "./llamadasProgramadas";
export * from "./notificaciones";
export * from "./creditos";
export * from "./runsApify";
export * from "./threadsConfig";
export * from "./leadsExtraidos";
export * from "./autoSeguimientos";
export * from "./conocimientoChunks";
