/**
 * Auth state de Baileys persistido en Supabase Postgres.
 *
 * Reemplaza `useMultiFileAuthState(folder)` (que escribe a disco). La sesión
 * sobrevive reinicios del contenedor y soporta multi-instancia del bot.
 *
 * Estructura en DB (tabla `baileys_auth`):
 *   PK = (cuenta_id, tipo, id), valor = JSONB
 *   tipo='creds'              id='main'  → AuthenticationCreds (1 row)
 *   tipo='pre-key'            id=<num>   → pre-keys
 *   tipo='session'            id=<jid>   → Signal sessions
 *   tipo='sender-key'         id=<key>   → group sender keys
 *   tipo='app-state-sync-key' / 'app-state-sync-version' / 'sender-key-memory'
 *
 * Los Buffer se serializan vía `BufferJSON.replacer` (que los convierte
 * a `{ type:'Buffer', data:[...] }`) y se reconstruyen con `BufferJSON.reviver`.
 */

import {
  BufferJSON,
  initAuthCreds,
  type AuthenticationCreds,
  type AuthenticationState,
  type SignalDataTypeMap,
  type SignalKeyStore,
} from "@whiskeysockets/baileys";
import { crearClienteAdmin } from "../supabase/cliente-servidor";

const TIPO_CREDS = "creds";
const ID_CREDS = "main";

function db() {
  return crearClienteAdmin();
}

/** Serializa con BufferJSON.replacer y vuelve a parsear para
 *  obtener un objeto JSON puro listo para JSONB. */
function serializar(valor: unknown): unknown {
  return JSON.parse(JSON.stringify(valor, BufferJSON.replacer));
}

/** Inverso: revive Buffers y bigints desde el JSONB. */
function deserializar(valor: unknown): unknown {
  return JSON.parse(JSON.stringify(valor), BufferJSON.reviver);
}

/**
 * Carga (o inicializa) el auth state de una cuenta.
 *
 * Devuelve `{ state, saveCreds }` con la misma firma que
 * `useMultiFileAuthState`. El caller registra `sock.ev.on('creds.update', saveCreds)`.
 */
export async function useSupabaseAuthState(
  cuentaId: string,
): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
}> {
  // 1. Cargar las creds (si existen)
  const { data: rowCreds, error: errCreds } = await db()
    .from("baileys_auth")
    .select("valor")
    .eq("cuenta_id", cuentaId)
    .eq("tipo", TIPO_CREDS)
    .eq("id", ID_CREDS)
    .maybeSingle();
  if (errCreds) {
    throw new Error(
      `[auth-supabase] error cargando creds de ${cuentaId}: ${errCreds.message}`,
    );
  }

  const creds: AuthenticationCreds = rowCreds?.valor
    ? (deserializar(rowCreds.valor) as AuthenticationCreds)
    : initAuthCreds();

  // 2. SignalKeyStore que pega contra la DB
  const keys: SignalKeyStore = {
    get: async (tipo, ids) => {
      if (ids.length === 0) {
        return {} as { [id: string]: SignalDataTypeMap[typeof tipo] };
      }
      const { data, error } = await db()
        .from("baileys_auth")
        .select("id, valor")
        .eq("cuenta_id", cuentaId)
        .eq("tipo", tipo)
        .in("id", ids);
      if (error) {
        console.error(
          `[auth-supabase] error get ${tipo} (${ids.length} ids):`,
          error.message,
        );
        return {} as { [id: string]: SignalDataTypeMap[typeof tipo] };
      }
      const out: Record<string, unknown> = {};
      for (const row of (data ?? []) as Array<{ id: string; valor: unknown }>) {
        out[row.id] = deserializar(row.valor);
      }
      return out as { [id: string]: SignalDataTypeMap[typeof tipo] };
    },

    set: async (datos) => {
      // datos = { tipo: { id: valor | null } }
      const upserts: Array<{
        cuenta_id: string;
        tipo: string;
        id: string;
        valor: unknown;
      }> = [];
      const deletes: Array<{ tipo: string; id: string }> = [];

      for (const tipoKey of Object.keys(datos)) {
        const tipo = tipoKey as keyof SignalDataTypeMap;
        const sub = datos[tipo];
        if (!sub) continue;
        for (const idKey of Object.keys(sub)) {
          const valor = (sub as Record<string, unknown>)[idKey];
          if (valor === null || valor === undefined) {
            deletes.push({ tipo: tipoKey, id: idKey });
          } else {
            upserts.push({
              cuenta_id: cuentaId,
              tipo: tipoKey,
              id: idKey,
              valor: serializar(valor),
            });
          }
        }
      }

      // Upserts en batches por si son muchos (initial pre-keys son ~100)
      if (upserts.length > 0) {
        const BATCH = 100;
        for (let i = 0; i < upserts.length; i += BATCH) {
          const batch = upserts.slice(i, i + BATCH);
          const { error } = await db().from("baileys_auth").upsert(batch);
          if (error) {
            console.error(
              `[auth-supabase] error upsert batch (${batch.length}):`,
              error.message,
            );
          }
        }
      }
      // Deletes
      for (const d of deletes) {
        const { error } = await db()
          .from("baileys_auth")
          .delete()
          .eq("cuenta_id", cuentaId)
          .eq("tipo", d.tipo)
          .eq("id", d.id);
        if (error) {
          console.error(
            `[auth-supabase] error delete ${d.tipo}/${d.id}:`,
            error.message,
          );
        }
      }
    },
  };

  // 3. saveCreds — invocado por sock.ev.on('creds.update', saveCreds).
  //    Persiste el objeto creds completo (sigue siendo el mismo objeto
  //    que devolvimos arriba — Baileys lo muta in-place).
  const saveCreds = async () => {
    const { error } = await db()
      .from("baileys_auth")
      .upsert({
        cuenta_id: cuentaId,
        tipo: TIPO_CREDS,
        id: ID_CREDS,
        valor: serializar(creds),
      });
    if (error) {
      console.error(
        `[auth-supabase] error guardando creds de ${cuentaId}:`,
        error.message,
      );
    }
  };

  return { state: { creds, keys }, saveCreds };
}

/**
 * Borra TODA la sesión Baileys de una cuenta (creds + todas las keys).
 * Usado cuando WhatsApp cierra sesión (DisconnectReason.loggedOut) — así
 * el siguiente arranque genera QR limpio.
 */
export async function borrarSesionBaileysDeCuenta(
  cuentaId: string,
): Promise<void> {
  const { error } = await db()
    .from("baileys_auth")
    .delete()
    .eq("cuenta_id", cuentaId);
  if (error) {
    console.error(
      `[auth-supabase] error borrando sesión de ${cuentaId}:`,
      error.message,
    );
  } else {
    console.log(`[auth-supabase] sesión de cuenta ${cuentaId} borrada`);
  }
}

/**
 * Verifica si ya hay creds guardadas para esta cuenta. Útil para
 * decidir si mostrar QR de primera vez o intentar reconectar.
 */
export async function tieneSesionBaileys(cuentaId: string): Promise<boolean> {
  const { data } = await db()
    .from("baileys_auth")
    .select("cuenta_id", { count: "exact", head: true })
    .eq("cuenta_id", cuentaId)
    .eq("tipo", TIPO_CREDS)
    .eq("id", ID_CREDS)
    .limit(1);
  return !!data;
}
