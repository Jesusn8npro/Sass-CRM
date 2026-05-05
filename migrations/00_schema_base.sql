-- ============================================================
-- Schema base — debe aplicarse ANTES de las migrations 01-08.
--
-- Esta migration reconstruye TODO el schema base que el codigo
-- TypeScript de la app asume ya creado (tablas core que se
-- crearon manualmente en el Supabase del operador en algun
-- momento y nunca quedaron versionadas). Las migrations 01-08
-- son aditivas y referencian estas tablas con FKs / ALTER TABLE.
--
-- Uso:
--   1) Aplicar 00_schema_base.sql en un proyecto nuevo de Supabase.
--   2) Aplicar en orden 01_creditos.sql -> 08_pagos_paypal.sql.
--   3) RLS general queda DESHABILITADA aca (07_hardening la activa
--      sobre cuentas/notificaciones; las demas migrations activan
--      RLS sobre sus propias tablas).
--
-- Idempotente: usa create table if not exists / create index if
-- not exists. NUNCA hace drop de nada.
--
-- Convenciones:
--   - Todos los IDs son uuid con default gen_random_uuid().
--   - Timestamps son timestamptz con default now().
--   - FKs a cuentas usan on delete cascade (datos de la cuenta).
--   - FKs a usuarios usan on delete cascade (datos del owner).
--   - FKs a etapas/conversaciones usan set null donde aplica.
-- ============================================================

-- Extensiones requeridas (pgcrypto para gen_random_uuid)
create extension if not exists pgcrypto;

-- ============================================================
-- 1. USUARIOS
-- ============================================================
-- Tabla espejo de auth.users (Supabase). El id coincide con
-- auth.users.id. Las columnas de billing (plan, estado_billing,
-- pasarela, etc) las agrega la migration 07; las columnas de
-- PayPal (paypal_subscription_id, paypal_plan_id) las agrega 08.

create table if not exists public.usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  nombre text,
  rol text not null default 'owner',
  creado_en timestamptz not null default now(),
  actualizada_en timestamptz not null default now()
);

comment on table public.usuarios is
  'Perfil de aplicacion del usuario. Espejo de auth.users con datos de negocio.';

create index if not exists usuarios_email_idx on public.usuarios(email);

-- ============================================================
-- 2. CUENTAS (workspaces de WhatsApp)
-- ============================================================
-- Cada usuario puede tener N cuentas. Cada cuenta = una linea de
-- WhatsApp + su agente IA + su CRM. NO incluye auto_seguimiento_activo
-- (lo agrega 05) ni paypal_* (los agrega 08). esta_archivada y
-- esta_activa son del schema base.

create table if not exists public.cuentas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  etiqueta text not null,
  telefono text,
  estado text not null default 'desconectado'
    check (estado in ('desconectado','qr','conectando','conectado')),
  cadena_qr text,
  ultimo_heartbeat bigint,
  -- Configuracion del agente IA
  prompt_sistema text not null default '',
  contexto_negocio text not null default '',
  buffer_segundos int not null default 8 check (buffer_segundos between 0 and 120),
  modelo text,
  voz_elevenlabs text,
  -- Vapi (llamadas de voz)
  vapi_api_key text,
  vapi_public_key text,
  vapi_assistant_id text,
  vapi_phone_id text,
  vapi_webhook_secret text,
  vapi_prompt_extra text,
  vapi_primer_mensaje text,
  vapi_max_segundos int,
  vapi_grabar boolean not null default true,
  vapi_sincronizado_en timestamptz,
  -- Captura de datos del cliente (jsonb libre con CampoCaptura[])
  campos_a_capturar jsonb not null default '[]'::jsonb,
  -- Identidad del agente
  agente_nombre text not null default '',
  agente_rol text not null default '',
  agente_personalidad text not null default '',
  agente_idioma text not null default 'es',
  agente_tono text not null default 'casual_amigable'
    check (agente_tono in ('formal','casual_amigable','profesional','cercano','directo','consultivo')),
  modo_respuesta text not null default 'mixto'
    check (modo_respuesta in ('mixto','solo_texto','solo_audio','espejo_voz')),
  -- Mensajes predefinidos
  mensaje_bienvenida text not null default '',
  mensaje_no_entiende text not null default '',
  palabras_handoff text not null default '',
  -- Parametros tecnicos del modelo
  temperatura numeric not null default 0.7,
  max_tokens int not null default 1000,
  instrucciones_extra text not null default '',
  -- WhatsApp Business Cloud API (Meta)
  wa_phone_number_id text,
  wa_business_account_id text,
  wa_access_token text,
  wa_verify_token text,
  wa_app_secret text,
  wa_estado text not null default 'desconectado'
    check (wa_estado in ('desconectado','verificando','conectado','error')),
  wa_verificada_en timestamptz,
  wa_ultimo_error text,
  -- Flags
  esta_activa boolean not null default true,
  esta_archivada boolean not null default false,
  creada_en timestamptz not null default now(),
  actualizada_en timestamptz not null default now()
);

