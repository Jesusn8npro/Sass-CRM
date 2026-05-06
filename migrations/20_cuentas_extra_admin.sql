-- ============================================================
-- 20_cuentas_extra_admin.sql
--
-- El admin de la plataforma puede otorgar a un usuario específico
-- cuentas WhatsApp adicionales más allá del cupo de su plan, sin
-- necesidad de upgradearlo. Útil para:
--  - Clientes en período de prueba.
--  - Negocios que necesitan 1-2 cuentas más sin saltar a Pro completo.
--  - Compensaciones por incidencias.
--
-- Límite efectivo del usuario = plan.limite_cuentas + cuentas_extra_admin.
-- Default 0 — comportamiento histórico (solo plan manda).
--
-- Idempotente.
-- ============================================================

alter table public.usuarios
  add column if not exists cuentas_extra_admin int not null default 0
    check (cuentas_extra_admin between 0 and 100);

comment on column public.usuarios.cuentas_extra_admin is
  'Cuentas WhatsApp adicionales otorgadas manualmente por el admin sobre el cupo del plan. Solo el admin puede modificar este campo.';
