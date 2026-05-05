-- ============================================================
-- 18_humanizado_emojis.sql
--
-- Dos toggles "de fábrica" para el comportamiento del agente que
-- los usuarios suelen pedir y que antes había que poner a mano en
-- el prompt:
--
-- 1) responder_humanizado (default true) — el agente prioriza
--    respuestas naturales, conversacionales, como un humano. Evita
--    frases robóticas, listas largas, formalidades excesivas.
--
-- 2) usar_emojis (default false) — si false, el agente NUNCA usa
--    emojis. Si true, los usa con moderación cuando suman a la
--    comunicación. Default false porque varios negocios prefieren
--    tono más serio/profesional.
--
-- Las reglas se inyectan dinámicamente en el system prompt vía
-- construirPrompt.ts. No reemplazan el prompt_sistema custom — se
-- agregan en bloques aparte de prioridad alta.
--
-- Idempotente.
-- ============================================================

alter table public.cuentas
  add column if not exists responder_humanizado boolean not null default true,
  add column if not exists usar_emojis boolean not null default false;

comment on column public.cuentas.responder_humanizado is
  'Si true, el agente prioriza respuestas naturales y conversacionales. Default true.';
comment on column public.cuentas.usar_emojis is
  'Si true, el agente puede usar emojis con moderación. Si false, NO usa ninguno. Default false (tono más profesional).';
