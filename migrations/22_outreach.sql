-- ============================================================
-- Outreach pipeline: cold calling + cold email para leads extraidos.
-- Equivalente al esquema "leads" del video pipelineiq, adaptado a
-- nuestra tabla leads_extraidos existente.
--
-- Agrega:
--   · estado_outreach en leads_extraidos (new → queued → called →
--     emailed → completed → uncontactable | failed)
--   · metodo_contacto (llamada / email / ninguno)
--   · fuente_url (Google Maps URL del listing)
--   · outreach_actualizado_en (auto-updated timestamp)
--   · tabla outreach_call_logs (resultado de cada llamada Vapi)
--   · tabla outreach_email_logs (resultado de cada email Resend)
--
-- Aplicar manualmente en Supabase SQL Editor. Idempotente.
-- ============================================================

-- ============================================================
-- 1. Columnas nuevas en leads_extraidos
-- ============================================================

alter table public.leads_extraidos
  add column if not exists estado_outreach text not null default 'nuevo'
    check (estado_outreach in ('nuevo','en_cola','llamado','emaileado','completado','no_contactable','fallido')),
  add column if not exists metodo_contacto text
    check (metodo_contacto in ('llamada','email','ninguno')),
  add column if not exists fuente_url text,
  add column if not exists intentos_outreach int not null default 0,
  add column if not exists outreach_actualizado_en timestamptz not null default now();

-- Índice para que el orquestador lea rápido los leads nuevos por cuenta
create index if not exists leads_extraidos_outreach_idx
  on public.leads_extraidos(cuenta_id, estado_outreach);

-- Trigger para mantener outreach_actualizado_en al día
create or replace function public.set_outreach_actualizado_en()
returns trigger language plpgsql as $$
begin
  new.outreach_actualizado_en = now();
  return new;
end;
$$;

drop trigger if exists trg_leads_extraidos_outreach_ts on public.leads_extraidos;
create trigger trg_leads_extraidos_outreach_ts
  before update on public.leads_extraidos
  for each row execute function public.set_outreach_actualizado_en();

comment on column public.leads_extraidos.estado_outreach is
  'Estado en el pipeline de cold outreach: nuevo → en_cola → llamado/emaileado → completado | no_contactable | fallido';
comment on column public.leads_extraidos.metodo_contacto is
  'Canal elegido por el orquestador: llamada (tiene telefono), email (solo email), ninguno (sin datos de contacto)';

-- ============================================================
-- 2. Tabla outreach_call_logs
--    Registro de cada llamada Vapi disparada por el pipeline.
--    Equivalente a call_logs del video.
-- ============================================================

create table if not exists public.outreach_call_logs (
  id                uuid primary key default gen_random_uuid(),
  cuenta_id         uuid not null references public.cuentas(id) on delete cascade,
  lead_id           uuid not null references public.leads_extraidos(id) on delete cascade,
  vapi_call_id      text,
  resultado         text,        -- completed, no-answer, busy, failed, etc.
  transcripcion     text,
  url_grabacion     text,
  duracion_segundos int,
  costo_usd         numeric(10,4),
  resumen           text,
  creado_en         timestamptz not null default now()
);

create index if not exists outreach_call_logs_lead_idx
  on public.outreach_call_logs(lead_id);
create index if not exists outreach_call_logs_vapi_idx
  on public.outreach_call_logs(vapi_call_id);
create index if not exists outreach_call_logs_cuenta_idx
  on public.outreach_call_logs(cuenta_id, creado_en desc);

comment on table public.outreach_call_logs is
  'Log de llamadas Vapi disparadas por el pipeline de cold outreach. Una fila por intento de llamada.';

-- RLS
alter table public.outreach_call_logs enable row level security;

drop policy if exists "outreach_call_logs_select_owner" on public.outreach_call_logs;
create policy "outreach_call_logs_select_owner" on public.outreach_call_logs
  for select to authenticated
  using (
    cuenta_id in (
      select id from public.cuentas where usuario_id = auth.uid()
    )
  );

-- ============================================================
-- 3. Tabla outreach_email_logs
--    Registro de cada email Resend enviado por el pipeline.
--    Incluye los 3 pasos de la secuencia (inicial, día 3, día 7).
-- ============================================================

create table if not exists public.outreach_email_logs (
  id                uuid primary key default gen_random_uuid(),
  cuenta_id         uuid not null references public.cuentas(id) on delete cascade,
  lead_id           uuid not null references public.leads_extraidos(id) on delete cascade,
  resend_message_id text,
  paso              int not null default 1 check (paso in (1,2,3)),
  -- 1=inicial, 2=follow-up día 3, 3=follow-up día 7
  estado_envio      text not null default 'pendiente'
    check (estado_envio in ('pendiente','enviado','entregado','rebotado','spam','fallido')),
  programado_para   timestamptz,   -- cuándo se debe enviar (para pasos 2 y 3)
  enviado_en        timestamptz,
  creado_en         timestamptz not null default now()
);

create index if not exists outreach_email_logs_lead_idx
  on public.outreach_email_logs(lead_id);
create index if not exists outreach_email_logs_programado_idx
  on public.outreach_email_logs(estado_envio, programado_para)
  where estado_envio = 'enviado' and programado_para is not null;
create index if not exists outreach_email_logs_cuenta_idx
  on public.outreach_email_logs(cuenta_id, creado_en desc);

comment on table public.outreach_email_logs is
  'Log de emails Resend del pipeline de cold outreach. Tres pasos por lead: inicial, día 3, día 7.';

-- RLS
alter table public.outreach_email_logs enable row level security;

drop policy if exists "outreach_email_logs_select_owner" on public.outreach_email_logs;
create policy "outreach_email_logs_select_owner" on public.outreach_email_logs
  for select to authenticated
  using (
    cuenta_id in (
      select id from public.cuentas where usuario_id = auth.uid()
    )
  );
