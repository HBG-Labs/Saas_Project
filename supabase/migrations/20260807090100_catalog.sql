-- =============================================================================
-- Catalogue : catégories et outils
-- =============================================================================
-- Modèle hybride. Ces tables portent les MÉTADONNÉES et la curation (ordre,
-- publication, recherche). L'IMPLÉMENTATION de chaque outil vit dans le code
-- (`src/tools/<slug>/`). Les deux faces sont jointes par `slug`.
--
-- Aucune politique d'écriture n'est définie : le catalogue est administré via
-- le dashboard ou une migration (rôle service_role). Le frontend ne peut que
-- lire, et uniquement ce qui est publié.
-- =============================================================================

create table public.categories (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name         text not null,
  description  text,
  icon         text,
  sort_order   integer not null default 0,
  is_published boolean not null default true,
  created_at   timestamptz not null default now()
);

create table public.tools (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  category_id  uuid not null references public.categories (id) on delete restrict,
  name         text not null,
  description  text,
  keywords     text[] not null default '{}',
  sort_order   integer not null default 0,
  is_published boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on column public.tools.slug is
  'Doit correspondre au slug déclaré par defineTool() dans src/tools/<slug>/index.ts.';

-- Index sur la clé étrangère : Postgres n'en crée pas automatiquement, et
-- toutes les listes du catalogue filtrent par catégorie.
create index tools_category_id_idx on public.tools (category_id);
create index tools_published_idx on public.tools (is_published) where is_published;

create trigger tools_set_updated_at
  before update on public.tools
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS : lecture publique du contenu publié uniquement
-- -----------------------------------------------------------------------------
alter table public.categories enable row level security;
alter table public.tools enable row level security;

-- `anon` inclus : le catalogue est consultable sans compte.
create policy "categories_select_published"
  on public.categories for select
  to anon, authenticated
  using (is_published);

create policy "tools_select_published"
  on public.tools for select
  to anon, authenticated
  using (is_published);
