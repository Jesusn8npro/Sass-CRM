-- ============================================================
-- 12 — Cleanup de duplicados detectados por performance advisor
--
-- La migration 07 creó índices y políticas que duplicaban las del
-- schema base. Borramos los nuestros para no penalizar inserts/
-- updates con índices redundantes.
-- ============================================================

drop index if exists public.bandeja_salida_cuenta_pendiente_idx;
drop index if exists public.conversaciones_cuenta_actualizado_idx;

drop policy if exists "cuentas_dueno_select" on public.cuentas;