comment on table public.cuentas is
  'Cuentas de WhatsApp de cada usuario. Cada una tiene su propio agente IA y CRM.';

create index if not exists cuentas_usuario_idx on public.cuentas(usuario_id);
create index if not exists cuentas_telefono_idx on public.cuentas(telefono) where telefono is not null;

-- ============================================================
-- 3. BAILEYS AUTH (sesiones de WhatsApp persistidas)
-- ============================================================
-- Reemplaza useMultiFileAuthState. PK compuesta = (cuenta_id, tipo, id).

create table if not exists public.baileys_auth (
  cuenta_id uuid not null references public.cuentas(id) on delete cascade,
  tipo text not null,
  id text not null,
  valor jsonb not null,
  actualizado_en timestamptz not null default now(),
  primary key (cuenta_id, tipo, id)
);

comment on table public.baileys_auth is
  'Auth state de Baileys (creds + signal keys) persistido por cuenta.';

create index if not exists baileys_auth_cuenta_tipo_idx on public.baileys_auth(cuenta_id, tipo);

-- ============================================================
-- 4. CONVERSACIONES + MENSAJES + BANDEJA DE SALIDA
-- ============================================================
-- conversaciones: una por (cuenta_id, telefono). NO incluye
-- auto_seg_paso_enviado (lo agrega migration 05).

create table if not exists public.conversaciones (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references public.cuentas(id) on delete cascade,
  telefono text not null,
  jid_wa text,
  nombre text,
  modo text not null default 'IA' check (modo in ('IA','HUMANO')),
  necesita_humano boolean not null default false,
  etapa_id uuid,  -- FK se agrega despues (forward reference a etapas_pipeline)
  ultimo_mensaje_en timestamptz,
  ultimo_visto_operador_en timestamptz,
  -- Lead tracking
  lead_score int not null default 0 check (lead_score between 0 and 100),
  estado_lead text not null default 'nuevo'
    check (estado_lead in ('nuevo','contactado','calificado','interesado','negociacion','cerrado','perdido')),
  paso_actual text not null default '',
  datos_capturados jsonb not null default '{}'::jsonb,
  creada_en timestamptz not null default now(),
  unique (cuenta_id, telefono)
);

comment on table public.conversaciones is
  'Conversaciones del CRM. Una por (cuenta, telefono).';

create index if not exists conversaciones_cuenta_idx on public.conversaciones(cuenta_id);
create index if not exists conversaciones_jid_idx on public.conversaciones(cuenta_id, jid_wa) where jid_wa is not null;
create index if not exists conversaciones_estado_lead_idx on public.conversaciones(cuenta_id, estado_lead);

-- mensajes: historial completo. wa_msg_id permite idempotencia
-- contra ecos de WhatsApp.

create table if not exists public.mensajes (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references public.cuentas(id) on delete cascade,
  conversacion_id uuid not null references public.conversaciones(id) on delete cascade,
  rol text not null check (rol in ('usuario','asistente','humano','sistema')),
  tipo text not null default 'texto'
    check (tipo in ('texto','audio','imagen','video','documento','sistema')),
  contenido text not null default '',
  media_path text,
  wa_msg_id text,
  creado_en timestamptz not null default now(),
  -- Idempotencia: un mismo wa_msg_id no se puede insertar 2 veces para
  -- la misma cuenta. La logica usa upsert con onConflict cuenta_id,wa_msg_id.
  unique (cuenta_id, wa_msg_id)
);

