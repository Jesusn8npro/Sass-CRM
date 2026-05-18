-- ============================================================
-- Super-Admin global del SaaS
--
-- A diferencia del "admin por cuenta" (cada user dueño de su número
-- de WhatsApp), aquí modelamos al dueño de la PLATAFORMA. Vos como
-- operador del SaaS podés:
--   - Recibir reportes diarios en tu WhatsApp
--   - Mandar comandos desde tu WhatsApp para ver métricas, pausar
--     cuentas, generar contenido, etc.
--   - Acceder al panel /admin con métricas globales del negocio.
--
-- Tabla principal: public.super_admins
-- Audit trail:     public.admin_acciones
--
-- Idempotente. Aplicar manualmente en Supabase SQL Editor.
-- ============================================================

-- 1) Tabla de super admins (vos y eventualmente tu equipo)
create table if not exists public.super_admins (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  telefono_whatsapp text not null,           -- E.164 sin "+", ej: 573123790071
  nombre text,
  activo boolean not null default true,
  -- Última vez que se le mandó el reporte diario (anti-duplicado del cron)
  ultimo_reporte_diario_en timestamptz,
  creado_en timestamptz not null default now()
);

comment on table public.super_admins is
  'Dueños/operadores de la plataforma SaaS. Reciben reportes y pueden controlar todo el sistema via WhatsApp o el panel /admin.';

comment on column public.super_admins.telefono_whatsapp is
  'Número en formato E.164 SIN el "+". Se compara contra el telefonoMostrable del manejador Baileys.';

create unique index if not exists super_admins_telefono_idx
  on public.super_admins(telefono_whatsapp);

-- 2) Audit trail: cada comando admin queda registrado
create table if not exists public.admin_acciones (
  id uuid primary key default gen_random_uuid(),
  super_admin_id uuid not null references public.super_admins(id) on delete cascade,
  -- Origen del comando: "whatsapp" | "panel" | "cron"
  origen text not null check (origen in ('whatsapp', 'panel', 'cron')),
  -- Tipo de acción ejecutada: "reporte_diario", "usuarios_listar",
  -- "cuenta_pausar", "post_crear", "video_generar", etc.
  accion text not null,
  -- Payload de entrada (parámetros del comando) y resultado de salida
  payload jsonb,
  resultado jsonb,
  -- Si hubo error, lo guardamos para debugging
  error text,
  creado_en timestamptz not null default now()
);

comment on table public.admin_acciones is
  'Log inmutable de cada acción ejecutada por un super-admin. Sirve para auditoría y debug de comandos WhatsApp.';

create index if not exists admin_acciones_admin_idx
  on public.admin_acciones(super_admin_id, creado_en desc);
create index if not exists admin_acciones_accion_idx
  on public.admin_acciones(accion, creado_en desc);

-- 3) Función helper: ¿este email es super admin?
-- Se usa desde policies RLS y desde el código TypeScript.
create or replace function public.es_super_admin(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.super_admins
    where lower(email) = lower(p_email)
      and activo = true
  );
$$;

comment on function public.es_super_admin(text) is
  'Devuelve true si el email pertenece a un super-admin activo. Usado en policies RLS.';

-- Revoke execute de roles públicos — solo policies y service_role la deben usar.
revoke execute on function public.es_super_admin(text) from anon, authenticated;

-- 4) RLS — sólo los super admins activos pueden ver/modificar
alter table public.super_admins enable row level security;
alter table public.admin_acciones enable row level security;

-- Policies super_admins: solo super-admins se ven entre sí
drop policy if exists "super_admins_select" on public.super_admins;
create policy "super_admins_select" on public.super_admins
  for select to authenticated
  using (public.es_super_admin((auth.jwt() ->> 'email')::text));

drop policy if exists "super_admins_update" on public.super_admins;
create policy "super_admins_update" on public.super_admins
  for update to authenticated
  using (public.es_super_admin((auth.jwt() ->> 'email')::text));

-- Policies admin_acciones: solo super-admins
drop policy if exists "admin_acciones_select" on public.admin_acciones;
create policy "admin_acciones_select" on public.admin_acciones
  for select to authenticated
  using (public.es_super_admin((auth.jwt() ->> 'email')::text));

-- 5) Arreglar la advisory crítica: RLS en eventos_log
-- Solo super-admins pueden ver los logs del bot.
alter table public.eventos_log enable row level security;

drop policy if exists "eventos_log_super_admin_select" on public.eventos_log;
create policy "eventos_log_super_admin_select" on public.eventos_log
  for select to authenticated
  using (public.es_super_admin((auth.jwt() ->> 'email')::text));

-- 6) Seed inicial: el dueño del SaaS (acordeon91@gmail.com / +573123790071)
-- El INSERT es idempotente vía ON CONFLICT DO NOTHING — si ya existe, no lo pisa.
insert into public.super_admins (email, telefono_whatsapp, nombre, activo)
values ('acordeon91@gmail.com', '573123790071', 'Admin Global', true)
on conflict (email) do nothing;
