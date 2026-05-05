-- ============================================================
-- 16_delays_y_memoria_contexto.sql
--
-- Dos features de comportamiento del agente, ambas configurables
-- por cuenta:
--
-- 1) Delay entre partes — cuando la IA contesta con N partes
--    (ej: "Hola!" + "¿Cómo estás?" + "Te cuento..."), entre cada
--    parte el bot espera X segundos mostrando "escribiendo..."
--    para que se vea natural y humano.
--
-- 2) Memoria a largo plazo — el LLM recibe los últimos N mensajes
--    literales (mensajes_contexto). Para conversaciones más largas,
--    si memoria_largo_plazo=true, se mantiene un resumen acumulativo
--    en conversaciones.resumen_contexto que se actualiza periódica-
--    mente con un modelo barato (gpt-4o-mini). Así se preserva
--    contexto sin explotar tokens.
--
-- Idempotente. No borra nada.
-- ============================================================

-- Configuración por cuenta
alter table public.cuentas
  add column if not exists delay_entre_partes_segundos numeric not null default 3
    check (delay_entre_partes_segundos between 0 and 30),
  add column if not exists mensajes_contexto int not null default 20
    check (mensajes_contexto between 5 and 200),
  add column if not exists memoria_largo_plazo boolean not null default true;

comment on column public.cuentas.delay_entre_partes_segundos is
  'Segundos a esperar entre cada parte que envía el agente. Default 3 = humano natural.';
comment on column public.cuentas.mensajes_contexto is
  'Cantidad de mensajes recientes que se mandan al LLM como contexto literal (ventana).';
comment on column public.cuentas.memoria_largo_plazo is
  'Si true, mantiene un resumen acumulativo de los mensajes anteriores a la ventana.';

-- Resumen acumulativo por conversación (memoria a largo plazo)
alter table public.conversaciones
  add column if not exists resumen_contexto text not null default '',
  add column if not exists resumido_hasta_en timestamptz;

comment on column public.conversaciones.resumen_contexto is
  'Resumen generado por IA de los mensajes anteriores a la ventana actual. Se actualiza cuando crece la conversación.';
comment on column public.conversaciones.resumido_hasta_en is
  'Fecha del último mensaje incorporado al resumen_contexto. Sirve para tomar sólo los nuevos al actualizar.';

-- Índice parcial — sólo conversaciones que ya tienen resumen.
-- Útil para tareas administrativas / debugging.
create index if not exists conversaciones_resumido_hasta_idx
  on public.conversaciones(resumido_hasta_en)
  where resumido_hasta_en is not null;
