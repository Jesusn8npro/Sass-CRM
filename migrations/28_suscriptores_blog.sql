CREATE TABLE IF NOT EXISTS suscriptores_blog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  nombre text,
  confirmado boolean NOT NULL DEFAULT false,
  token_confirmacion text UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  suscrito_en timestamptz NOT NULL DEFAULT now(),
  desuscrito_en timestamptz
);
CREATE INDEX IF NOT EXISTS idx_suscriptores_blog_email ON suscriptores_blog(email);
-- Solo los confirmados y no desuscritos son activos
CREATE INDEX IF NOT EXISTS idx_suscriptores_blog_activos ON suscriptores_blog(suscrito_en) WHERE confirmado = true AND desuscrito_en IS NULL;