comment on table public.mensajes is
  'Historial de mensajes. wa_msg_id permite dedupe contra ecos de WhatsApp.';

create index if not exists mensajes_conversacion_idx on public.mensajes(conversacion_id, creado_en);
create index if not exists mensajes_cuenta_idx on public.mensajes(cuenta_id, creado_en);

-- bandeja_salida: cola FIFO de mensajes pendientes de enviar por
-- WhatsApp. El worker la procesa por (cuenta_id, enviado=false).

create table if not exists public.bandeja_salida (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references public.cuentas(id) on delete cascade,
  conversacion_id uuid not null references public.conversaciones(id) on delete cascade,
  telefono text not null,
  tipo text not null default 'texto'
    check (tipo in ('texto','audio','imagen','video','documento','sistema')),
  contenido text not null default '',
  media_path text,
  enviado boolean not null default false,
  creado_en timestamptz not null default now()
);

comment on table public.bandeja_salida is
  'Cola FIFO de mensajes pendientes de enviar por Baileys/Cloud API.';

create index if not exists bandeja_salida_pendiente_idx
  on public.bandeja_salida(cuenta_id, creado_en)
  where enviado = false;

-- ============================================================
-- 5. PRODUCTOS + INTERES + INVERSIONES
-- ============================================================

create table if not exists public.productos (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references public.cuentas(id) on delete cascade,
  nombre text not null,
  descripcion text not null default '',
  precio numeric,
  moneda text not null default 'COP',
  costo numeric,
  stock int,
  sku text,
  categoria text,
  imagen_path text,
  video_path text,
  esta_activo boolean not null default true,
  orden int not null default 0,
  creada_en timestamptz not null default now(),
  actualizada_en timestamptz not null default now()
);

comment on table public.productos is
  'Catalogo de productos/servicios por cuenta.';

create index if not exists productos_cuenta_activo_idx
  on public.productos(cuenta_id, esta_activo);

-- conversacion_productos_interes: tracking de cuantas veces el
-- cliente menciono cada producto en su conversacion. PK compuesta.

create table if not exists public.conversacion_productos_interes (
  conversacion_id uuid not null references public.conversaciones(id) on delete cascade,
  producto_id uuid not null references public.productos(id) on delete cascade,
  cuenta_id uuid not null references public.cuentas(id) on delete cascade,
  ultimo_interes_en timestamptz not null default now(),
  veces int not null default 1 check (veces >= 1),
  primary key (conversacion_id, producto_id)
);

comment on table public.conversacion_productos_interes is
  'Cuantas veces cada conversacion menciono cada producto. Para metricas top.';

create index if not exists interes_producto_cuenta_idx
  on public.conversacion_productos_interes(cuenta_id);
create index if not exists interes_producto_producto_idx
  on public.conversacion_productos_interes(producto_id);

-- inversiones: registro de gastos del negocio (CRM).

create table if not exists public.inversiones (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references public.cuentas(id) on delete cascade,
  concepto text not null,
  monto numeric not null,
  moneda text not null default 'COP',
  categoria text,
  fecha timestamptz not null default now(),
  notas text,
  creada_en timestamptz not null default now()
);

comment on table public.inversiones is
  'Gastos/inversiones del negocio asociadas a la cuenta.';

create index if not exists inversiones_cuenta_fecha_idx
  on public.inversiones(cuenta_id, fecha desc);

-- ============================================================
-- 6. CITAS + SEGUIMIENTOS
-- ============================================================

create table if not exists public.citas (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references public.cuentas(id) on delete cascade,
  conversacion_id uuid references public.conversaciones(id) on delete set null,
  cliente_nombre text not null,
  cliente_telefono text,
  fecha_hora timestamptz not null,
  duracion_min int not null default 30 check (duracion_min > 0),
  tipo text,
  estado text not null default 'agendada'
    check (estado in ('agendada','confirmada','realizada','cancelada','no_asistio')),
  notas text,
  recordatorio_enviado boolean not null default false,
  creada_en timestamptz not null default now()
);

