-- 32: Broadcast programado — columnas para scheduling
-- programado_para: si está seteado, el broadcast se ejecuta a esa hora (vía cron).
-- conversacion_ids: lista de IDs de conversaciones destino (solo para pendientes).
-- estado ya existía como 'completado'; ahora admite 'pendiente' también.

ALTER TABLE public.broadcast_logs
  ADD COLUMN IF NOT EXISTS programado_para timestamptz,
  ADD COLUMN IF NOT EXISTS conversacion_ids jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS broadcast_logs_pendientes_idx
  ON public.broadcast_logs(programado_para)
  WHERE estado = 'pendiente' AND programado_para IS NOT NULL;
