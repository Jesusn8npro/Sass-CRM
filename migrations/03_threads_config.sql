-- ============================================================
-- Wizard conversacional para configurar el agente IA. 1 thread
-- por cuenta — al cerrar y volver, retoma donde quedó.
-- ============================================================

create table if not exists public.threads_config (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null unique references public.cuentas(id) on delete cascade,
  -- Mensajes del thread con formato AI SDK UIMessage
  mensajes jsonb not null default '[]'::jsonb,
  -- Snapshot del objeto que se va llenando (por si se cuelga)
  config_parcial jsonb not null default '{}'::jsonb,
  completado boolean not null default false,
  actualizado_en timestamptz not null default now()
);

comment on table public.threads_config is
  'Threads del wizard conversacional de configuración del agente IA.';

create index if not exists threads_config_cuenta_idx
  on public.threads_config(cuenta_id);

-- RLS
alter table public.threads_config enable row level security;

drop policy if exists "threads_config_select_owner" on public.threads_config;
create policy "threads_config_select_owner" on public.threads_config
  for select to authenticated
  using (
    cuenta_id in (
      select id from public.cuentas where usuario_id = auth.uid()
    )
  );
