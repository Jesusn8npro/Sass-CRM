-- ============================================================
-- 15 — Optimizar WITH CHECK en policies UPDATE/ALL
--
-- Las policies de UPDATE evalúan auth.uid() en USING (filas viejas) y
-- en WITH CHECK (filas nuevas). La migration 13 sólo optimizó USING;
-- acá completamos WITH CHECK.
-- ============================================================

alter policy "usuarios_self_update" on public.usuarios
  with check ((select auth.uid()) = id);

alter policy "cuentas_owner_update" on public.cuentas
  with check ((select auth.uid()) = usuario_id);

alter policy "notif_owner_all" on public.notificaciones_sistema
  with check ((select auth.uid()) = usuario_id);