comment on table public.citas is
  'Citas agendadas con el cliente (presencial, llamada, demo, etc).';

create index if not exists citas_cuenta_fecha_idx on public.citas(cuenta_id, fecha_hora);
create index if not exists citas_recordatorio_pendiente_idx
  on public.citas(fecha_hora)
  where recordatorio_enviado = false and estado in ('agendada','confirmada');

-- seguimientos_programados: recordatorios manuales o programados
-- por la IA. Distinto de auto_seguimientos_pasos (configuracion).

create table if not exists public.seguimientos_programados (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references public.cuentas(id) on delete cascade,
  conversacion_id uuid not null references public.conversaciones(id) on delete cascade,
  contenido text not null,
  programado_para timestamptz not null,
  estado text not null default 'pendiente'
    check (estado in ('pendiente','enviado','cancelado','fallido')),
  origen text not null default 'humano' check (origen in ('humano','ia')),
  razon_cancelacion text,
  enviado_en timestamptz,
  creado_en timestamptz not null default now()
);

comment on table public.seguimientos_programados is
  'Recordatorios manuales o agendados por la IA. Procesados por el worker.';

create index if not exists seguimientos_pendientes_idx
  on public.seguimientos_programados(programado_para)
  where estado = 'pendiente';
create index if not exists seguimientos_cuenta_idx
  on public.seguimientos_programados(cuenta_id, programado_para);

-- ============================================================
-- 7. LLAMADAS VAPI + ASSISTANTS + LLAMADAS PROGRAMADAS
-- ============================================================

