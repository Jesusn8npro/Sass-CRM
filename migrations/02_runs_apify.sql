-- ============================================================
-- Apify lead-gen: tabla de jobs lanzados a la plataforma Apify
-- y log de items importados a contactos_email/contactos_telefono.
--
-- Aplicar manualmente en Supabase SQL Editor. Idempotente.
-- ============================================================

create table if not exists public.runs_apify (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references public.cuentas(id) on delete cascade,
  -- ID del actor en Apify (ej: "lukaskrivka/google-maps-with-contact-details")
  actor_id text not null,
  -- Input completo enviado a Apify (búsqueda, filtros, etc).
  input jsonb not null,
  -- IDs que devuelve Apify al lanzar el run
  apify_run_id text,
  apify_dataset_id text,
  estado text not null default 'corriendo'
    check (estado in ('corriendo', 'completado', 'fallido', 'abortado')),
  items_count int not null default 0,
  costo_creditos int not null default 0,
  costo_usd numeric(10, 6),
  error text,
  creado_en timestamptz not null default now(),
  completado_en timestamptz
);

create index if not exists runs_apify_cuenta_creado_idx
  on public.runs_apify(cuenta_id, creado_en desc);
create index if not exists runs_apify_apify_run_id_idx
  on public.runs_apify(apify_run_id);

comment on table public.runs_apify is
  'Jobs de scraping en Apify lanzados desde el panel.';

-- RLS
alter table public.runs_apify enable row level security;

drop policy if exists "runs_apify_select_owner" on public.runs_apify;
create policy "runs_apify_select_owner" on public.runs_apify
  for select to authenticated
  using (
    cuenta_id in (
      select id from public.cuentas where usuario_id = auth.uid()
    )
  );
