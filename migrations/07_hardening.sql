-- ============================================================
-- Migración 07 — Hardening + base para billing automático.
--
-- Aplicar manualmente en Supabase SQL Editor. Idempotente.
-- DEFENSIVA: cada bloque verifica existencia de la tabla antes
-- de tocarla. Si la tabla no existe en este proyecto, el bloque
-- se skipea sin fallar.
--
-- Incluye:
--   1. Tabla `metering_uso` — registro fino de consumo OpenAI / Vapi /
--      ElevenLabs / Whisper por cuenta y día. Base para descontar
--      créditos automáticamente y para facturar con ePayco/PayPal.
--   2. Columnas `plan`, `estado_billing`, `pasarela` en `usuarios`
--      (stub — todavía no se aplica enforcement, sólo registramos).
--   3. Índices faltantes detectados sobre tablas hot del bot.
--   4. RLS de defensa en profundidad.
--   5. Vista resumen de uso por cuenta.
-- ============================================================

-- ------------------------------------------------------------
-- 1. metering_uso — base para billing automático
-- (esta tabla la creamos nosotros, no necesita guard)
-- ------------------------------------------------------------
do $$
begin
  if to_regclass('public.cuentas') is null then
    raise notice '[migración 07] La tabla public.cuentas no existe — abortando creación de metering_uso';
  else
    create table if not exists public.metering_uso (
      id uuid primary key default gen_random_uuid(),
      cuenta_id uuid not null references public.cuentas(id) on delete cascade,
      proveedor text not null check (proveedor in ('openai','vapi','elevenlabs','whisper','gemini','apify')),
      modelo text,
      tokens_in int not null default 0,
      tokens_out int not null default 0,
      caracteres int not null default 0,
      segundos int not null default 0,
      costo_usd numeric(12, 6) not null default 0,
      costo_creditos int not null default 0,
      metadata jsonb not null default '{}'::jsonb,
      creado_en timestamptz not null default now()
    );

    create index if not exists metering_uso_cuenta_creado_idx
      on public.metering_uso(cuenta_id, creado_en desc);
    create index if not exists metering_uso_proveedor_idx
      on public.metering_uso(proveedor, creado_en desc);

    comment on table public.metering_uso is
      'Registro de consumo de servicios externos por cuenta. Base para descuento de créditos y facturación.';
  end if;
end $$;

-- ------------------------------------------------------------
-- 2. Stub de billing en usuarios
-- ------------------------------------------------------------
do $$
begin
  if to_regclass('public.usuarios') is null then
    raise notice '[migración 07] public.usuarios no existe — skip billing stub';
  else
    alter table public.usuarios
      add column if not exists plan text not null default 'free';
    -- Constraint separada para soportar ALTER + IF NOT EXISTS:
    if not exists (
      select 1 from information_schema.constraint_column_usage
      where table_schema='public' and table_name='usuarios' and constraint_name='usuarios_plan_check'
    ) then
      alter table public.usuarios
        add constraint usuarios_plan_check check (plan in ('free','pro','business'));
    end if;

    alter table public.usuarios
      add column if not exists estado_billing text not null default 'activo';
    if not exists (
      select 1 from information_schema.constraint_column_usage
      where table_schema='public' and table_name='usuarios' and constraint_name='usuarios_estado_billing_check'
    ) then
      alter table public.usuarios
        add constraint usuarios_estado_billing_check check (estado_billing in ('activo','suspendido','impago','prueba'));
    end if;

    alter table public.usuarios add column if not exists pasarela text;
    if not exists (
      select 1 from information_schema.constraint_column_usage
      where table_schema='public' and table_name='usuarios' and constraint_name='usuarios_pasarela_check'
    ) then
      alter table public.usuarios
        add constraint usuarios_pasarela_check check (pasarela in ('epayco','paypal') or pasarela is null);
    end if;

    alter table public.usuarios add column if not exists pasarela_customer_id text;
    alter table public.usuarios add column if not exists vence_en timestamptz;

    create index if not exists usuarios_plan_idx on public.usuarios(plan);
    create index if not exists usuarios_estado_billing_idx on public.usuarios(estado_billing);
  end if;
end $$;

-- ------------------------------------------------------------
-- 3. Índices faltantes en tablas hot (cada una con su guard)
-- ------------------------------------------------------------

