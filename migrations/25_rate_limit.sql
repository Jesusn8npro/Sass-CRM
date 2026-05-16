-- ============================================================
-- 25_rate_limit.sql
--
-- Tabla de rate limiting persistente (sliding window por clave).
-- Reemplaza el Map en memoria de src/lib/auth/rateLimit.ts para
-- funcionar correctamente en entornos multi-instancia.
--
-- Idempotente. No borra nada.
-- ============================================================

create table if not exists public.rate_limit_windows (
  clave       text        not null,
  timestamps  bigint[]    not null default '{}',
  updated_at  timestamptz not null default now(),
  primary key (clave)
);

-- Función atómica: limpia timestamps viejos, agrega uno nuevo, devuelve
-- el conteo de timestamps en la ventana. Safe para uso concurrente.
create or replace function public.rl_check_and_push(
  p_clave       text,
  p_corte_ms    bigint,
  p_ahora_ms    bigint,
  p_max         int
) returns int
language plpgsql
as $$
declare
  v_ts bigint[];
  v_recientes bigint[];
  v_count int;
begin
  -- Obtener o inicializar la fila con bloqueo para evitar race conditions.
  insert into public.rate_limit_windows (clave, timestamps)
  values (p_clave, '{}')
  on conflict (clave) do nothing;

  select timestamps into v_ts
  from public.rate_limit_windows
  where clave = p_clave
  for update;

  -- Filtrar solo los timestamps dentro de la ventana.
  select array_agg(t order by t)
  into v_recientes
  from unnest(v_ts) as t
  where t >= p_corte_ms;

  v_recientes := coalesce(v_recientes, '{}');
  v_count := array_length(v_recientes, 1);
  v_count := coalesce(v_count, 0);

  -- Solo agregar si no supera el límite.
  if v_count < p_max then
    v_recientes := array_append(v_recientes, p_ahora_ms);
    update public.rate_limit_windows
    set timestamps = v_recientes, updated_at = now()
    where clave = p_clave;
    return v_count + 1; -- count después de agregar
  else
    return v_count; -- no se agregó, ya superó el límite
  end if;
end;
$$;

-- Limpieza periódica de filas inactivas (ejecutar con pg_cron o manualmente).
-- delete from public.rate_limit_windows where updated_at < now() - interval '1 day';
