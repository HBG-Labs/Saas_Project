-- =============================================================================
-- Catalogue v2 — huit domaines techniques, statuts et visibilité
-- =============================================================================
-- Fait évoluer `categories` et `tools` sans les recréer :
--
--   • `is_published` (booléen) devient `status` (draft | active | archived).
--     Un booléen ne sait pas distinguer « pas encore prêt » de « retiré du
--     service ». La distinction compte pour un catalogue commercial : un outil
--     archivé doit rester référencé (historique, favoris) sans être proposé.
--
--   • `tools.visibility` sépare CE QUI EXISTE de QUI PEUT LE VOIR. Sans cette
--     colonne, réserver un outil aux abonnés obligerait à le dépublier, donc à
--     le rendre invisible à tout le monde.
--
--   • Le jeu de catégories passe de 4 à 8. Les quatre slugs existants sont
--     CONSERVÉS : ils figurent dans les URL `/categories/<slug>` et dans les
--     `defineTool()` des outils déjà livrés. Seuls leurs libellés évoluent.
--
-- Idempotente : réexécutable sans erreur.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Types
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'content_status') then
    create type public.content_status as enum ('draft', 'active', 'archived');
  end if;

  if not exists (select 1 from pg_type where typname = 'tool_visibility') then
    -- public        : visible sans compte (vitrine, SEO)
    -- authenticated : nécessite un compte, quel que soit le plan
    -- pro           : nécessite un abonnement actif débloquant la fonctionnalité
    create type public.tool_visibility as enum ('public', 'authenticated', 'pro');
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- categories
-- -----------------------------------------------------------------------------
alter table public.categories
  add column if not exists short_description text,
  add column if not exists status            public.content_status,
  add column if not exists updated_at        timestamptz not null default now();

-- Reprise de l'existant AVANT de rendre la colonne obligatoire : sans cette
-- étape, une base déjà peuplée refuserait le `set not null`.
update public.categories
set status = case when is_published then 'active' else 'draft' end::public.content_status
where status is null;

alter table public.categories
  alter column status set default 'active',
  alter column status set not null;

-- La policy dépend de `is_published` : elle doit tomber avant la colonne.
drop policy if exists "categories_select_published" on public.categories;
alter table public.categories drop column if exists is_published;

create policy "categories_select_active"
  on public.categories for select
  to anon, authenticated
  using (status = 'active');

drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

create index if not exists categories_sort_idx
  on public.categories (sort_order, name)
  where status = 'active';

-- -----------------------------------------------------------------------------
-- tools
-- -----------------------------------------------------------------------------
alter table public.tools
  add column if not exists short_description text,
  add column if not exists icon              text,
  add column if not exists status            public.content_status,
  add column if not exists visibility        public.tool_visibility not null default 'public';

update public.tools
set status = case when is_published then 'active' else 'draft' end::public.content_status
where status is null;

alter table public.tools
  alter column status set default 'draft',
  alter column status set not null;

drop policy if exists "tools_select_published" on public.tools;
drop index if exists public.tools_published_idx;
alter table public.tools drop column if exists is_published;

-- Cette policy est REMPLACÉE par la migration `billing` pour prendre en charge
-- `visibility = 'pro'`. Ici, faute de table `subscriptions`, un outil `pro`
-- reste invisible — un défaut fermé plutôt qu'ouvert.
create policy "tools_select_visible"
  on public.tools for select
  to anon, authenticated
  using (
    status = 'active'
    and (
      visibility = 'public'
      or (visibility = 'authenticated' and (select auth.uid()) is not null)
    )
  );

create index if not exists tools_active_idx
  on public.tools (category_id, sort_order)
  where status = 'active';

-- -----------------------------------------------------------------------------
-- Seed des huit catégories
-- -----------------------------------------------------------------------------
-- ⚠️ CE BLOC EST LA CONTREPARTIE SQL DE src/config/categories.ts.
-- `src/config/categories.test.ts` lit ce fichier et compare slug, nom,
-- description courte, icône et ordre. Toute divergence casse `npm test`.
-- Modifier l'un sans l'autre est donc mécaniquement impossible.
-- -----------------------------------------------------------------------------
insert into public.categories (slug, name, short_description, description, icon, sort_order, status) values
  ('electrical',   'Électricité',            'Loi d''Ohm, puissance, tension, courant, résistance.',
   'Loi d''Ohm, puissance, chute de tension, sections de câbles, protections et dimensionnement selon la norme NF C 15-100.',
   'zap',         10, 'active'),
  ('fiber-optics', 'Fibre optique',          'Codes couleur, bilans de liaison, atténuation, dBm/mW.',
   'Codes couleur jusqu''à 3456 FO, bilans de liaison, budgets optiques, atténuation et conversions dBm/mW.',
   'cable',       20, 'active'),
  ('telecom',      'Télécoms',               'Liaisons radio, antennes, propagation, budgets de puissance.',
   'Bilans de liaison radio, calculs d''antennes, affaiblissement en espace libre, zones de Fresnel et budgets de puissance.',
   'radio-tower', 30, 'active'),
  ('networking',   'Réseaux & Informatique', 'IPv4, IPv6, CIDR, sous-réseaux, plages d''adresses.',
   'Adressage IPv4 et IPv6, CIDR, sous-réseaux, VLSM, masques, plages d''adresses et conversions binaires.',
   'network',     40, 'active'),
  ('mechanical',   'Mécanique',              'Couples, transmissions, engrenages, résistance des matériaux.',
   'Couples de serrage, transmissions, engrenages, résistance des matériaux, contraintes et facteurs de sécurité.',
   'cog',         50, 'active'),
  ('hydraulics',   'Hydraulique',            'Débits, pertes de charge, pressions, conduites, pompes.',
   'Débits, pertes de charge, pressions, dimensionnement de conduites, pompes et vérins hydrauliques.',
   'droplets',    60, 'active'),
  ('construction', 'BTP',                    'Métrés, béton, dosages, surfaces, pentes, terrassement.',
   'Métrés, volumes de béton, dosages, surfaces, pentes, terrassement et quantitatifs de chantier.',
   'hard-hat',    70, 'active'),
  ('general',      'Outils généraux',        'Calculatrice, pourcentages, conversions d''unités, temps.',
   'Calculatrice scientifique, pourcentages, conversions d''unités, temps, distances et décibels.',
   'calculator',  80, 'active')
