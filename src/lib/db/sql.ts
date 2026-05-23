/**
 * Conexión directa a PostgreSQL vía connection pooler de Supabase.
 * Bypasea completamente PostgREST (API REST) → elimina el egress de DB.
 *
 * Usar DATABASE_URL del pooler (Settings → Database → Connection pooling → Transaction mode)
 * Formato: postgresql://postgres.[ref]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
 *
 * IMPORTANTE: para las queries del servidor usa `sql` de este módulo.
 * El cliente de Supabase JS (`db()`) queda solo para Storage y Auth.
 */
import postgres from "postgres";

let _sql: ReturnType<typeof postgres> | null = null;

export function sql(): ReturnType<typeof postgres> {
  if (_sql) return _sql;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "[db:sql] DATABASE_URL no está definida. " +
      "Agregá la URL del connection pooler de Supabase en las variables de entorno."
    );
  }

  _sql = postgres(url, {
    max: 10,
    idle_timeout: 30,
    connect_timeout: 10,
    prepare: false, // Requerido para transaction mode del pooler
  });

  return _sql;
}
