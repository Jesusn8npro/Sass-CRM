-- ============================================================
-- 19_eventos_log.sql
--
-- Tabla de eventos de log para visibilidad operativa del SaaS.
-- Permite al admin ver desde el panel los errores/warnings/eventos
-- críticos del bot Baileys + procesadores periódicos sin tener que
-- entrar a EasyPanel a leer logs.
--
-- Niveles:
--   info     — eventos informativos relevantes (e.g., reconexión OK)
--   warn     — situaciones recuperables (retry de TTS, reconexión)
--   error    — excepción que afecta una operación puntual
--   critical — rompe el SaaS (cuenta caída >30min, OpenAI sin créditos)
--
-- Idempotente.
-- ============================================================

create table if not exists public.eventos_log (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid references public.cuentas(id) on delete set null,
  nivel text not null check (nivel in ('info','warn','error','critical')),
  contexto text not null,
  mensaje text not null,
  metadata jsonb,
  creado_en timestamptz not null default now()
);

create index if not exists eventos_log_creado_idx
  on public.eventos_log(creado_en desc);
create index if not exists eventos_log_nivel_idx
  on public.eventos_log(nivel, creado_en desc);
create index if not exists eventos_log_cuenta_idx
  on public.eventos_log(cuenta_id, creado_en desc) where cuenta_id is not null;

comment on table public.eventos_log is
  'Eventos de log del bot y procesadores. Visible desde /app/admin/logs.';
comment on column public.eventos_log.nivel is
  'info | warn | error | critical';
comment on column public.eventos_log.contexto is
  'Identificador corto del lugar de origen (e.g., openai.generarRespuesta, baileys.gestor.conflicto440).';
