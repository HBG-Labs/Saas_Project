-- =============================================================================
-- Types d'intervention : ce que le cœur ne savait pas dire
-- =============================================================================
--
-- LE MANQUE
--
-- Une mission porte un intitulé, un client, une adresse, une priorité. Elle ne
-- dit jamais QUEL GENRE de travail elle recouvre. Or c'est exactement l'ancrage
-- dont un formulaire métier a besoin : « Raccordement FTTH » appelle d'autres
-- champs que « Entretien annuel d'une pompe à chaleur ».
--
-- La colonne `missions.category_id` semblait jouer ce rôle. Elle pointe en
-- réalité `categories`, la taxonomie du CATALOGUE PUBLIC D'OUTILS — globale,
-- sans `organization_id`, avec les slugs `fiber-optics`, `electrical`,
-- `mechanical`, `hydraulics`… Classer une mission de paysagiste sous « Fibre
-- optique » n'a aucun sens.
--
-- CE QUE LA VÉRIFICATION A MONTRÉ
--
-- Avant d'écrire une correspondance, j'ai regardé les données : sur les
-- DIX-HUIT missions des deux organisations, AUCUNE n'a de `category_id`. La
-- colonne existe, l'API la mentionne, mais aucun écran ne l'a jamais remplie.
--
-- Il n'y a donc rien à reporter. Le risque que j'avais identifié — une
-- correspondance fausse reclassant silencieusement des missions historiques —
-- n'a pas de matière. C'est le genre de vérification qui économise une
-- migration délicate ; l'omettre aurait produit une table de correspondance
-- élaborée pour zéro ligne.
--
-- `category_id` N'EST PAS SUPPRIMÉE ICI
--
-- Elle reste en place, inutilisée. La retirer demande de toucher
-- `missions.api.ts` et de régénérer les types : c'est une modification visible,
-- qui mérite son propre changement plutôt que d'être glissée dans une migration
-- de données.
--
-- POURQUOI `industry_code` EST OBLIGATOIRE
--
-- La tentation serait de le laisser nul pour des types « universels » —
-- Maintenance, Dépannage — partagés par tous les métiers. Ce serait une erreur :
-- chaque type portera son propre formulaire, et un « Dépannage » commun
-- imposerait un formulaire commun à un frigoriste et à un jardinier. Deux types
-- qui partagent un nom restent deux types.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- intervention_types
-- -----------------------------------------------------------------------------
create table if not exists public.intervention_types (
  id            uuid primary key default gen_random_uuid(),
  industry_code text not null references public.industries (code) on delete restrict,
  -- Code stable dans le métier, pas globalement : `maintenance` existe pour la
  -- fibre ET pour le froid, et ce sont deux types distincts.
  code          text not null check (code ~ '^[a-z][a-z0-9_]*$'),
  label         text not null check (char_length(label) between 2 and 80),
  description   text,
  icon          text not null default 'clipboard-list',
  sort_order    integer not null default 0,
  status        public.content_status not null default 'active',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (industry_code, code)
);

comment on table public.intervention_types is
  'Nature du travail, par métier. Ancrage des formulaires et check-lists. Référentiel, jamais écrit par un client.';

create index if not exists intervention_types_industry_idx
  on public.intervention_types (industry_code, status, sort_order);

drop trigger if exists intervention_types_set_updated_at on public.intervention_types;
create trigger intervention_types_set_updated_at
  before update on public.intervention_types
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Pack fibre & télécom
-- -----------------------------------------------------------------------------
--
-- Ces sept types ne sont pas inventés : ils couvrent les treize missions
-- réellement présentes en base — « Raccordement FTTH », « Tirage fibre »,
-- « Mesure réflectométrie », « Maintenance préventive NRO », « Dépannage box »,
-- « Étude de faisabilité », « Remplacement PM », « Installation switch »,
-- « Audit réseau », « Relevé d'infrastructure ».
--
-- Partir des intitulés observés plutôt que d'une nomenclature théorique : c'est
-- le vocabulaire que les équipes emploient déjà.
insert into public.intervention_types (industry_code, code, label, description, icon, sort_order)
values
  ('fiber_telecom', 'connection', 'Raccordement client',
   'Raccordement FTTH, entreprise ou desserte terminale.', 'plug-zap', 10),
  ('fiber_telecom', 'cabling', 'Tirage & pose de câble',
   'Déroulage, tirage en fourreau, pose aérienne, lovage.', 'cable', 20),
  ('fiber_telecom', 'measurement', 'Mesures & recette',
   'Réflectométrie OTDR, photométrie, procès-verbal de recette.', 'activity', 30),
  ('fiber_telecom', 'maintenance', 'Maintenance préventive',
   'Visite périodique NRO, PM, armoire — contrôle et nettoyage.', 'shield-check', 40),
  ('fiber_telecom', 'repair', 'Dépannage',
   'Intervention curative sur signalement client ou supervision.', 'wrench', 50),
  ('fiber_telecom', 'equipment_swap', 'Installation & remplacement',
   'Pose ou échange d''équipement actif : box, switch, PM.', 'server', 60),
  ('fiber_telecom', 'survey', 'Étude & relevé',
   'Faisabilité, relevé d''infrastructure, audit de réseau existant.', 'search', 70),

