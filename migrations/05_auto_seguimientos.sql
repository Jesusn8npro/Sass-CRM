-- ============================================================
-- Auto-seguimientos: el agente envía recordatorios al cliente
-- automaticamente si deja de responder.
--
-- Patron: el dueño define una secuencia de pasos en la pagina de
-- configuracion. Cada paso = "esperar X minutos desde el ultimo
-- mensaje del bot, y mandar este texto si el cliente no respondio".
-- Si el cliente responde, el contador se resetea al paso 0.
--
-- Aplicar manualmente en Supabase SQL Editor. Idempotente.
-- ============================================================

-- 1) Toggle global por cuenta
alter table public.cuentas
  add column if not exists auto_seguimiento_activo boolean not null default false;

comment on column public.cuentas.auto_seguimiento_activo is
  'Si true, el procesador de auto-seguimientos puede agendar recordatorios para conversaciones de esta cuenta.';

-- 2) Tabla de pasos configurados — orden importa
create table if not exists public.auto_seguimientos_pasos (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references public.cuentas(id) on delete cascade,
  -- 1 = primer recordatorio, 2 = segundo, etc.
  orden int not null check (orden >= 1),
  -- Minutos a esperar DESDE EL ULTIMO MENSAJE DEL BOT/HUMANO
  -- (no acumulativo entre pasos — cada uno se mide desde el
  -- último mensaje del bot, no desde el paso anterior).
  minutos_despues int not null check (minutos_despues >= 1),
  mensaje text not null check (length(mensaje) >= 1 and length(mensaje) <= 2000),
  creado_en timestamptz not null default now(),
  unique (cuenta_id, orden)
);

create index if not exists auto_seg_pasos_cuenta_idx
  on public.auto_seguimientos_pasos(cuenta_id, orden);

comment on table public.auto_seguimientos_pasos is
  'Secuencia de recordatorios automaticos por cuenta. El procesador los envia en orden cuando el cliente deja de responder.';

-- 3) Tracking por conversacion: cuántos pasos ya se enviaron
alter table public.conversaciones
  add column if not exists auto_seg_paso_enviado int not null default 0;

comment on column public.conversaciones.auto_seg_paso_enviado is
  'Cantidad de pasos de auto-seguimiento ya disparados en esta conversacion. Se resetea a 0 cuando el cliente responde.';

-- 4) RLS para los pasos — cada user solo ve los suyos
alter table public.auto_seguimientos_pasos enable row level security;

drop policy if exists "auto_seg_pasos_select_owner" on public.auto_seguimientos_pasos;
create policy "auto_seg_pasos_select_owner" on public.auto_seguimientos_pasos
  for select to authenticated
  using (
    cuenta_id in (
      select id from public.cuentas where usuario_id = auth.uid()
    )
  );
