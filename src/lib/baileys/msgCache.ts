/**
 * Caché PERSISTENTE de mensajes enviados, respaldo del Map en memoria.
 *
 * El problema que resuelve: cuando el receptor no puede descifrar un
 * mensaje (cambió de sesión, reinstaló, etc.), WhatsApp le pide al bot
 * que lo re-envíe vía `getMessage`. La caché en memoria muere con cada
 * deploy/reinicio, así que todo mensaje enviado antes del reinicio
 * quedaba irrecuperable y el cliente veía para siempre
 * "Esperando el mensaje. Esto puede tardar un poco".
 *
 * Se persiste en la tabla `baileys_auth` (ya existente) con
 * tipo='msg-cache': misma fila (cuenta_id, tipo, id) → valor JSONB que
 * usa el auth state, así que no hace falta migración. `actualizado_en`
 * permite la limpieza por TTL.
 *
 * Todo es fire-and-forget: un fallo acá NUNCA debe frenar el envío.
 */
import type { proto } from "@whiskeysockets/baileys";
import { crearClienteAdmin } from "../supabase/cliente-servidor";

const TIPO_MSG_CACHE = "msg-cache";

/** WhatsApp reintenta descifrados recientes; una semana cubre de sobra. */
const TTL_DIAS = 7;

/** Guarda un mensaje enviado para poder responder retries tras un reinicio. */
export function persistirMensajeEnviado(
  cuentaId: string,
  id: string,
  mensaje: proto.IMessage,
): void {
  void (async () => {
    try {
      await crearClienteAdmin()
        .from("baileys_auth")
        .upsert(
          {
            cuenta_id: cuentaId,
            tipo: TIPO_MSG_CACHE,
            id,
            valor: JSON.parse(JSON.stringify(mensaje)),
            actualizado_en: new Date().toISOString(),
          },
          { onConflict: "cuenta_id,tipo,id" },
        );
    } catch {
      /* mejor perder un retry que romper el envío */
    }
  })();
}

/** Busca un mensaje que ya no está en memoria (típico: reinicio de por medio). */
export async function leerMensajePersistido(
  cuentaId: string,
  id: string,
): Promise<proto.IMessage | undefined> {
  try {
    const { data } = await crearClienteAdmin()
      .from("baileys_auth")
      .select("valor")
      .eq("cuenta_id", cuentaId)
      .eq("tipo", TIPO_MSG_CACHE)
      .eq("id", id)
      .maybeSingle();
    return (data?.valor as proto.IMessage | undefined) ?? undefined;
  } catch {
    return undefined;
  }
}

/** Borra entradas viejas. Se llama al conectar cada cuenta (1 vez por arranque). */
export function limpiarMensajesViejos(cuentaId: string): void {
  void (async () => {
    try {
      const limite = new Date(
        Date.now() - TTL_DIAS * 24 * 60 * 60 * 1000,
      ).toISOString();
      await crearClienteAdmin()
        .from("baileys_auth")
        .delete()
        .eq("cuenta_id", cuentaId)
        .eq("tipo", TIPO_MSG_CACHE)
        .lt("actualizado_en", limite);
    } catch {
      /* la limpieza puede esperar al próximo arranque */
    }
  })();
}
