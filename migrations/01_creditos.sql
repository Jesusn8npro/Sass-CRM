-- ============================================================
-- Sistema de créditos para features de IA (Apify, generación
-- de imágenes, etc). Aplicable a multi-tenant: una fila de
-- saldo por cuenta + log de uso para auditoría / analytics.
--
-- Aplicar en Supabase SQL Editor manualmente la primera vez.
-- Idempotente: se puede correr múltiples veces sin romper nada.
-- ============================================================

-- ----------------------------------------------------------
-- Tabla de saldo (1 fila por cuenta)
-- ----------------------------------------------------------
create table if not exists public.creditos (
  cuenta_id uuid primary key references public.cuentas(id) on delete cascade,
  saldo_actual int not null default 50 check (saldo_actual >= 0),
  saldo_mensual int not null default 50,
  proximo_reset timestamptz not null default (now() + interval '30 days'),
  actualizado_en timestamptz not null default now()
);

comment on table public.creditos is
  'Saldo de créditos por cuenta. 1 crédito ≈ $0.10 USD valor cliente.';

-- ----------------------------------------------------------
-- Log de uso (auditoría + analytics)
-- ----------------------------------------------------------
create table if not exists public.uso_creditos (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references public.cuentas(id) on delete cascade,
  tipo text not null,
  costo_creditos int not null check (costo_creditos > 0),
  costo_usd numeric(10, 6),
  metadata jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now()
);

create index if not exists uso_creditos_cuenta_creado_idx
  on public.uso_creditos(cuenta_id, creado_en desc);

comment on table public.uso_creditos is
  'Log inmutable de cada consumo de créditos. Para analytics y disputa.';

-- ----------------------------------------------------------
-- RPC atómico: descuenta + loggea en una sola transacción.
-- Devuelve true si descontó, false si no había saldo.
-- ----------------------------------------------------------
create or replace function public.descontar_creditos(
  p_cuenta_id uuid,
  p_tipo text,
  p_costo_creditos int,
  p_costo_usd numeric default null,
  p_metadata jsonb default '{}'::jsonb
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_saldo int;
begin
  -- Lock pesimista para evitar race con concurrent calls
  select saldo_actual into v_saldo
    from public.creditos
    where cuenta_id = p_cuenta_id
    for update;

  -- Sin fila → falla limpio (trigger debería haberla creado)
  if v_saldo is null then
    return false;
  end if;

  if v_saldo < p_costo_creditos then
    return false;
  end if;

  update public.creditos
    set saldo_actual = saldo_actual - p_costo_creditos,
        actualizado_en = now()
    where cuenta_id = p_cuenta_id;

  insert into public.uso_creditos
    (cuenta_id, tipo, costo_creditos, costo_usd, metadata)
    values (p_cuenta_id, p_tipo, p_costo_creditos, p_costo_usd, p_metadata);

  return true;
end;
$$;

-- ----------------------------------------------------------
-- RPC para sumar créditos (renovación mensual, regalo, refund)
-- ----------------------------------------------------------
create or replace function public.agregar_creditos(
  p_cuenta_id uuid,
  p_cantidad int
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_cantidad <= 0 then
    raise exception 'cantidad debe ser positiva';
  end if;

  update public.creditos
    set saldo_actual = saldo_actual + p_cantidad,
        actualizado_en = now()
    where cuenta_id = p_cuenta_id;

  -- Si la cuenta no tenía fila (caso borde), la creamos
  if not found then
    insert into public.creditos (cuenta_id, saldo_actual)
      values (p_cuenta_id, p_cantidad);
  end if;
end;
$$;

-- ----------------------------------------------------------
-- Trigger: cuenta nueva → fila de créditos con saldo inicial
-- ----------------------------------------------------------
create or replace function public.crear_creditos_iniciales()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.creditos (cuenta_id, saldo_actual, saldo_mensual)
    values (new.id, 50, 50)
    on conflict (cuenta_id) do nothing;
  return new;
end;
$$;

drop trigger if exists crear_creditos_al_crear_cuenta on public.cuentas;
create trigger crear_creditos_al_crear_cuenta
  after insert on public.cuentas
  for each row execute function public.crear_creditos_iniciales();

-- ----------------------------------------------------------
-- Backfill: cuentas que ya existen sin fila de créditos
-- ----------------------------------------------------------
insert into public.creditos (cuenta_id, saldo_actual, saldo_mensual)
  select id, 50, 50 from public.cuentas
  on conflict (cuenta_id) do nothing;

-- ----------------------------------------------------------
-- Row Level Security: cada usuario solo ve los créditos de
-- las cuentas que le pertenecen.
-- ----------------------------------------------------------
alter table public.creditos enable row level security;
alter table public.uso_creditos enable row level security;

drop policy if exists "creditos_select_owner" on public.creditos;
create policy "creditos_select_owner" on public.creditos
  for select to authenticated
  using (
    cuenta_id in (
      select id from public.cuentas where usuario_id = auth.uid()
    )
  );

drop policy if exists "uso_creditos_select_owner" on public.uso_creditos;
create policy "uso_creditos_select_owner" on public.uso_creditos
  for select to authenticated
  using (
    cuenta_id in (
      select id from public.cuentas where usuario_id = auth.uid()
    )
  );

-- INSERT/UPDATE quedan bloqueadas para clientes con anon/authenticated.
-- Solo el service_role (que usa el server) puede modificar — eso es
-- exactamente lo que queremos: nunca confiar en el cliente para créditos.