create table if not exists public.assistants_vapi (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references public.cuentas(id) on delete cascade,
  nombre text not null,
  vapi_assistant_id text,
  prompt_extra text not null default '',
  primer_mensaje text not null default '',
  voz_elevenlabs text,
  modelo text not null default 'gpt-4o-mini',
  max_segundos int not null default 600,
  grabar boolean not null default true,
  es_default boolean not null default false,
  esta_activo boolean not null default true,
  sincronizado_en timestamptz,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

comment on table public.assistants_vapi is
  'Assistants de Vapi configurados por cuenta. Solo uno puede ser default.';

create index if not exists assistants_vapi_cuenta_idx on public.assistants_vapi(cuenta_id);
-- Indice unico parcial: solo un default por cuenta
create unique index if not exists assistants_vapi_default_unico
  on public.assistants_vapi(cuenta_id)
  where es_default = true;

create table if not exists public.llamadas_vapi (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references public.cuentas(id) on delete cascade,
  conversacion_id uuid references public.conversaciones(id) on delete set null,
  vapi_call_id text not null unique,
  telefono text not null,
  direccion text not null default 'saliente' check (direccion in ('saliente','entrante')),
  estado text not null default 'iniciando'
    check (estado in ('iniciando','sonando','en_curso','completada','sin_respuesta','fallida','finalizada')),
  transcripcion text,
  resumen text,
  audio_url text,
  duracion_seg int,
  costo_usd numeric(10, 4),
  iniciada_en timestamptz not null default now(),
  terminada_en timestamptz
);

comment on table public.llamadas_vapi is
  'Historial de llamadas hechas/recibidas via Vapi.';

create index if not exists llamadas_vapi_cuenta_idx
  on public.llamadas_vapi(cuenta_id, iniciada_en desc);
create index if not exists llamadas_vapi_conversacion_idx
  on public.llamadas_vapi(conversacion_id) where conversacion_id is not null;

create table if not exists public.llamadas_programadas (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references public.cuentas(id) on delete cascade,
  conversacion_id uuid references public.conversaciones(id) on delete set null,
  assistant_id uuid references public.assistants_vapi(id) on delete set null,
  telefono_destino text,
  motivo text,
  origen text not null default 'humano' check (origen in ('humano','ia')),
  programada_para timestamptz not null,
  estado text not null default 'pendiente'
    check (estado in ('pendiente','ejecutada','cancelada','fallida')),
  llamada_vapi_id uuid references public.llamadas_vapi(id) on delete set null,
  razon_cancelacion text,
  ejecutada_en timestamptz,
  creada_en timestamptz not null default now(),
  actualizada_en timestamptz not null default now()
);

comment on table public.llamadas_programadas is
  'Cola de llamadas outbound programadas. El scheduler las dispara cuando llega su hora.';

create index if not exists llamadas_prog_pendientes_idx
  on public.llamadas_programadas(programada_para)
  where estado = 'pendiente';
create index if not exists llamadas_prog_cuenta_idx
  on public.llamadas_programadas(cuenta_id, programada_para);

-- ============================================================
-- 8. NOTIFICACIONES + WEBHOOKS SALIENTES
-- ============================================================

create table if not exists public.notificaciones_sistema (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  cuenta_id uuid references public.cuentas(id) on delete cascade,
  tipo text not null
    check (tipo in ('cuenta_desconectada','cuenta_qr_listo','llamada_fallida','limite_plan_alcanzado','sistema')),
  titulo text not null,
  mensaje text not null,
  metadata jsonb,
  leida boolean not null default false,
  email_enviado boolean not null default false,
  creada_en timestamptz not null default now(),
  leida_en timestamptz
);

comment on table public.notificaciones_sistema is
  'Notificaciones in-app para el usuario (cuenta desconectada, QR listo, etc).';

create index if not exists notif_usuario_idx
  on public.notificaciones_sistema(usuario_id, creada_en desc);
create index if not exists notif_no_leidas_idx
  on public.notificaciones_sistema(usuario_id)
  where leida = false;

create table if not exists public.webhooks_salientes (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references public.cuentas(id) on delete cascade,
  nombre text not null,
  url text not null,
  secret text,
  -- Si el array esta vacio, el webhook recibe TODOS los eventos.
  eventos text[] not null default '{}'::text[],
  esta_activo boolean not null default true,
  total_disparos int not null default 0,
  total_fallos int not null default 0,
  ultimo_disparo_en timestamptz,
  ultimo_resultado text,
  creado_en timestamptz not null default now()
);

comment on table public.webhooks_salientes is
  'URLs externas a las que el sistema postea eventos del bot.';

create index if not exists webhooks_cuenta_activo_idx
  on public.webhooks_salientes(cuenta_id) where esta_activo = true;

-- ============================================================
-- 9. ETIQUETAS + ETAPAS PIPELINE + RESPUESTAS RAPIDAS
-- ============================================================

create table if not exists public.etiquetas (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references public.cuentas(id) on delete cascade,
  nombre text not null,
  color text not null default 'zinc',
  descripcion text,
  orden int not null default 0,
  creada_en timestamptz not null default now(),
  unique (cuenta_id, nombre)
);

comment on table public.etiquetas is
  'Tags asignables a conversaciones (multi-asignacion via tabla pivote).';

create index if not exists etiquetas_cuenta_idx on public.etiquetas(cuenta_id);

-- Tabla pivote N:M conversaciones <-> etiquetas
create table if not exists public.conversacion_etiquetas (
  conversacion_id uuid not null references public.conversaciones(id) on delete cascade,
  etiqueta_id uuid not null references public.etiquetas(id) on delete cascade,
  asignada_en timestamptz not null default now(),
  primary key (conversacion_id, etiqueta_id)
);

comment on table public.conversacion_etiquetas is
  'Pivote N:M conversaciones <-> etiquetas.';

create index if not exists conv_etiquetas_etiqueta_idx
  on public.conversacion_etiquetas(etiqueta_id);

-- etapas_pipeline: pasos del funnel comercial. La FK
-- conversaciones.etapa_id -> etapas_pipeline.id se agrega ahora
-- que la tabla destino existe.

create table if not exists public.etapas_pipeline (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references public.cuentas(id) on delete cascade,
  nombre text not null,
  color text not null default 'zinc',
  orden int not null default 0,
  paso_id text,
  paso_siguiente_id text,
  criterio_transicion text not null default '',
  objetivos text not null default '',
  descripcion text not null default '',
  creada_en timestamptz not null default now()
);

comment on table public.etapas_pipeline is
  'Etapas del funnel comercial por cuenta (Nuevo, Contactado, Cerrado, etc).';

create index if not exists etapas_cuenta_orden_idx on public.etapas_pipeline(cuenta_id, orden);

-- FK forward de conversaciones.etapa_id (la tabla referenciada
-- recien existe ahora). Se aplica solo si todavia no existe.
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'conversaciones'
      and constraint_name = 'conversaciones_etapa_id_fkey'
  ) then
    alter table public.conversaciones
      add constraint conversaciones_etapa_id_fkey
      foreign key (etapa_id) references public.etapas_pipeline(id) on delete set null;
  end if;
