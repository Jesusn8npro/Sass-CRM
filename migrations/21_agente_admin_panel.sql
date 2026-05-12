-- ============================================================
-- Agente Admin Global del SaaS
--
-- Habilita que UNA cuenta del SaaS funcione como "canal admin"
-- dedicado para el super-admin (Patrón) del SaaS:
--
--   - Si la cuenta tiene es_panel_admin = true, el manejador
--     Baileys solo procesa mensajes ENTRANTES si el remitente
--     está en `super_admins`. Los demás se IGNORAN silenciosos
--     (no se guarda mensaje, no responde, no consume tokens IA).
--
--   - Los mensajes del super-admin se procesan con el agente
--     conversacional (Claude Haiku 4.5 con tool calling) que
--     responde en lenguaje natural y ejecuta herramientas
--     (generar artículo, obtener métricas, listar borradores).
--
-- Idempotente. Aplicar manualmente en Supabase SQL Editor.
-- ============================================================

alter table public.cuentas
  add column if not exists es_panel_admin boolean not null default false;

comment on column public.cuentas.es_panel_admin is
  'Si true, esta cuenta es el canal admin dedicado del super-admin. Solo procesa mensajes entrantes del remitente en super_admins; los demás se ignoran silenciosos.';

-- Índice parcial para query rápida en el manejador Baileys
-- (lookup por id de cuenta admin debe ser O(1))
create index if not exists cuentas_panel_admin_idx
  on public.cuentas(es_panel_admin)
  where es_panel_admin = true;
