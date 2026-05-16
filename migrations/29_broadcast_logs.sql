create table if not exists public.broadcast_logs (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references public.cuentas(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  texto text not null,
  total_destinatarios int not null default 0,
  total_enviados int not null default 0,
  total_fallos int not null default 0,
  estado text not null default 'completado',
  creado_en timestamptz not null default now()
);
create index if not exists broadcast_logs_cuenta_idx on public.broadcast_logs(cuenta_id);
