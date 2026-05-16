-- 31: Reintentos y estado fallido en bandeja_salida
-- Aplicado manualmente. Esta migración documenta los cambios ya aplicados.

ALTER TABLE public.bandeja_salida
  ADD COLUMN IF NOT EXISTS intentos int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fallido boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS bandeja_salida_pendientes_idx
  ON public.bandeja_salida(cuenta_id, creado_en)
  WHERE enviado = false AND fallido = false;