on conflict (slug) do update set
  name              = excluded.name,
  short_description = excluded.short_description,
  description       = excluded.description,
  icon              = excluded.icon,
  sort_order        = excluded.sort_order,
  status            = excluded.status;

-- -----------------------------------------------------------------------------
-- Seed des outils déjà implémentés
-- -----------------------------------------------------------------------------
-- Les six outils de `src/tools/` (le gabarit `_template` est exclu du registry
-- et n'a donc rien à faire au catalogue). `reconcileRegistryWithCatalog()`
-- signalait jusqu'ici six divergences : elles disparaissent.
--
-- Le `slug` est le point de jointure avec `defineTool()` — il doit être
-- STRICTEMENT identique.
-- -----------------------------------------------------------------------------
insert into public.tools (slug, category_id, name, short_description, description, keywords, icon, sort_order, status, visibility)
select v.slug, c.id, v.name, v.short_description, v.description, v.keywords, v.icon, v.sort_order, 'active'::public.content_status, v.visibility
from (values
  ('ohm-law-power', 'electrical', 'Loi d''Ohm & Puissance UTE',
   'Puissance active, apparente, réactive et chute de tension.',
   'Calcul de puissance active, apparente, réactive et chute de tension en Monophasé et Triphasé (UTE C 15-105).',
   array['électricité','ohm','puissance','triphasé','tension','ampère','ute','chute de tension','kva','kw'],
   'zap', 10, 'public'::public.tool_visibility),

  ('fiber-attenuation', 'fiber-optics', 'Bilan d''atténuation fibre optique',
   'Perte linéique, épissures, connecteurs et marge ISO 11801.',
   'Calcul du bilan d''atténuation optique FTTH/Monomode (perte linéique, épissures, connecteurs et marge ISO 11801).',
   array['fibre','optique','atténuation','ftth','itu-t','db','monomode','réflectométrie'],
   'cable', 10, 'public'::public.tool_visibility),

  ('fiber-color-code', 'fiber-optics', 'Codes couleurs de fibre optique (6 à 3456 FO)',
   'Identification des tubes et fibres selon Orange, TIA-598 et DIN.',
   'Identification instantanée des tubes et fibres optiques selon les normes Orange / France Télécom, TIA-598 et DIN 0888.',
   array['fibre','optique','couleur','code couleur','orange','ftth','tia-598','din','tube','épissure','câblage'],
   'palette', 20, 'public'::public.tool_visibility),

  ('subnet-calculator', 'networking', 'Calculateur de sous-réseau IP / CIDR',
   'Masque, adresse réseau, broadcast et plages d''hôtes.',
   'Découpage de sous-réseau IPv4, calcul du masque, adresse réseau, broadcast et plages d''hôtes exploitables.',
   array['réseau','ip','ipv4','cidr','masque','subnet','broadcast','adressage'],
   'network', 10, 'public'::public.tool_visibility),

  ('scientific-calculator', 'general', 'Calculatrice scientifique d''ingénierie',
   'Trigonométrie, logarithmes, puissances, constantes physiques.',
   'Calculatrice scientifique complète : trigonométrie (deg/rad), logarithmes, puissances, factorielle, constantes physiques et historique.',
   array['calculatrice','scientifique','trigonométrie','sin','cos','tan','log','ln','racine','puissance','factorielle','maths'],
   'calculator', 10, 'public'::public.tool_visibility),

  ('dbm-mw-converter', 'general', 'Convertisseur dBm ↔ Milliwatts (mW)',
   'Conversion de puissance optique et RF, tension RMS sous 50 Ω.',
   'Conversion bidirectionnelle de puissance optique et radiofréquence (dBm, mW, Watts) et calcul de la tension RMS sous 50 Ω.',
   array['dbm','mw','milliwatt','watts','conversion','puissance','dbrf','vrms','volts','maths'],
   'calculator', 20, 'public'::public.tool_visibility)
) as v(slug, category_slug, name, short_description, description, keywords, icon, sort_order, visibility)
join public.categories c on c.slug = v.category_slug
on conflict (slug) do update set
  category_id       = excluded.category_id,
  name              = excluded.name,
  short_description = excluded.short_description,
  description       = excluded.description,
  keywords          = excluded.keywords,
  icon              = excluded.icon,
  sort_order        = excluded.sort_order,
  status            = excluded.status,
  visibility        = excluded.visibility;

comment on column public.tools.visibility is
  'public = sans compte · authenticated = compte requis · pro = abonnement requis (voir migration billing).';
