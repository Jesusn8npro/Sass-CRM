-- ============================================================
-- 13 — Optimización RLS: auth.uid() → (SELECT auth.uid())
--
-- Postgres re-evalúa auth.uid() en cada fila si está sin envolver.
-- Con (SELECT ...) lo evalúa una sola vez por query → boost real
-- de performance al escalar (advisor 0003_auth_rls_initplan).
-- ============================================================

alter policy "usuarios_self_select" on public.usuarios
  using ((select auth.uid()) = id);
alter policy "usuarios_self_update" on public.usuarios
  using ((select auth.uid()) = id);

alter policy "cuentas_owner_select" on public.cuentas
  using ((select auth.uid()) = usuario_id);
alter policy "cuentas_owner_update" on public.cuentas
  using ((select auth.uid()) = usuario_id);
alter policy "cuentas_owner_delete" on public.cuentas
  using ((select auth.uid()) = usuario_id);
alter policy "cuentas_owner_insert" on public.cuentas
  with check ((select auth.uid()) = usuario_id);

alter policy "notif_owner_all" on public.notificaciones_sistema
  using ((select auth.uid()) = usuario_id);

alter policy "creditos_select_owner" on public.creditos
  using (cuenta_id in (select id from public.cuentas where usuario_id = (select auth.uid())));
alter policy "uso_creditos_select_owner" on public.uso_creditos
  using (cuenta_id in (select id from public.cuentas where usuario_id = (select auth.uid())));
alter policy "runs_apify_select_owner" on public.runs_apify
  using (cuenta_id in (select id from public.cuentas where usuario_id = (select auth.uid())));
alter policy "threads_config_select_owner" on public.threads_config
  using (cuenta_id in (select id from public.cuentas where usuario_id = (select auth.uid())));
alter policy "leads_extraidos_select_owner" on public.leads_extraidos
  using (cuenta_id in (select id from public.cuentas where usuario_id = (select auth.uid())));
alter policy "auto_seg_pasos_select_owner" on public.auto_seguimientos_pasos
  using (cuenta_id in (select id from public.cuentas where usuario_id = (select auth.uid())));
alter policy "conocimiento_chunks_select_owner" on public.conocimiento_chunks
  using (cuenta_id in (select id from public.cuentas where usuario_id = (select auth.uid())));

alter policy "pagos_dueno_select" on public.pagos
  using ((select auth.uid()) = usuario_id);

alter policy "metering_dueno_select" on public.metering_uso
  using (exists (
    select 1 from public.cuentas c
    where c.id = metering_uso.cuenta_id and c.usuario_id = (select auth.uid())
  ));
alter policy "api_keys_dueno_select" on public.api_keys
  using (exists (
    select 1 from public.cuentas c
    where c.id = api_keys.cuenta_id and c.usuario_id = (select auth.uid())
  ));
