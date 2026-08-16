-- =============================================================================
-- Le métier devient une donnée
-- =============================================================================
--
-- CE QUE CETTE MIGRATION FAIT, ET NE FAIT PAS
--
-- Elle pose un référentiel de métiers et rattache chaque organisation au sien.
-- Rien d'autre. Aucune policy n'est modifiée, aucun comportement ne change, et
-- l'application se comporte exactement comme avant son application.
--
-- C'est délibéré : c'est la fondation sur laquelle s'appuieront les types
-- d'intervention, les formulaires, les check-lists et le filtrage des outils.
-- Une fondation se pose seule, se vérifie seule, et se retire seule si elle
-- est fausse.
--
-- POURQUOI UN RÉFÉRENTIEL PLUTÔT QU'UN ENUM
--
-- `equipment_category` est un enum, et c'est aujourd'hui un défaut reconnu :
-- une valeur d'enum s'ajoute mais ne se retire jamais, et le type ne peut
-- porter ni libellé, ni icône, ni ordre d'affichage. Un métier a besoin des
-- trois. Une table de référence, comme `plans` et `mission_status_transitions`,
-- est le bon outil.
--
-- POURQUOI UN SEUL MÉTIER PAR ORGANISATION
--
-- Décision produit. Une entreprise qui exerce deux métiers créera deux
-- organisations. Le modèle reste ouvert : passer un jour à N métiers demandera
-- une table de liaison, sans rien invalider de ce qui est posé ici — la colonne
-- deviendra alors le métier PRINCIPAL.
--
-- LE VOCABULAIRE
--
-- `vocabulary` est un `jsonb` de LIBELLÉS, jamais de logique. Un paysagiste
-- parle de « chantier » là où un fibreur parle de « mission ». Une dizaine de
-- clés, jamais interrogées en SQL : le document est ici le bon type. Toute
-- valeur qui devrait être filtrée ou agrégée devrait être une colonne.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- industries
-- -----------------------------------------------------------------------------
create table if not exists public.industries (
  -- Code en `snake_case`, stable et lisible : il apparaîtra dans les
  -- migrations de packs métier, dans le registre d'outils et dans les URL.
  code        text primary key check (code ~ '^[a-z][a-z0-9_]*$'),
  label       text not null check (char_length(label) between 2 and 80),
  description text,
  -- Nom d'icône lucide, comme partout ailleurs dans le projet : une chaîne,
  -- pour ne pas coupler la base à une librairie d'icônes.
  icon        text not null default 'briefcase',
  sort_order  integer not null default 0,
  -- `content_status` plutôt qu'un booléen : un métier peut être en préparation
  -- (`draft`) sans être proposé, ou retiré (`archived`) sans disparaître des
  -- organisations qui l'exercent déjà.
  status      public.content_status not null default 'active',
  vocabulary  jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.industries is
  'Référentiel des métiers de terrain. Public en lecture, jamais écrit par un client.';
comment on column public.industries.vocabulary is
  'Libellés propres au métier (mission, technicien, intervention…). Affichage uniquement — aucune logique ne doit en dépendre.';

create index if not exists industries_status_order_idx
  on public.industries (status, sort_order);

drop trigger if exists industries_set_updated_at on public.industries;
create trigger industries_set_updated_at
  before update on public.industries
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Semis
-- -----------------------------------------------------------------------------
--
-- Les métiers annoncés au produit, tous en `active`. Ceux qui n'ont pas encore
-- de pack (types d'intervention, formulaires) restent parfaitement utilisables :
-- l'organisation dispose du cœur complet, elle n'a simplement pas encore de
-- formulaires spécialisés. Mieux vaut un métier nommé sans pack qu'un métier
-- absent de la liste au moment de l'inscription.
--
-- `general` existe pour deux raisons : c'est le repli d'une organisation créée
-- avant cette migration si le rétro-remplissage échouait, et c'est le choix
-- honnête d'une entreprise dont le métier ne figure pas encore.
insert into public.industries (code, label, description, icon, sort_order, vocabulary)
values
  ('fiber_telecom', 'Fibre & Télécom',
   'Raccordement FTTH, mesures optiques, réseaux et infrastructures télécom.',
   'cable', 10,
   jsonb_build_object('worker', 'Technicien', 'job', 'Mission', 'visit', 'Intervention')),

  ('hvac', 'Froid & Climatisation',
   'Installation, entretien et dépannage de climatisation, pompes à chaleur et froid commercial.',
   'snowflake', 20,
   jsonb_build_object('worker', 'Frigoriste', 'job', 'Mission', 'visit', 'Intervention')),

  ('landscaping', 'Paysage & Espaces verts',
   'Création et entretien d''espaces verts, élagage, tonte et aménagement extérieur.',
   'trees', 30,
   jsonb_build_object('worker', 'Jardinier', 'job', 'Chantier', 'visit', 'Passage')),

  ('electrical', 'Électricité',
   'Installation et maintenance électrique, basse et haute tension.',
   'zap', 40,
   jsonb_build_object('worker', 'Électricien', 'job', 'Mission', 'visit', 'Intervention')),

  ('plumbing', 'Plomberie',
   'Installation sanitaire, réseaux d''eau, recherche et réparation de fuites.',
   'droplets', 50,
   jsonb_build_object('worker', 'Plombier', 'job', 'Mission', 'visit', 'Intervention')),

  ('heating', 'Chauffage',
   'Chaudières, radiateurs, planchers chauffants et entretien réglementaire.',
   'flame', 60,
   jsonb_build_object('worker', 'Chauffagiste', 'job', 'Mission', 'visit', 'Intervention')),

  ('pest_control', 'Dératisation & Désinsectisation',
   'Traitement, prévention et suivi sanitaire des nuisibles.',
   'bug', 70,
   jsonb_build_object('worker', 'Applicateur', 'job', 'Mission', 'visit', 'Passage')),

  ('cleaning', 'Nettoyage',
   'Nettoyage de locaux, remise en état et entretien régulier.',
   'sparkles', 80,
   jsonb_build_object('worker', 'Agent', 'job', 'Prestation', 'visit', 'Passage')),

  ('home_care', 'Aide à domicile',
   'Accompagnement, aide ménagère et services à la personne.',
   'heart-handshake', 90,
   jsonb_build_object('worker', 'Intervenant', 'job', 'Prestation', 'visit', 'Visite')),

  ('it_networks', 'Réseaux & IT',
   'Infrastructure informatique, réseaux d''entreprise et maintenance de parc.',
   'server', 100,
   jsonb_build_object('worker', 'Technicien', 'job', 'Mission', 'visit', 'Intervention')),

  ('general', 'Autre métier de terrain',
   'Cœur NexoraTech sans spécialisation. Convient à tout métier d''intervention.',
   'briefcase', 999,
   jsonb_build_object('worker', 'Intervenant', 'job', 'Mission', 'visit', 'Intervention'))
on conflict (code) do update
  set label       = excluded.label,
      description = excluded.description,
      icon        = excluded.icon,
      sort_order  = excluded.sort_order,
      vocabulary  = excluded.vocabulary,
      updated_at  = now();

-- -----------------------------------------------------------------------------
-- organizations.industry
-- -----------------------------------------------------------------------------
--
-- NULLABLE, et cela restera vrai. Une organisation sans métier déclaré n'est
-- pas une anomalie : elle dispose du cœur, sans spécialisation. Rendre la
-- colonne obligatoire casserait la création d'organisation le temps que
-- l'interface propose le choix, et transformerait une évolution en panne.
--
-- `on delete restrict` : un métier exercé par une organisation ne se supprime
-- pas. On l'archive (`status = 'archived'`), ce qui le retire des propositions
-- sans dénaturer les organisations existantes.
alter table public.organizations
  add column if not exists industry text
    references public.industries (code) on delete restrict;

comment on column public.organizations.industry is
  'Métier exercé. NULL = cœur sans spécialisation. Gouverne les types d''intervention, formulaires et outils proposés.';

create index if not exists organizations_industry_idx
  on public.organizations (industry)
  where industry is not null;

-- -----------------------------------------------------------------------------
-- Rétro-remplissage
-- -----------------------------------------------------------------------------
--
-- Les organisations existantes exercent la fibre. Ce n'est pas une hypothèse
-- commode : le produit ne s'adressait qu'à ce métier jusqu'à présent, ses
-- outils sont tous optiques ou réseaux, et son catalogue de prestations parle
-- de soudures et de recette OTDR.
--
-- La condition `industry is null` rend l'opération rejouable : une seconde
-- exécution ne touchera pas une organisation dont le métier aurait entre-temps
-- été changé à la main.
-- `updated_at` n'est pas posé ici : le trigger `organizations_set_updated_at`
-- s'en charge. L'écrire à la main laisserait croire qu'il n'existe pas.
update public.organizations
set industry = 'fiber_telecom'
where industry is null;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
--
-- Référentiel public en lecture, exactement comme `plans` : il ne contient
-- aucune donnée d'entreprise, et la page d'inscription doit pouvoir proposer la
-- liste des métiers avant même qu'une session existe.
--
-- Aucune policy d'écriture. Comme pour `subscriptions`, l'absence de policy
-- vaut interdiction : seule une migration alimente cette table.
alter table public.industries enable row level security;

drop policy if exists "industries_select_public" on public.industries;
create policy "industries_select_public"
  on public.industries for select
  to anon, authenticated
  using (status = 'active');

-- Table rase avant d'accorder, comme dans `20260808100900_grants.sql`.
--
-- Ce n'est pas une precaution de style. Supabase applique des privileges par
-- defaut qui donnent `all` a `anon` et `authenticated` sur toute nouvelle table
-- de `public` : sans cette revocation, `anon` disposerait de DELETE sur le
-- referentiel des metiers, et seule l'absence de policy l'arreterait. Une
-- policy trop large ajoutee un jour, et le droit serait deja la.
revoke all on public.industries from public, anon, authenticated;
grant select on public.industries to anon, authenticated;