-- -----------------------------------------------------------------------------
-- Pack générique
-- -----------------------------------------------------------------------------
--
-- Une organisation sans métier spécialisé ne doit pas se retrouver devant une
-- liste vide. Quatre types suffisent à couvrir la quasi-totalité des
-- interventions de terrain, quel que soit le corps de métier.
  ('general', 'installation', 'Installation',
   'Pose, mise en service, première intervention sur site.', 'hammer', 10),
  ('general', 'maintenance', 'Entretien',
   'Visite périodique, contrôle, opération préventive.', 'shield-check', 20),
  ('general', 'repair', 'Dépannage',
   'Intervention curative à la suite d''un signalement.', 'wrench', 30),
  ('general', 'survey', 'Visite technique',
   'Relevé, étude préalable, chiffrage sur place.', 'search', 40)
on conflict (industry_code, code) do update
  set label       = excluded.label,
      description = excluded.description,
      icon        = excluded.icon,
      sort_order  = excluded.sort_order,
      updated_at  = now();

-- -----------------------------------------------------------------------------
-- missions.intervention_type_id
-- -----------------------------------------------------------------------------
--
-- NULLABLE, et sans rétro-remplissage : les missions existantes n'ont aucune
-- catégorie à convertir, et leur en attribuer une au jugé — d'après leur
-- intitulé, par exemple — écrirait une donnée que personne n'a saisie. Une
-- mission sans type est un fait, pas une anomalie.
--
-- `on delete restrict` : un type utilisé par une mission ne se supprime pas.
-- On l'archive, ce qui le retire des propositions sans dénaturer l'historique.
alter table public.missions
  add column if not exists intervention_type_id uuid
    references public.intervention_types (id) on delete restrict;

comment on column public.missions.intervention_type_id is
  'Nature du travail. Doit appartenir au métier de l''organisation — vérifié par le trigger `missions_intervention_type_matches_industry`.';

create index if not exists missions_intervention_type_idx
  on public.missions (intervention_type_id)
  where intervention_type_id is not null;

-- -----------------------------------------------------------------------------
-- Cohérence métier
-- -----------------------------------------------------------------------------
--
-- Rien n'empêcherait, par une requête forgée, d'attacher un type « Raccordement
-- FTTH » à la mission d'une entreprise de paysage. La clé étrangère ne vérifie
-- que l'existence du type, pas sa pertinence.
--
-- Ce contrôle appartient au serveur. Le frontend ne proposera que les types du
-- bon métier, mais une interface n'est jamais une barrière — c'est le principe
-- appliqué partout ailleurs dans ce schéma.
--
-- Le type `general` est accepté par TOUTES les organisations : il représente le
-- fonds commun des interventions de terrain, et une entreprise spécialisée peut
-- légitimement enregistrer une simple « visite technique ».
create or replace function app.enforce_mission_intervention_type()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_industry  text;
  v_type_industry text;
begin
  if new.intervention_type_id is null then
    return new;
  end if;

  select o.industry into v_org_industry
  from public.organizations o
  where o.id = new.organization_id;

  select t.industry_code into v_type_industry
  from public.intervention_types t
  where t.id = new.intervention_type_id;

  -- Une organisation sans métier déclaré n'est contrainte par rien : elle n'a
  -- pas choisi de spécialisation, lui refuser un type serait incohérent.
  if v_org_industry is null then
    return new;
  end if;

  if v_type_industry <> 'general' and v_type_industry <> v_org_industry then
    raise exception
      'Ce type d''intervention appartient au métier « % », l''entreprise exerce « % ».',
      v_type_industry, v_org_industry
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists missions_intervention_type_matches_industry on public.missions;
create trigger missions_intervention_type_matches_industry
  before insert or update of intervention_type_id, organization_id on public.missions
  for each row execute function app.enforce_mission_intervention_type();

-- -----------------------------------------------------------------------------
-- RLS et privilèges
-- -----------------------------------------------------------------------------
--
-- Lecture réservée aux comptes connectés, comme `mission_status_transitions` :
-- ce référentiel sert à composer un formulaire de mission, il n'a rien à faire
-- dans la vitrine publique.
--
-- Aucune écriture cliente. Révocation préalable des privilèges accordés par
-- défaut à toute nouvelle table de `public`.
alter table public.intervention_types enable row level security;

drop policy if exists "intervention_types_select_authenticated" on public.intervention_types;
create policy "intervention_types_select_authenticated"
  on public.intervention_types for select
  to authenticated
  using (status = 'active');

revoke all on public.intervention_types from public, anon, authenticated;
grant select on public.intervention_types to authenticated;
