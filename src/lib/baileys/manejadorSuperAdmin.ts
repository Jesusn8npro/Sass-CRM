/**
 * Manejador de mensajes entrantes del SUPER-ADMIN global del SaaS.
 *
 * Cuando el manejador principal (`manejador.ts`) detecta que el teléfono
 * remitente pertenece a un super-admin (`public.super_admins`), desvía
 * el mensaje acá en vez de procesarlo con la IA normal del agente.
 *
 * Acá:
 *  1. Parseamos el comando (`/usuarios`, `/reporte`, etc).
 *  2. Ejecutamos la lógica y obtenemos respuesta textual.
 *  3. La encolamos en la `bandeja_salida` para que el procesador
 *     existente la mande con todos sus retries / rate limits.
 *  4. Auditamos la acción en `admin_acciones`.
 */
import type { WASocket } from "@whiskeysockets/baileys";
import {
  encolarBandejaSalida,
  insertarMensaje,
  registrarAccionAdmin,
  type Conversacion,
  type SuperAdmin,
} from "../baseDatos";
import {
  ejecutarComandoAdmin,
  parsearComandoAdmin,
} from "../admin/comandos";
import { formatearAyuda } from "../admin/reportesFormato";

export interface ParamsManejoSuperAdmin {
  /** Socket activo de la cuenta receptora */
  sock: WASocket;
  /** ID de la cuenta receptora (la que recibió el mensaje admin) */
  cuentaId: string;
  /** Conversación donde llegó el mensaje */
  conversacion: Conversacion;
  /** Teléfono del super-admin (ya validado) */
  telefonoAdmin: string;
  /** Texto que escribió el admin */
  texto: string;
  /** JID para responder (mismo que llegó) */
  jidParaEnviar: string;
  /** Datos del super-admin (ya cargado por el caller) */
  superAdmin: SuperAdmin;
  /** Prefijo de log */
  prefijo: string;
}

/**
 * Maneja un mensaje del super-admin. NO genera respuesta IA — solo
 * ejecuta comandos administrativos.
 */
export async function manejarMensajeSuperAdmin(
  params: ParamsManejoSuperAdmin,
): Promise<void> {
  const { cuentaId, conversacion, texto, superAdmin, prefijo } = params;

  console.log(
    `${prefijo} 👑 super-admin ${superAdmin.email} → "${texto.slice(0, 80)}"`,
  );

  const cmd = parsearComandoAdmin(texto);

  // Comando no reconocido → mandar ayuda
  if (!cmd) {
    const ayuda = formatearAyuda();
    await responderAdmin(params, ayuda);
    await registrarAccionAdmin({
      superAdminId: superAdmin.id,
      origen: "whatsapp",
      accion: "comando_desconocido",
      payload: { texto: texto.slice(0, 500) },
      resultado: null,
    });
    return;
  }

  // Comando válido → ejecutar y responder
  const inicio = Date.now();
  let respuesta: string;
  let resultado: Record<string, unknown>;
  let error: string | null = null;
  try {
    const ejec = await ejecutarComandoAdmin(cmd);
    respuesta = ejec.respuesta;
    resultado = ejec.resultado;
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    respuesta = `❌ Error interno ejecutando /${cmd.comando}.\n\n${error.slice(0, 200)}`;
    resultado = {};
    console.error(`${prefijo} error en comando admin ${cmd.comando}:`, err);
  }
  const ms = Date.now() - inicio;

  await responderAdmin(params, respuesta);

  // Audit trail — fire and forget
  void registrarAccionAdmin({
    superAdminId: superAdmin.id,
    origen: "whatsapp",
    accion: cmd.comando,
    payload: { args: cmd.args, cuenta_id: cuentaId, conv_id: conversacion.id },
    resultado: { ...resultado, ms },
    error,
  });
}

/**
 * Encola la respuesta en la bandeja_salida. Reusa toda la infraestructura
 * existente de envío con retries / rate limits / dedup de echo.
 *
 * También inserta una fila en `mensajes` con rol=asistente para que la
 * conversación se vea coherente en el panel del cliente dueño de la cuenta
 * (aunque ese cliente normalmente no debería ver esta conversación porque
 * es entre vos como SaaS-admin y su número).
 */
async function responderAdmin(
  params: ParamsManejoSuperAdmin,
  texto: string,
): Promise<void> {
  const { cuentaId, conversacion, telefonoAdmin } = params;

  // Encolar para que el procesador de bandeja la envíe en el próximo tick.
  // El procesador la manda con retries del manejadorEnvio + dedup de echo.
  try {
    await encolarBandejaSalida(
      cuentaId,
      conversacion.id,
      telefonoAdmin,
      texto,
      { tipo: "texto", media_path: null },
    );
  } catch (err) {
    // Fallback: insertar directo en mensajes y dejar que el panel lo muestre.
    // Si la bandeja falla, al menos queda audit del intento de respuesta.
    console.error(`${params.prefijo} no se pudo encolar respuesta admin:`, err);
    await insertarMensaje(cuentaId, conversacion.id, "asistente", texto, {
      tipo: "texto",
      media_path: null,
      wa_msg_id: null,
    });
  }
}
