-- Tabla de ejecuciones del cron de blog (automáticas y manuales).
-- Aplicar en Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS blog_cron_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ejecutado_en    timestamptz NOT NULL DEFAULT now(),
  resultado       text NOT NULL CHECK (resultado IN ('publicado', 'error', 'saltado')),
  disparado_por   text NOT NULL DEFAULT 'cron' CHECK (disparado_por IN ('cron', 'manual')),
  slug_articulo   text,
  titulo_articulo text,
  categoria       text,
  ms_total        int,
  error_mensaje   text
);

CREATE INDEX IF NOT EXISTS idx_blog_cron_runs_fecha ON blog_cron_runs (ejecutado_en DESC);

COMMENT ON TABLE blog_cron_runs IS 'Historial de ejecuciones del cron de generación automática de artículos.';

ALTER TABLE blog_cron_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "blog_cron_runs_service_only" ON blog_cron_runs;
CREATE POLICY "blog_cron_runs_service_only" ON blog_cron_runs USING (false) WITH CHECK (false);
