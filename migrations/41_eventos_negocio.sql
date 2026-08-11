-- Disparadores de negocio → alerta por WhatsApp al operador privado.
--
-- El sitio del cliente (o un trigger de Postgres en SU base) avisa al SaaS
-- cuando pasa algo que el dueño quiere saber al instante: se registró un
-- usuario, alguien inició una compra, un pago quedó pendiente, etc. El SaaS
-- formatea el evento y lo encola al telefono_operador_privado de la cuenta.
--
-- token_eventos: secreto por cuenta que autentica el webhook público
--   /api/eventos/negocio. Separado de token_chat_web a propósito: son dos
--   integraciones distintas y filtrar una no debe comprometer la otra.
-- eventos_negocio_activos: interruptor maestro. Sin esto en true el webhook
--   acepta el evento (200) pero no manda nada — permite cortar el ruido sin
--   tener que ir a desarmar los triggers en la base del negocio.
alter table public.cuentas
  add column if not exists token_eventos           text,
  add column if not exists eventos_negocio_activos boolean not null default true;

-- Un token no puede repetirse entre cuentas: es la única credencial del webhook.
create unique index if not exists cuentas_token_eventos_key
  on public.cuentas (token_eventos)
  where token_eventos is not null;

-- Bitácora de lo recibido. Sirve para depurar ("¿llegó el evento?") y para
-- que el panel muestre historial sin depender de los logs del proceso.
create table if not exists public.eventos_negocio (
  id         uuid primary key default gen_random_uuid(),
  cuenta_id  uuid not null references public.cuentas(id) on delete cascade,
  tipo       text not null,
  titulo     text,
  datos      jsonb not null default '{}'::jsonb,
  notificado boolean not null default false,
  motivo     text,
  creado_en  timestamptz not null default now()
);

create index if not exists eventos_negocio_cuenta_fecha_idx
  on public.eventos_negocio (cuenta_id, creado_en desc);

alter table public.eventos_negocio enable row level security;

-- Solo el dueño de la cuenta ve sus eventos. La escritura entra por el
-- webhook, que corre con service_role y bypassa RLS.
drop policy if exists eventos_negocio_lectura_propia on public.eventos_negocio;
create policy eventos_negocio_lectura_propia
  on public.eventos_negocio for select
  using (
    exists (
      select 1 from public.cuentas c
      where c.id = eventos_negocio.cuenta_id
        and c.usuario_id = (select auth.uid())
    )
  );
