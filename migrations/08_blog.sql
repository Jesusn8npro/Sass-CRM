-- ============================================================
-- Blog SEO indexable (Fase 2)
--
-- 4 tablas:
--   - articulos_blog: el contenido. Multi-tenant via cuenta_id NULL=SaaS.
--   - categorias_blog: agrupación (Marketing, IA, WhatsApp, etc).
--   - tags_blog: M:N free-form.
--   - articulo_tags: junction table.
--
-- RLS:
--   - SELECT público (anon + authenticated) para artículos PUBLICADOS,
--     categorías y tags. Necesario para que /blog sea indexable.
--   - INSERT/UPDATE/DELETE solo super-admins (vía service_role en el
--     server, reforzado por policies).
--
-- Idempotente. Aplicar en Supabase SQL Editor.
-- ============================================================

-- 1) Categorías
create table if not exists public.categorias_blog (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~* '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 2 and 80),
  nombre text not null check (length(nombre) between 2 and 100),
  descripcion text,
  imagen_url text,
  orden int not null default 0,
  creado_en timestamptz not null default now()
);

create index if not exists categorias_blog_slug_idx on public.categorias_blog(slug);

comment on table public.categorias_blog is
  'Categorías del blog (Marketing, IA, WhatsApp, Casos de uso, etc).';

-- 2) Tags
create table if not exists public.tags_blog (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~* '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 1 and 60),
  nombre text not null check (length(nombre) between 1 and 80),
  creado_en timestamptz not null default now()
);

create index if not exists tags_blog_slug_idx on public.tags_blog(slug);

-- 3) Artículos
create table if not exists public.articulos_blog (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid references public.cuentas(id) on delete set null,
  slug text not null unique check (length(slug) between 3 and 120),
  titulo text not null check (length(titulo) between 5 and 200),
  resumen text not null check (length(resumen) between 30 and 500),
  contenido_md text not null check (length(contenido_md) between 100 and 50000),
  imagen_portada_url text,
  imagen_portada_alt text,
  categoria_id uuid references public.categorias_blog(id) on delete set null,
  estado text not null default 'borrador'
    check (estado in ('borrador', 'publicado', 'archivado')),
  seo_titulo text check (seo_titulo is null or length(seo_titulo) <= 70),
  seo_descripcion text check (seo_descripcion is null or length(seo_descripcion) <= 200),
  seo_keywords text[] not null default '{}',
  autor_nombre text not null default 'Equipo',
  autor_email text,
  tiempo_lectura_min int not null default 3 check (tiempo_lectura_min between 1 and 60),
  visualizaciones int not null default 0,
  generado_por text not null default 'humano'
    check (generado_por in ('humano', 'ia', 'mixto')),
  prompt_origen text,
  publicado_en timestamptz,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists articulos_blog_slug_idx on public.articulos_blog(slug);
create index if not exists articulos_blog_estado_idx
  on public.articulos_blog(estado, publicado_en desc);
create index if not exists articulos_blog_categoria_idx
  on public.articulos_blog(categoria_id, estado, publicado_en desc);
create index if not exists articulos_blog_cuenta_idx
  on public.articulos_blog(cuenta_id);

comment on table public.articulos_blog is
  'Artículos de blog. cuenta_id NULL = SaaS oficial, no NULL = blog del cliente.';

create or replace function public.touch_articulos_blog()
returns trigger language plpgsql
security definer
set search_path = public
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

drop trigger if exists touch_articulos_blog_trg on public.articulos_blog;
create trigger touch_articulos_blog_trg
  before update on public.articulos_blog
  for each row execute function public.touch_articulos_blog();

-- Trigger interno, no debe ser callable por REST API
revoke execute on function public.touch_articulos_blog() from anon, authenticated, public;

-- 4) Articulo ↔ Tags (M:N)
create table if not exists public.articulo_tags (
  articulo_id uuid not null references public.articulos_blog(id) on delete cascade,
  tag_id uuid not null references public.tags_blog(id) on delete cascade,
  primary key (articulo_id, tag_id)
);

