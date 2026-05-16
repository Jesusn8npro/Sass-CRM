-- Suscripciones push por usuario+cuenta para notificaciones de handoff
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cuenta_id uuid NOT NULL REFERENCES cuentas(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  keys_json jsonb NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE(usuario_id, cuenta_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_cuenta ON push_subscriptions(cuenta_id);
