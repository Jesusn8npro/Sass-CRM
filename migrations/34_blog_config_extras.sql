-- Agrega columnas opcionales a blog_config (idempotente).
-- Aplicar en Supabase SQL Editor.

-- Minuto exacto del disparo (ya puede existir si se aplicó el ALTER del hotfix)
ALTER TABLE blog_config
  ADD COLUMN IF NOT EXISTS minutos int NOT NULL DEFAULT 0
  CHECK (minutos >= 0 AND minutos <= 59);

-- Tema manual opcional: si está seteado, se usa como tema del artículo
-- en lugar de consultar Perplexity.
ALTER TABLE blog_config
  ADD COLUMN IF NOT EXISTS tema_manual text;

COMMENT ON COLUMN blog_config.minutos IS 'Minuto UTC (0-59) en que el cron dispara. Ventana ±4 min.';
COMMENT ON COLUMN blog_config.tema_manual IS 'Tema opcional forzado para el próximo artículo. NULL = usar Perplexity.';
