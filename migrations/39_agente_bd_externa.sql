-- Permite que el agente de IA consulte el Supabase externo de la cuenta.
--
-- agente_bd_externa_habilitada: interruptor maestro. Aunque haya una conexión
--   válida, el agente NO consulta nada hasta que esto esté en true.
-- agente_tablas_permitidas: subconjunto de supabase_externo_tablas que el
--   agente puede leer. Deny-by-default: lo que no esté listado acá no se
--   consulta nunca, aunque exista en la base externa.
alter table public.cuentas
  add column if not exists agente_bd_externa_habilitada boolean not null default false,
  add column if not exists agente_tablas_permitidas      jsonb   not null default '[]'::jsonb;
