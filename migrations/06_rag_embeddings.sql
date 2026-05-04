-- ============================================================
-- RAG sobre conocimiento: cada entrada se chunkifica y cada chunk
-- tiene su embedding. En vez de inyectar todo el conocimiento al
-- prompt, buscamos los 5 chunks mas similares al ultimo mensaje
-- del cliente. Costo + calidad mejoran drasticamente.
--
-- Aplicar manualmente en Supabase SQL Editor. Idempotente.
-- ============================================================

-- 1) Activar extension pgvector (Supabase la incluye nativa)
create extension if not exists vector;

-- 2) Tabla de chunks: cada entrada de conocimiento se parte en
--    pedazos de ~400 tokens. Cada pedazo guarda su embedding.
create table if not exists public.conocimiento_chunks (
  id uuid primary key default gen_random_uuid(),
  conocimiento_id uuid not null references public.conocimiento(id) on delete cascade,
  cuenta_id uuid not null references public.cuentas(id) on delete cascade,
  -- Posicion del chunk dentro de la entrada (0, 1, 2...)
  orden int not null default 0,
  -- Texto del chunk (plain text)
  contenido text not null,
  -- text-embedding-3-small de OpenAI: 1536 dimensiones
  embedding vector(1536),
  creado_en timestamptz not null default now()
);

-- Indice ivfflat para busqueda por similitud coseno.
-- lists=100 es buen default para <1M chunks.
create index if not exists conocimiento_chunks_embedding_idx
  on public.conocimiento_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists conocimiento_chunks_cuenta_idx
  on public.conocimiento_chunks(cuenta_id);
create index if not exists conocimiento_chunks_conocimiento_idx
  on public.conocimiento_chunks(conocimiento_id);

comment on table public.conocimiento_chunks is
  'Chunks de conocimiento con embeddings para RAG. Cada entrada de conocimiento se parte en N pedazos al subirla.';

-- 3) Funcion de busqueda vectorial: dado un embedding query,
--    devuelve los k chunks mas similares de la cuenta especificada.
create or replace function public.buscar_chunks_similares(
  p_query_embedding vector(1536),
  p_cuenta_id uuid,
  p_k int default 5,
  p_threshold float default 0.5
)
returns table (
  id uuid,
  conocimiento_id uuid,
  contenido text,
  similitud float,
  titulo text,
  categoria text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    cc.id,
    cc.conocimiento_id,
    cc.contenido,
    -- Cosine similarity: 1 - distance. Mas alto = mas similar.
    (1 - (cc.embedding <=> p_query_embedding))::float as similitud,
    c.titulo,
    c.categoria
  from public.conocimiento_chunks cc
  join public.conocimiento c on c.id = cc.conocimiento_id
  where cc.cuenta_id = p_cuenta_id
    and cc.embedding is not null
    and c.esta_activo = true
    and (1 - (cc.embedding <=> p_query_embedding)) >= p_threshold
  order by cc.embedding <=> p_query_embedding
  limit p_k;
end;
$$;

-- 4) RLS para chunks
alter table public.conocimiento_chunks enable row level security;

drop policy if exists "conocimiento_chunks_select_owner" on public.conocimiento_chunks;
create policy "conocimiento_chunks_select_owner" on public.conocimiento_chunks
  for select to authenticated
  using (
    cuenta_id in (
      select id from public.cuentas where usuario_id = auth.uid()
    )
  );
