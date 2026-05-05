-- ============================================================
-- 14 — Índices en foreign keys faltantes
--
-- Postgres NO crea índice automático en columnas FK. Sin índice,
-- ON DELETE CASCADE escanea toda la tabla referenciada — fatal
-- cuando borrás una conversación con muchos hijos.
-- Detectado por advisor 0001_unindexed_foreign_keys.
-- ============================================================

create index if not exists bandeja_salida_conversacion_idx
  on public.bandeja_salida(conversacion_id);

create index if not exists contactos_email_conversacion_idx
  on public.contactos_email(conversacion_id);

create index if not exists contactos_telefono_conversacion_idx
  on public.contactos_telefono(conversacion_id);

create index if not exists conv_prod_interes_producto_idx
  on public.conversacion_productos_interes(producto_id);

create index if not exists conversaciones_etapa_idx
  on public.conversaciones(etapa_id);

create index if not exists leads_extraidos_conversacion_idx
  on public.leads_extraidos(conversacion_id);

create index if not exists llamadas_programadas_assistant_idx
  on public.llamadas_programadas(assistant_id);
create index if not exists llamadas_programadas_conversacion_idx
  on public.llamadas_programadas(conversacion_id);
create index if not exists llamadas_programadas_llamada_vapi_idx
  on public.llamadas_programadas(llamada_vapi_id);

create index if not exists pagos_cuenta_idx
  on public.pagos(cuenta_id);
