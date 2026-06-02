-- 40_solicitudes_academia.sql
-- Solicitudes de seguimiento que llegan por webhook desde Academia Vallenata Online
-- (leads del chat web que dejaron WhatsApp y no completaron compra). El admin las
-- ve en el panel y dispara el mensaje de WhatsApp manualmente (o se podría automatizar).
-- Idempotente.

create table if not exists solicitudes_academia (
  id                     uuid primary key default gen_random_uuid(),
  evento                 text,
  nombre                 text,
  whatsapp               text not null,
  email                  text,
  ciudad                 text,
  que_quiere_aprender    text,
  nivel_acordeon         text,
  productos_consultados  jsonb default '[]'::jsonb,
  nivel_interes          int,
  pagina_origen          text,
  mensaje_sugerido       text,
  payload                jsonb,
  estado                 text not null default 'pendiente', -- pendiente | enviado | descartado | error
  error_envio            text,
  created_at             timestamptz not null default now(),
  enviado_at             timestamptz
);

create index if not exists idx_solicitudes_academia_estado
  on solicitudes_academia (estado, created_at desc);