create index if not exists articulo_tags_tag_idx on public.articulo_tags(tag_id);

-- ============================================================
-- RLS
-- ============================================================
alter table public.categorias_blog enable row level security;
alter table public.tags_blog enable row level security;
alter table public.articulos_blog enable row level security;
alter table public.articulo_tags enable row level security;

drop policy if exists "categorias_blog_select_public" on public.categorias_blog;
create policy "categorias_blog_select_public" on public.categorias_blog
  for select to anon, authenticated using (true);

drop policy if exists "categorias_blog_all_super_admin" on public.categorias_blog;
create policy "categorias_blog_all_super_admin" on public.categorias_blog
  for all to authenticated
  using (public.es_super_admin((auth.jwt() ->> 'email')::text))
  with check (public.es_super_admin((auth.jwt() ->> 'email')::text));

drop policy if exists "tags_blog_select_public" on public.tags_blog;
create policy "tags_blog_select_public" on public.tags_blog
  for select to anon, authenticated using (true);

drop policy if exists "tags_blog_all_super_admin" on public.tags_blog;
create policy "tags_blog_all_super_admin" on public.tags_blog
  for all to authenticated
  using (public.es_super_admin((auth.jwt() ->> 'email')::text))
  with check (public.es_super_admin((auth.jwt() ->> 'email')::text));

drop policy if exists "articulos_blog_select_publicados" on public.articulos_blog;
create policy "articulos_blog_select_publicados" on public.articulos_blog
  for select to anon, authenticated
  using (
    estado = 'publicado'
    or public.es_super_admin((auth.jwt() ->> 'email')::text)
  );

drop policy if exists "articulos_blog_all_super_admin" on public.articulos_blog;
create policy "articulos_blog_all_super_admin" on public.articulos_blog
  for all to authenticated
  using (public.es_super_admin((auth.jwt() ->> 'email')::text))
  with check (public.es_super_admin((auth.jwt() ->> 'email')::text));

drop policy if exists "articulo_tags_select_public" on public.articulo_tags;
create policy "articulo_tags_select_public" on public.articulo_tags
  for select to anon, authenticated using (true);

drop policy if exists "articulo_tags_all_super_admin" on public.articulo_tags;
create policy "articulo_tags_all_super_admin" on public.articulo_tags
  for all to authenticated
  using (public.es_super_admin((auth.jwt() ->> 'email')::text))
  with check (public.es_super_admin((auth.jwt() ->> 'email')::text));

-- ============================================================
-- Bucket de Storage para imágenes del blog (público, 10MB max)
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'blog',
  'blog',
  true,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- NOTA: NO creamos una policy SELECT en storage.objects para 'blog'.
-- El bucket es público, por lo que `getPublicUrl()` sirve cada archivo
-- individualmente sin necesidad de policy. Crear una SELECT to anon
-- permitiría listar TODOS los archivos del bucket — riesgo innecesario.

drop policy if exists "blog_imagenes_write_super_admin" on storage.objects;
create policy "blog_imagenes_write_super_admin" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'blog'
    and public.es_super_admin((auth.jwt() ->> 'email')::text)
  )
  with check (
    bucket_id = 'blog'
    and public.es_super_admin((auth.jwt() ->> 'email')::text)
  );

-- ============================================================
-- Seeds: 5 categorías base
-- ============================================================
insert into public.categorias_blog (slug, nombre, descripcion, orden) values
  ('marketing', 'Marketing', 'Estrategias, growth y ventas', 1),
  ('inteligencia-artificial', 'Inteligencia Artificial', 'Tendencias y aplicaciones de IA para negocios', 2),
  ('whatsapp-business', 'WhatsApp Business', 'Automatización y mejores prácticas en WhatsApp', 3),
  ('casos-de-uso', 'Casos de uso', 'Cómo empresas reales usan nuestro SaaS', 4),
  ('producto', 'Producto', 'Novedades y mejoras de la plataforma', 5)
on conflict (slug) do nothing;
