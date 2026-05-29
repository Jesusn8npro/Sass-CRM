-- Conexión a un Supabase EXTERNO por cuenta.
--
-- Permite que cada cuenta (tenant) conecte el proyecto Supabase de SU
-- propio negocio. El agente de esa cuenta podrá consultar/escribir en esa
-- base para responder con datos reales (precios, stock, clientes, etc).
--
-- SEGURIDAD: la service_role key se guarda en texto plano igual que las
-- credenciales vapi_* (mismo criterio del proyecto: se confía en RLS +
-- HTTPS + lectura solo server-side). NUNCA se expone al cliente: la UI y
-- el endpoint GET devuelven solo si está conectado, la URL y las tablas,
-- jamás la key.
alter table public.cuentas
  add column if not exists supabase_externo_url           text,
  add column if not exists supabase_externo_service_key   text,
  add column if not exists supabase_externo_validado_en    timestamptz,
  -- Cache de nombres de tabla descubiertos al validar la conexión, para
  -- que el agente sepa qué hay sin re-introspeccionar en cada mensaje.
  add column if not exists supabase_externo_tablas         jsonb not null default '[]'::jsonb;