-- mensajes
do $$
begin
  if to_regclass('public.mensajes') is not null then
    create index if not exists mensajes_conv_creado_idx
      on public.mensajes(conversacion_id, creado_en desc);
    create index if not exists mensajes_cuenta_creado_idx
      on public.mensajes(cuenta_id, creado_en desc);
  else
    raise notice '[migración 07] public.mensajes no existe — skip índices';
  end if;
end $$;

-- conversaciones
do $$
begin
  if to_regclass('public.conversaciones') is not null then
    create index if not exists conversaciones_cuenta_jid_idx
      on public.conversaciones(cuenta_id, jid_wa);
    -- "ultimo_mensaje_en" puede no existir en todos los proyectos.
    -- Solo creamos el índice si la columna existe.
    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='conversaciones' and column_name='ultimo_mensaje_en'
    ) then
      create index if not exists conversaciones_cuenta_actualizado_idx
        on public.conversaciones(cuenta_id, ultimo_mensaje_en desc);
    end if;
  else
    raise notice '[migración 07] public.conversaciones no existe — skip índices';
  end if;
end $$;

-- bandeja_salida
do $$
begin
  if to_regclass('public.bandeja_salida') is not null then
    create index if not exists bandeja_salida_cuenta_pendiente_idx
      on public.bandeja_salida(cuenta_id, enviado, creado_en)
      where enviado = false;
  else
    raise notice '[migración 07] public.bandeja_salida no existe — skip índice';
  end if;
end $$;

-- notificaciones (la que falló — ahora con guard)
do $$
begin
  if to_regclass('public.notificaciones') is not null then
    create index if not exists notificaciones_usuario_creado_idx
      on public.notificaciones(usuario_id, creado_en desc);
    create index if not exists notificaciones_usuario_leida_idx
      on public.notificaciones(usuario_id, leida)
      where leida = false;
  else
    raise notice '[migración 07] public.notificaciones no existe — skip índices y RLS';
  end if;
end $$;

-- cuentas
do $$
begin
  if to_regclass('public.cuentas') is not null then
    create index if not exists cuentas_usuario_archivada_idx
      on public.cuentas(usuario_id, esta_archivada);
  end if;
end $$;

-- ------------------------------------------------------------
-- 4. RLS de defensa en profundidad
-- ------------------------------------------------------------

-- cuentas
do $$
begin
  if to_regclass('public.cuentas') is not null then
    execute 'alter table public.cuentas enable row level security';
    execute 'drop policy if exists "cuentas_dueno_select" on public.cuentas';
    execute $p$create policy "cuentas_dueno_select" on public.cuentas
      for select using (auth.uid() = usuario_id)$p$;
  end if;
end $$;

-- metering_uso
do $$
begin
  if to_regclass('public.metering_uso') is not null then
    execute 'alter table public.metering_uso enable row level security';
    execute 'drop policy if exists "metering_dueno_select" on public.metering_uso';
    execute $p$create policy "metering_dueno_select" on public.metering_uso
      for select using (
        exists (
          select 1 from public.cuentas c
          where c.id = metering_uso.cuenta_id and c.usuario_id = auth.uid()
        )
      )$p$;
  end if;
end $$;

-- notificaciones (con guard)
do $$
begin
  if to_regclass('public.notificaciones') is not null then
    execute 'alter table public.notificaciones enable row level security';
    execute 'drop policy if exists "notif_dueno_select" on public.notificaciones';
    execute $p$create policy "notif_dueno_select" on public.notificaciones
      for select using (auth.uid() = usuario_id)$p$;
  end if;
end $$;

-- ------------------------------------------------------------
-- 5. Vista resumen de uso por cuenta
-- ------------------------------------------------------------
do $$
begin
  if to_regclass('public.metering_uso') is not null then
    execute $v$
      create or replace view public.metering_resumen_mes as
      select
        cuenta_id,
        proveedor,
        date_trunc('month', creado_en) as mes,
        sum(tokens_in) as tokens_in,
        sum(tokens_out) as tokens_out,
        sum(caracteres) as caracteres,
        sum(segundos) as segundos,
        sum(costo_usd) as costo_usd,
        sum(costo_creditos) as costo_creditos,
        count(*) as eventos
      from public.metering_uso
      group by cuenta_id, proveedor, date_trunc('month', creado_en)
    $v$;

    execute $c$
      comment on view public.metering_resumen_mes is
        'Agregado mensual de consumo. Se consulta para dashboard del usuario y para cobros recurrentes.'
    $c$;
  end if;
end $$;
