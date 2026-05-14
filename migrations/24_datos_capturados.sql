-- migración 24: columna datos_capturados en prospeccion_llamadas
-- Guarda el JSON estructurado que extrae Vapi al final de cada llamada:
-- nombre del contacto, email, cargo, nivel de interés, reunión agendada, etc.

alter table public.outreach_call_logs
  add column if not exists datos_capturados jsonb;

comment on column public.outreach_call_logs.datos_capturados is
  'Datos estructurados extraídos por Vapi al finalizar la llamada (nombre, email, cargo, interés, reunión).';
