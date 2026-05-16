-- ============================================================
-- 30: Equipo (cuenta_miembros), asignación de conversaciones,
--     y límites de gasto por proveedor
-- ============================================================

-- Miembros del equipo de una cuenta
CREATE TABLE IF NOT EXISTS public.cuenta_miembros (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cuenta_id    uuid        NOT NULL REFERENCES public.cuentas(id) ON DELETE CASCADE,
  usuario_id   uuid        NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  rol          text        NOT NULL DEFAULT 'agente'
                           CHECK (rol IN ('agente', 'admin')),
  invitado_por uuid        REFERENCES public.usuarios(id),
  activo       boolean     NOT NULL DEFAULT true,
  creado_en    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(cuenta_id, usuario_id)
);
CREATE INDEX IF NOT EXISTS cuenta_miembros_cuenta_idx  ON public.cuenta_miembros(cuenta_id);
CREATE INDEX IF NOT EXISTS cuenta_miembros_usuario_idx ON public.cuenta_miembros(usuario_id);

-- Asignación de conversaciones a un agente del equipo
ALTER TABLE public.conversaciones
  ADD COLUMN IF NOT EXISTS asignado_a uuid REFERENCES public.usuarios(id);
CREATE INDEX IF NOT EXISTS conversaciones_asignado_idx
  ON public.conversaciones(asignado_a)
  WHERE asignado_a IS NOT NULL;

-- Límites de gasto mensual por proveedor (USD)
-- Ejemplo: { "vapi": 50, "openai": 30, "apify": 20, "total": 100 }
ALTER TABLE public.cuentas
  ADD COLUMN IF NOT EXISTS limites_gasto jsonb NOT NULL DEFAULT '{}';
