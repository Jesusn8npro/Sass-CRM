-- 40_leads_chat_web.sql
-- Leads que llegan desde el chat/formulario web del CLIENTE (multi-tenant, por cuenta).
-- Cada cuenta tiene un token_chat_web que su widget usa para ingresar leads sin sesión.
-- Idempotente.

create table if not exists leads_chat_web (
  id               uuid primary key default gen_random_uuid(),
  cuenta_id        uuid not null references cuentas(id) on delete cascade,
  nombre           text,
  email            text,
  whatsapp         text,
  interes          text,                 -- qué busca / producto / tema
  mensaje          text,                 -- consulta o resumen del chat
  origen_url       text,                 -- página/sitio donde se capturó
  mensaje_sugerido text,                 -- mensaje propuesto para el seguimiento
  extra            jsonb not null default '{}'::jsonb,
  estado           text not null default 'nuevo',  -- nuevo | enviado | descartado | error
  error_envio      text,
  created_at       timestamptz not null default now(),
  enviado_at       timestamptz
);

create index if not exists idx_leads_chat_web_cuenta
  on leads_chat_web (cuenta_id, estado, created_at desc);

-- Token por cuenta para ingestar leads desde el widget del cliente.
alter table cuentas add column if not exists token_chat_web text;
create unique index if not exists ux_cuentas_token_chat_web
  on cuentas (token_chat_web) where token_chat_web is not null;
