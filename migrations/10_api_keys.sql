-- ============================================================
-- Migración 10 — API Keys públicas (Zapier / Make / n8n).
--
-- Aplicar manualmente en Supabase SQL Editor. Idempotente y
-- defensiva: cada bloque verifica que existan las tablas
-- referenciadas antes de crear nada.
--
-- Modelo:
--   - Cada key pertenece a UNA cuenta (scopeada).
--   - Guardamos solo SHA-256 de la key real (nunca plaintext).
--   - `prefijo` permite mostrar "sk_live_xxxx…" en la UI.
--   - `permisos` es un allowlist simple ['read','write'].
--   - Soporta revocación (revocada_en) y expiración (expira_en).
-- ============================================================

do $$
begin
  if to_regclass('public.cuentas') is null
     or to_regclass('public.usuarios') is null then
    raise notice '[migración 10] cuentas o usuarios no existen — saltando';
  else
    create table if not exists public.api_keys (
      id uuid primary key default gen_random_uuid(),
      cuenta_id uuid not null references public.cuentas(id) on delete cascade,
      usuario_id uuid not null references public.usuarios(id) on delete cascade,
      nombre text not null,
      clave_hash text not null unique,
      prefijo text not null,
      permisos text[] not null default '{}',
      ultima_uso_en timestamptz,
      revocada_en timestamptz,
      expira_en timestamptz,
      creado_en timestamptz not null default now()
    );

    create index if not exists api_keys_clave_hash_idx
      on public.api_keys(clave_hash);
    create index if not exists api_keys_cuenta_idx
      on public.api_keys(cuenta_id, creado_en desc);

    comment on table public.api_keys is
      'API keys opaque para integraciones externas (Zapier/Make/n8n). Hash SHA-256, scope por cuenta.';
    comment on column public.api_keys.clave_hash is
      'SHA-256 hex de la clave plaintext. La clave plaintext NO se guarda — solo se devuelve UNA VEZ al crear.';
    comment on column public.api_keys.prefijo is
      'Primeros 8 chars visibles de la clave para mostrar en UI (ej: sk_live_).';
    comment on column public.api_keys.permisos is
      'Allowlist de operaciones. Empezamos con [read, write].';

    -- RLS: defensa en profundidad. La auth real la hace el endpoint
    -- via cliente admin; igual prevenimos accesos accidentales con la
    -- anon key.
    execute 'alter table public.api_keys enable row level security';
    execute 'drop policy if exists "api_keys_dueno_select" on public.api_keys';
    execute $p$create policy "api_keys_dueno_select" on public.api_keys
      for select using (
        exists (
          select 1 from public.cuentas c
          where c.id = api_keys.cuenta_id and c.usuario_id = auth.uid()
        )
      )$p$;
  end if;
end $$;
