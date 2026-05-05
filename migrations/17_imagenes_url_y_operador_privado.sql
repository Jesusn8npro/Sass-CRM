-- ============================================================
-- 17_imagenes_url_y_operador_privado.sql
--
-- Dos cambios disjuntos:
--
-- 1) productos.imagen_url_externa — URL HTTP/HTTPS de una imagen
--    ya hosteada (ej: del Supabase del cliente, su CDN, Shopify).
--    Permite hacer CSV import sin tener que re-subir cada foto a
--    nuestro Storage.  imagen_path queda para uploads internos
--    (Storage del SaaS).  El bot prioriza imagen_url_externa si
--    está, fallback a imagen_path.
--
-- 2) Operador privado — el dueño puede registrar SU número personal
--    (telefono_operador_privado) para recibir alertas y un resumen
--    diario del negocio vía el mismo bot WhatsApp.  Es como un
--    asistente ejecutivo: leads importantes, cuenta caída, KPIs
--    diarios.
--
-- Idempotente.
-- ============================================================

alter table public.productos
  add column if not exists imagen_url_externa text;

comment on column public.productos.imagen_url_externa is
  'URL pública (https) a la imagen del producto. Tiene precedencia sobre imagen_path. Útil para CSV import desde Shopify/WooCommerce/Supabase del cliente sin re-subir el archivo.';

alter table public.cuentas
  add column if not exists telefono_operador_privado text,
  add column if not exists operador_privado_resumen_diario boolean not null default true,
  add column if not exists operador_privado_alertas boolean not null default true,
  add column if not exists notificaciones_email_activas boolean not null default true;

comment on column public.cuentas.telefono_operador_privado is
  'Número WhatsApp personal del dueño donde recibe alertas y resumen diario. Sin código de país con +. Ej: 573144096187.';
comment on column public.cuentas.operador_privado_resumen_diario is
  'Si true, el bot le envía a las 9am un resumen del día anterior (mensajes, leads, citas, top productos).';
comment on column public.cuentas.operador_privado_alertas is
  'Si true, recibe alertas urgentes en tiempo real: lead score >=80, handoff a humano, error crítico de cuenta.';
comment on column public.cuentas.notificaciones_email_activas is
  'Opt-in para emails transaccionales (Resend). Si false el sistema no le manda nada por email salvo billing.';
