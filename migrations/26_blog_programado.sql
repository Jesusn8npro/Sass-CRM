-- Agrega publicación programada a articulos_blog.
-- Idempotente: usa IF NOT EXISTS / DO NOTHING.

ALTER TABLE articulos_blog
  ADD COLUMN IF NOT EXISTS programado_para timestamptz DEFAULT NULL;

-- Índice para que el cron busque rápido borradores listos para publicar
CREATE INDEX IF NOT EXISTS idx_articulos_blog_programado
  ON articulos_blog (programado_para)
  WHERE estado = 'borrador' AND programado_para IS NOT NULL;

COMMENT ON COLUMN articulos_blog.programado_para IS
  'Fecha+hora UTC en que el cron publicará automáticamente este borrador. NULL = sin programar.';
