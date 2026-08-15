-- ============================================================
-- 42 · Playbook de objeciones del cerrador
--
-- Adaptado de whatsapp-closer-agentkit: el negocio escribe CÓMO se
-- contesta cada objeción, en vez de dejar que el modelo improvise una
-- respuesta comercial distinta en cada conversación.
--
-- Dos objeciones son especiales y van marcadas con `clave`:
--   descuento · garantia
-- No son contenido opcional: son la regla de "no inventes condiciones
-- comerciales" escrita como copy de ventas. En vez de una negativa seca,
-- derivan a una persona. Un agente que promete un descuento se lo hace
-- pagar al negocio.
--
-- Idempotente. Aplicar en Supabase SQL Editor.
-- ============================================================

alter table cuentas
  add column if not exists playbook_objeciones jsonb not null default '[]'::jsonb;

alter table cuentas
  add column if not exists playbook_activo boolean not null default false;

comment on column cuentas.playbook_objeciones is
  'Array de {objecion, respuesta, clave?}. `clave` sólo vale "descuento" o "garantia" (el piso obligatorio). Se inyecta en el system prompt cuando playbook_activo = true.';

comment on column cuentas.playbook_activo is
  'Si es false el bloque de objeciones no se inyecta en el prompt, aunque haya objeciones cargadas.';
