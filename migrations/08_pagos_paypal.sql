-- ============================================================
-- Migración 08 — Pagos y suscripciones (PayPal).
--
-- Aplicar manualmente en Supabase SQL Editor. Idempotente y defensiva.
--
-- Incluye:
--   1. Columnas paypal_subscription_id, paypal_plan_id en usuarios
--   2. Tabla `pagos` — historial de transacciones (suscripciones + recargas)
--   3. Tabla `paquetes_creditos` — catálogo de packs de recarga
--   4. Índices y RLS
-- ============================================================

-- 1. Columnas extra en usuarios -------------------------------
do $$
begin
  if to_regclass('public.usuarios') is not null then
    alter table public.usuarios add column if not exists paypal_subscription_id text;
    alter table public.usuarios add column if not exists paypal_plan_id text;
    create index if not exists usuarios_paypal_sub_idx on public.usuarios(paypal_subscription_id);
  end if;
end $$;

-- 2. Tabla pagos ----------------------------------------------
do $$
begin
  if to_regclass('public.usuarios') is null then
    raise notice '[migración 08] public.usuarios no existe — saltando creación de pagos';
  else
    create table if not exists public.pagos (
      id uuid primary key default gen_random_uuid(),
      usuario_id uuid not null references public.usuarios(id) on delete cascade,
      cuenta_id uuid references public.cuentas(id) on delete set null,
      tipo text not null check (tipo in ('suscripcion','recarga_creditos','renovacion','reembolso')),
      pasarela text not null default 'paypal' check (pasarela in ('paypal','epayco')),
      monto_usd numeric(12, 2) not null check (monto_usd >= 0),
      creditos_otorgados int not null default 0,
      estado text not null check (estado in ('pendiente','aprobado','fallido','reembolsado','cancelado')),
      -- IDs externos
      paypal_order_id text,
      paypal_subscription_id text,
      paypal_capture_id text,
      -- metadata libre
      metadata jsonb not null default '{}'::jsonb,
      creado_en timestamptz not null default now(),
      procesado_en timestamptz
    );

    create index if not exists pagos_usuario_creado_idx on public.pagos(usuario_id, creado_en desc);
    create index if not exists pagos_estado_idx on public.pagos(estado);
    create index if not exists pagos_paypal_order_idx on public.pagos(paypal_order_id) where paypal_order_id is not null;
    create index if not exists pagos_paypal_sub_idx on public.pagos(paypal_subscription_id) where paypal_subscription_id is not null;

    comment on table public.pagos is
      'Historial de transacciones. Incluye suscripciones, renovaciones y recargas one-time.';
  end if;
end $$;

-- 3. Tabla paquetes_creditos (catálogo) -----------------------
create table if not exists public.paquetes_creditos (
  id text primary key,
  nombre text not null,
  creditos int not null check (creditos > 0),
  precio_usd numeric(10, 2) not null check (precio_usd > 0),
  destacado boolean not null default false,
  orden int not null default 100,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

-- Seed de paquetes default (idempotente con on conflict)
insert into public.paquetes_creditos (id, nombre, creditos, precio_usd, destacado, orden) values
  ('starter', 'Starter', 100, 5.00, false, 10),
  ('growth', 'Growth', 300, 12.00, true, 20),
  ('scale', 'Scale', 800, 25.00, false, 30),
  ('pro', 'Pro Pack', 2000, 55.00, false, 40)
on conflict (id) do update set
  nombre = excluded.nombre,
  creditos = excluded.creditos,
  precio_usd = excluded.precio_usd,
  destacado = excluded.destacado,
  orden = excluded.orden;

comment on table public.paquetes_creditos is
  'Packs de créditos disponibles para compra one-time.';

-- 4. RLS de defensa -------------------------------------------
do $$
begin
  if to_regclass('public.pagos') is not null then
    execute 'alter table public.pagos enable row level security';
    execute 'drop policy if exists "pagos_dueno_select" on public.pagos';
    execute 'create policy "pagos_dueno_select" on public.pagos for select using (auth.uid() = usuario_id)';
  end if;

  -- paquetes son públicos (cualquiera logueado puede leerlos)
  alter table public.paquetes_creditos enable row level security;
  drop policy if exists "paquetes_lectura_publica" on public.paquetes_creditos;
  create policy "paquetes_lectura_publica" on public.paquetes_creditos
    for select using (activo = true);
end $$;
