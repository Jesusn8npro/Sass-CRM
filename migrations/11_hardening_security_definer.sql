-- ============================================================
-- 11 — Hardening de SECURITY DEFINER detectado por advisors
--
-- 1. La vista metering_resumen_mes corría como SECURITY DEFINER
--    bypassando RLS. La recreamos con security_invoker=true para
--    que respete las políticas de la tabla subyacente.
--
-- 2. Las RPCs internas (agregar_creditos, descontar_creditos,
--    crear_creditos_iniciales, buscar_chunks_similares) las ejecuta
--    el bot vía service_role; revocamos EXECUTE para anon/authenticated
--    para que no se puedan llamar desde el browser via /rest/v1/rpc/.
--
-- 3. cuenta_es_mia se preserva — la usan policies RLS que evalúan con
--    el rol authenticated del usuario.
-- ============================================================

do $$
begin
  if to_regclass('public.metering_resumen_mes') is not null then
    execute 'alter view public.metering_resumen_mes set (security_invoker = true)';
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
             where n.nspname='public' and p.proname='agregar_creditos') then
    execute 'revoke execute on function public.agregar_creditos(uuid, integer) from anon, authenticated';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
             where n.nspname='public' and p.proname='descontar_creditos') then
    execute 'revoke execute on function public.descontar_creditos(uuid, text, integer, numeric, jsonb) from anon, authenticated';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
             where n.nspname='public' and p.proname='crear_creditos_iniciales') then
    execute 'revoke execute on function public.crear_creditos_iniciales() from anon, authenticated';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
             where n.nspname='public' and p.proname='buscar_chunks_similares') then
    execute 'revoke execute on function public.buscar_chunks_similares(public.vector, uuid, integer, double precision) from anon, authenticated';
  end if;
end $$;