end $$;

create table if not exists public.respuestas_rapidas (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references public.cuentas(id) on delete cascade,
  atajo text not null,
  texto text not null,
  orden int not null default 0,
  creada_en timestamptz not null default now(),
  actualizada_en timestamptz not null default now(),
  unique (cuenta_id, atajo)
);

comment on table public.respuestas_rapidas is
  'Snippets de texto rapidos para el operador (atajos /saludo, /precios).';

create index if not exists respuestas_cuenta_idx on public.respuestas_rapidas(cuenta_id, orden);

-- ============================================================
-- 10. CONTACTOS EMAIL + TELEFONO (capturados por la IA)
-- ============================================================

create table if not exists public.contactos_email (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references public.cuentas(id) on delete cascade,
  conversacion_id uuid references public.conversaciones(id) on delete set null,
  email text not null,
  validez text not null default 'valido' check (validez in ('valido','sospechoso','invalido')),
  capturado_en timestamptz not null default now(),
  unique (cuenta_id, email)
);

comment on table public.contactos_email is
  'Emails extraidos automaticamente del texto de los mensajes del cliente.';

create index if not exists contactos_email_cuenta_idx
  on public.contactos_email(cuenta_id, capturado_en desc);

create table if not exists public.contactos_telefono (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references public.cuentas(id) on delete cascade,
  conversacion_id uuid references public.conversaciones(id) on delete set null,
  telefono text not null,
  capturado_en timestamptz not null default now(),
  unique (cuenta_id, telefono)
);

comment on table public.contactos_telefono is
  'Telefonos extraidos automaticamente del texto de los mensajes del cliente.';

create index if not exists contactos_telefono_cuenta_idx
  on public.contactos_telefono(cuenta_id, capturado_en desc);

-- ============================================================
-- 11. BIBLIOTECA + CONOCIMIENTO
-- ============================================================
-- conocimiento: entradas de la base de conocimiento que la IA
-- consulta. La migration 06 agrega chunks + embeddings para RAG.

create table if not exists public.conocimiento (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references public.cuentas(id) on delete cascade,
  titulo text not null,
  contenido text not null,
  categoria text not null default 'general',
  esta_activo boolean not null default true,
  orden int not null default 0,
  creada_en timestamptz not null default now(),
  actualizada_en timestamptz not null default now()
);

comment on table public.conocimiento is
  'Base de conocimiento textual del agente. RAG via conocimiento_chunks (migration 06).';

create index if not exists conocimiento_cuenta_idx
  on public.conocimiento(cuenta_id, orden);
create index if not exists conocimiento_activo_idx
  on public.conocimiento(cuenta_id) where esta_activo = true;

-- biblioteca_medios: archivos (imagenes, audios, videos, docs)
-- que el agente puede enviar al cliente identificandolos por slug.

create table if not exists public.biblioteca_medios (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references public.cuentas(id) on delete cascade,
  identificador text not null,
  tipo text not null check (tipo in ('imagen','video','audio','documento')),
  ruta_archivo text not null,
  descripcion text not null default '',
  creado_en timestamptz not null default now(),
  unique (cuenta_id, identificador)
);

comment on table public.biblioteca_medios is
  'Archivos multimedia con identificador slug que el agente puede enviar al cliente.';

create index if not exists biblioteca_cuenta_idx on public.biblioteca_medios(cuenta_id);

-- ============================================================
-- FIN del schema base.
-- A continuacion deben aplicarse las migrations 01..08 en orden.
-- ============================================================
