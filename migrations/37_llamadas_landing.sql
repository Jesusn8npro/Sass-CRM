-- Llamadas desde el widget de voz de la landing page (demo público)
create table if not exists public.llamadas_landing (
  id               uuid primary key default gen_random_uuid(),
  vapi_call_id     text not null unique,
  ip               text,
  transcripcion    text,
  resumen          text,
  duracion_seg     int,
  costo_usd        numeric(10,4),
  datos_negocio    jsonb,   -- structuredData capturado por el asistente
  creado_en        timestamptz not null default now(),
  terminada_en     timestamptz
);

create index if not exists llamadas_landing_vapi_idx   on public.llamadas_landing (vapi_call_id);
create index if not exists llamadas_landing_creado_idx on public.llamadas_landing (creado_en desc);
