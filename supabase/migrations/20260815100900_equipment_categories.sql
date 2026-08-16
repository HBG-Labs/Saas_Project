-- =============================================================================
-- Catégories de matériel : de l'enum fibre à un référentiel par métier
-- =============================================================================
--
-- LE DÉFAUT
--
--   create type public.equipment_category as enum
--     ('optique', 'electricite', 'radio', 'securite', 'autre');
--
-- Cinq valeurs, toutes issues du monde fibre et réseaux. Un frigoriste n'y
-- range ni ses stations de charge ni ses détecteurs de fuite ; un paysagiste,
-- ni sa motoculture ni ses outils de coupe. Tout finit en « autre », et la
-- catégorie cesse d'informer.
--
-- POURQUOI L'ENUM ÉTAIT LE MAUVAIS OUTIL
--
-- Une valeur d'enum s'ajoute mais ne se retire jamais. Le type ne porte ni
-- libellé lisible, ni icône, ni ordre d'affichage, ni rattachement à un métier.
-- Ajouter « froid » obligerait à modifier le type pour TOUS les utilisateurs, y
-- compris ceux que le froid ne concerne pas.
--
-- LA BASCULE EST PROGRESSIVE, ET C'EST DÉLIBÉRÉ
--
-- La colonne `category` reste en place, peuplée, intacte. On AJOUTE
-- `category_id`, on le remplit depuis l'ancienne valeur, et on vérifie. Rien
-- n'est retiré ici :
--
--   • un enum PostgreSQL ne se supprime pas tant qu'une colonne l'utilise ;
--   • une bascule et une suppression dans la même migration ne laissent aucune
--     fenêtre pour constater que la première a bien fonctionné.
--
-- La suppression de `category` fera l'objet de son propre changement, une fois
-- l'interface passée sur la nouvelle colonne.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- equipment_categories
-- -----------------------------------------------------------------------------
--
-- `industry_code` NULLABLE, contrairement à `intervention_types` où il est
-- obligatoire. La différence n'est pas une inconséquence :
--
--   • un type d'intervention porte un formulaire, donc deux métiers ne peuvent
--     pas partager le même — d'où l'obligation ;
--   • une catégorie de matériel ne porte qu'un classement. « Sécurité & EPI »,
--     « Mesure », « Outillage à main » sont les mêmes partout, et les dupliquer
--     onze fois n'apporterait rien qu'une liste à maintenir.
--
-- `industry_code IS NULL` signifie donc « commun à tous les métiers ».
create table if not exists public.equipment_categories (
  id            uuid primary key default gen_random_uuid(),
  industry_code text references public.industries (code) on delete restrict,
  code          text not null check (code ~ '^[a-z][a-z0-9_]*$'),
  label         text not null check (char_length(label) between 2 and 80),
  icon          text not null default 'package',
  sort_order    integer not null default 0,
  status        public.content_status not null default 'active',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.equipment_categories is
  'Classement du matériel. `industry_code` nul = catégorie commune à tous les métiers.';

-- Deux index d'unicité plutôt qu'une contrainte : `unique (industry_code, code)`
-- laisserait passer plusieurs catégories communes de même code, PostgreSQL
-- considérant deux NULL comme distincts.
create unique index if not exists equipment_categories_code_per_industry
  on public.equipment_categories (industry_code, code)
  where industry_code is not null;

create unique index if not exists equipment_categories_code_shared
  on public.equipment_categories (code)
  where industry_code is null;

create index if not exists equipment_categories_lookup_idx
  on public.equipment_categories (industry_code, status, sort_order);

drop trigger if exists equipment_categories_set_updated_at on public.equipment_categories;
create trigger equipment_categories_set_updated_at
  before update on public.equipment_categories
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Semis — commun à tous les métiers
-- -----------------------------------------------------------------------------
insert into public.equipment_categories (industry_code, code, label, icon, sort_order)
values
  (null, 'measurement', 'Mesure & contrôle', 'gauge', 10),
  (null, 'hand_tools',  'Outillage à main', 'wrench', 20),
  (null, 'power_tools', 'Outillage électroportatif', 'drill', 30),
  (null, 'safety',      'Sécurité & EPI', 'hard-hat', 40),
  (null, 'access',      'Accès & travail en hauteur', 'ladder', 50),
  (null, 'vehicle',     'Véhicule & remorque', 'truck', 60),
  (null, 'other',       'Autre', 'package', 999),

  -- Fibre & télécom
  ('fiber_telecom', 'optical',   'Optique & soudure', 'cable', 110),
  ('fiber_telecom', 'network',   'Réseau & actifs', 'server', 120),
  ('fiber_telecom', 'radio',     'Radio & antennes', 'radio-tower', 130),

  -- Froid & climatisation
  ('hvac', 'refrigerant', 'Fluides & récupération', 'snowflake', 210),
  ('hvac', 'brazing',     'Brasage & mise en œuvre', 'flame', 220),
  ('hvac', 'leak_detect', 'Détection de fuite', 'search', 230),

  -- Paysage & espaces verts
  ('landscaping', 'motorised', 'Motoculture', 'tractor', 310),
  ('landscaping', 'cutting',   'Coupe & élagage', 'scissors', 320),
  ('landscaping', 'spraying',  'Pulvérisation & traitement', 'flask-conical', 330),

  -- Électricité
  ('electrical', 'testing', 'Contrôle électrique', 'zap', 410)
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- equipment.category_id
-- -----------------------------------------------------------------------------
alter table public.equipment
  add column if not exists category_id uuid
    references public.equipment_categories (id) on delete restrict;

comment on column public.equipment.category_id is
  'Classement du matériel. Remplace l''enum `category`, conservé le temps de la bascule.';

create index if not exists equipment_category_id_idx
  on public.equipment (category_id)
  where category_id is not null;

-- -----------------------------------------------------------------------------
-- Report de l'ancienne valeur
-- -----------------------------------------------------------------------------
--
-- Correspondance écrite à la main, pas déduite. Les cinq valeurs de l'enum ont
-- un équivalent naturel :
--
--   optique     → Optique & soudure     (fibre)
--   radio       → Radio & antennes      (fibre)
--   electricite → Contrôle électrique   (électricité)
--   securite    → Sécurité & EPI        (commun)
--   autre       → Autre                 (commun)
--
-- `electricite` bascule vers une catégorie du métier ÉLECTRICITÉ, alors que le
-- matériel appartient à des entreprises de fibre. Ce n'est pas une erreur : ces
-- entreprises font aussi de l'électricité — c'est même ainsi que se décrit
-- celle qui utilise ce produit. Le classement du matériel n'est d'ailleurs pas
-- contraint par le métier de l'organisation, contrairement aux types
-- d'intervention : on range un outil, on ne l'autorise pas.
update public.equipment e
set category_id = c.id
from public.equipment_categories c
where e.category_id is null
  and (
    (e.category = 'optique'     and c.industry_code = 'fiber_telecom' and c.code = 'optical')
    or (e.category = 'radio'    and c.industry_code = 'fiber_telecom' and c.code = 'radio')
    or (e.category = 'electricite' and c.industry_code = 'electrical' and c.code = 'testing')
    or (e.category = 'securite' and c.industry_code is null and c.code = 'safety')
    or (e.category = 'autre'    and c.industry_code is null and c.code = 'other')
  );

-- Filet : tout matériel resté sans catégorie tombe sur « Autre » plutôt que sur
-- NULL. Une valeur manquante se remarque moins qu'une valeur explicite.
update public.equipment e
set category_id = (
  select c.id from public.equipment_categories c
  where c.industry_code is null and c.code = 'other'
)
where e.category_id is null;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.equipment_categories enable row level security;

drop policy if exists "equipment_categories_select_authenticated" on public.equipment_categories;
create policy "equipment_categories_select_authenticated"
  on public.equipment_categories for select
  to authenticated
  using (status = 'active');

revoke all on public.equipment_categories from public, anon, authenticated;
grant select on public.equipment_categories to authenticated;
