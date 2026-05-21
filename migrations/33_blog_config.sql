-- Configuración global del blog automático.
-- Idempotente: usa IF NOT EXISTS / DO NOTHING.

CREATE TABLE IF NOT EXISTS blog_config (
  id              int  PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- singleton
  activo          boolean    NOT NULL DEFAULT true,
  horas           int[]      NOT NULL DEFAULT '{8}',          -- horas UTC (0-23) en que se genera
  dias_semana     int[]      NOT NULL DEFAULT '{1,2,3,4,5}',  -- 0=Dom … 6=Sab
  max_por_dia     int        NOT NULL DEFAULT 1,
  longitud        text       NOT NULL DEFAULT 'medio',        -- 'corto' | 'medio' | 'largo'
  tier_portada    text       NOT NULL DEFAULT 'pro',          -- 'pro' | 'estandar'
  modo_imagenes   text       NOT NULL DEFAULT 'completo',     -- 'sin-imagenes' | 'solo-portada' | 'completo'
  actualizado_en  timestamptz NOT NULL DEFAULT now()
);

-- Fila única inicial
INSERT INTO blog_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE blog_config IS 'Configuración singleton del blog automático (generación de artículos).';
COMMENT ON COLUMN blog_config.horas IS 'Array de horas UTC (0-23) en que el cron disparará la generación.';
COMMENT ON COLUMN blog_config.dias_semana IS 'Array de días (0=Dom, 1=Lun, ..., 6=Sab) habilitados.';
COMMENT ON COLUMN blog_config.max_por_dia IS 'Máximo de artículos a generar en un mismo día.';

-- RLS: sólo service_role puede leer/escribir
ALTER TABLE blog_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blog_config_service_only" ON blog_config USING (false) WITH CHECK (false);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION touch_blog_config()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  NEW.actualizado_en = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_blog_config ON blog_config;
CREATE TRIGGER trg_touch_blog_config
  BEFORE UPDATE ON blog_config
  FOR EACH ROW EXECUTE FUNCTION touch_blog_config();
