-- ============================================================
-- Migración 09 — Onboarding wizard.
--
-- Aplicar manualmente en Supabase SQL Editor. Idempotente y defensiva.
--
-- Incluye:
--   1. Columna `completo_onboarding` en usuarios (flag final)
--   2. Columna `onboarding_paso` en usuarios (track del paso actual)
-- ============================================================

do $$
begin
  if to_regclass('public.usuarios') is not null then
    alter table public.usuarios
      add column if not exists completo_onboarding boolean not null default false;

    alter table public.usuarios
      add column if not exists onboarding_paso text default null;

    comment on column public.usuarios.completo_onboarding is
      'true = usuario terminó el wizard de onboarding (4 pasos).';
    comment on column public.usuarios.onboarding_paso is
      'Slug del paso actual: conectar | plantilla | productos | probar. Null si no empezó o si ya terminó.';
  else
    raise notice '[migración 09] public.usuarios no existe — saltando';
  end if;
end $$;
