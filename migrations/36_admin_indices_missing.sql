-- ============================================================
-- 36 — Índices faltantes para queries del panel admin
--
-- Los queries del panel /admin/salud y /admin/blog/suscriptores
-- hacían full-table-scan en tablas que pueden crecer bastante.
-- ============================================================

-- admin/salud: ORDER BY total_fallos DESC sobre webhooks con fallos
create index if not exists webhooks_fallos_desc_idx
  on public.webhooks_salientes(total_fallos desc)
  where total_fallos > 0;

-- admin/blog/suscriptores: ORDER BY suscrito_en DESC
create index if not exists suscriptores_blog_creado_idx
  on public.suscriptores_blog(suscrito_en desc);

-- metering_uso: GROUP BY proveedor en queries de costo global
-- (usado por el dashboard admin para sumar costo IA por proveedor)
create index if not exists metering_proveedor_creado_idx
  on public.metering_uso(proveedor, creado_en desc);

-- eventos_log: el panel de logs filtra por cuenta_id + nivel + fecha
create index if not exists eventos_log_cuenta_nivel_idx
  on public.eventos_log(cuenta_id, nivel, creado_en desc)
  where cuenta_id is not null;
