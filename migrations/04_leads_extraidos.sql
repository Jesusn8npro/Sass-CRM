-- ============================================================
-- Bandeja de leads extraidos via Apify. Antes: cada item se
-- creaba como conversacion automaticamente (ruidoso). Ahora: el
-- user ve los leads en una tabla y decide cuales importar al CRM.
--
-- Aplicar manualmente en Supabase SQL Editor. Idempotente.
-- ============================================================

create table if not exists public.leads_extraidos (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references public.cuentas(id) on delete cascade,
  run_apify_id uuid not null references public.runs_apify(id) on delete cascade,
  -- Campos normalizados para mostrar en tabla
  nombre text not null,
  telefono text,
  email text,
  direccion text,
  sitio_web text,
  categoria text,
  -- Item completo de Apify (por si queremos campos extra despues)
  raw jsonb not null default '{}'::jsonb,
  -- Si el user le dio "Importar a CRM"
  importado boolean not null default false,
  conversacion_id uuid references public.conversaciones(id) on delete set null,
  creado_en timestamptz not null default now()
);

create index if not exists leads_extraidos_run_idx
  on public.leads_extraidos(run_apify_id);
create index if not exists leads_extraidos_cuenta_creado_idx
  on public.leads_extraidos(cuenta_id, creado_en desc);
create index if not exists leads_extraidos_importado_idx
  on public.leads_extraidos(cuenta_id, importado);

comment on table public.leads_extraidos is
  'Bandeja de leads extraidos por Apify. No se crean conversaciones hasta que el user los importa explicitamente.';

-- RLS
alter table public.leads_extraidos enable row level security;

drop policy if exists "leads_extraidos_select_owner" on public.leads_extraidos;
create policy "leads_extraidos_select_owner" on public.leads_extraidos
  for select to authenticated
  using (
    cuenta_id in (
      select id from public.cuentas where usuario_id = auth.uid()
    )
  );
