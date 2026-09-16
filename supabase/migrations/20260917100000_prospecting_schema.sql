-- =============================================================================
-- Prospect Radar — schéma, RLS, aucune donnée détectée
-- =============================================================================
--
-- CE QUE CETTE MIGRATION FAIT, ET NE FAIT PAS
--
-- Elle pose la structure complète (tables, contraintes, RLS) et les quelques
-- garanties qui ne peuvent pas attendre une phase ultérieure sans risquer
-- d'être oubliées (opposition irréversible, journal insert-only). Elle NE :
--   - n'appelle aucune API externe (Phase 3) ;
--   - ne calcule aucun score (Phase 5 — les colonnes existent, vides) ;
--   - ne peuple `prospecting_sectors` avec des codes NAF (Phase 4 — un choix
--     de codes mérite sa propre relecture, pas une ligne noyée ici) ;
--   - ne peuple `prospecting_message_templates` (Phase 8) ;
--   - ne crée ni CRON ni Edge Function (Phase 10).
--
-- `prospecting_zones`, en revanche, EST peuplée : les cinq zones et leur ordre
-- de priorité sont déjà entièrement arrêtés (validation du brief), il n'y a
-- rien à reconsidérer en Phase 4 sur ce point précis — seule leur activation
-- progressive (Martinique d'abord) est un geste opérationnel, pas une donnée
-- qui manque.
--
-- ISOLATION DES CLIENTS REZO360 : LE PRINCIPE TENU DE BOUT EN BOUT
--
-- Aucune table de ce fichier ne porte de colonne `organization_id`. Aucune
-- policy ne s'ouvre à `authenticated` sans passer par
-- `app.has_platform_permission(...)` (20260917090000). Un client REZO360,
-- aussi propriétaire soit-il de son organisation, n'a et n'aura jamais de
-- ligne dans `platform_admins` : structurellement, `has_platform_permission`
-- lui répond `false`, quelle que soit la table interrogée. Vérifié en fin de
-- fichier par un contrôle qui échoue si une policy plus large existait.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Statuts du parcours commercial — enum, comme mission_status et quote_status :
-- un vocabulaire fini, qui gagne à être contraint plutôt que du texte libre.
-- -----------------------------------------------------------------------------
create type public.prospect_status as enum (
  'nouveau',
  'a_qualifier',
  'a_contacter',
  'contacte',
  'a_relancer',
  'interesse',
  'essai',
  'converti',
  'refuse',
  'ignore',
  'ne_plus_contacter'
);

-- -----------------------------------------------------------------------------
-- prospecting_zones
-- -----------------------------------------------------------------------------
create table public.prospecting_zones (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique check (code ~ '^[a-z][a-z0-9_]*$'),
  label           text not null check (char_length(label) between 2 and 80),
  -- Un département (« 972 ») ou NULL pour une zone qui en couvre plusieurs
  -- (la France métropolitaine, avant que vous ne l'affiniez département par
  -- département — `region_code` porte alors la maille réelle).
  department_code text,
  region_code     text,
  territory       text not null check (territory in ('outre_mer', 'metropole')),
  priority        integer not null check (priority >= 1),
  active          boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.prospecting_zones is
  'Zones de prospection, activables indépendamment. Priorité = ordre de traitement du worker, pas une note commerciale.';

create unique index prospecting_zones_priority_idx on public.prospecting_zones (priority);
create index prospecting_zones_active_idx on public.prospecting_zones (active) where active;

create trigger prospecting_zones_set_updated_at
  before update on public.prospecting_zones
  for each row execute function public.set_updated_at();

insert into public.prospecting_zones (code, label, department_code, territory, priority, active) values
  ('martinique',    'Martinique',              '972', 'outre_mer', 1, true),
  ('guadeloupe',    'Guadeloupe',              '971', 'outre_mer', 2, false),
  ('guyane',        'Guyane',                  '973', 'outre_mer', 3, false),
  ('reunion',       'La Réunion',              '974', 'outre_mer', 4, false),
  ('metropole',     'France métropolitaine',   null,  'metropole', 5, false);

-- -----------------------------------------------------------------------------
-- prospecting_sectors — structure posée, contenu en Phase 4
-- -----------------------------------------------------------------------------
create table public.prospecting_sectors (
  id               uuid primary key default gen_random_uuid(),
  ape_code         text not null unique check (ape_code ~ '^[0-9]{2}\.[0-9]{2}[A-Z]$'),
  label            text not null check (char_length(label) between 2 and 150),
  -- Catégorie REZO360 : référence le référentiel métiers déjà en place,
  -- plutôt que d'en inventer un second. NULL toléré : un code NAF ciblé peut
  -- ne correspondre à aucun métier REZO360 précis (BTP générique, par ex.).
  industry_code    text references public.industries (code) on delete set null,
  relevance_weight numeric not null default 1.0 check (relevance_weight between 0 and 1),
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.prospecting_sectors is
  'Codes NAF/APE ciblés par la prospection, avec leur poids de pertinence. Vide tant que la Phase 4 n''a pas validé les codes.';

create index prospecting_sectors_active_idx on public.prospecting_sectors (active) where active;

create trigger prospecting_sectors_set_updated_at
  before update on public.prospecting_sectors
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- prospecting_score_weights — structure posée, contenu en Phase 5
-- -----------------------------------------------------------------------------
create table public.prospecting_score_weights (
  criterion   text primary key check (criterion ~ '^[a-z_]+$'),
  weight      numeric not null check (weight >= 0),
  description text,
  updated_at  timestamptz not null default now()
);

comment on table public.prospecting_score_weights is
  'Pondérations du score d''opportunité, modifiables sans déploiement. Vide tant que la Phase 5 n''a pas posé la formule.';

create trigger prospecting_score_weights_set_updated_at
  before update on public.prospecting_score_weights
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- prospects — l'entreprise, identifiée par SIREN
-- -----------------------------------------------------------------------------
create table public.prospects (
  siren                 text primary key check (siren ~ '^[0-9]{9}$'),

  raison_sociale        text not null check (char_length(raison_sociale) between 1 and 200),
  nom_commercial        text,
  forme_juridique       text,

  ape_code              text not null check (ape_code ~ '^[0-9]{2}\.[0-9]{2}[A-Z]$'),
  -- Secteur APPARIÉ au moment de la détection. NULL si le code NAF ne
  -- correspond à aucune ligne active de `prospecting_sectors` au moment du
  -- passage du worker — situation qui ne devrait pas arriver si le filtrage
  -- amont est correct, mais la colonne reste nullable plutôt que de bloquer
  -- l'insertion pour une incohérence de configuration.
  sector_id             uuid references public.prospecting_sectors (id) on delete set null,

  created_on            date,
  statut_administratif  text not null default 'actif' check (statut_administratif in ('actif', 'cesse')),
  -- Brute, informative, jamais utilisée dans le score sans décision explicite.
  tranche_effectif      text,

  commune               text,
  code_postal           text,
  departement           text,
  region                text,
  zone_id               uuid references public.prospecting_zones (id) on delete set null,

  source                text not null default 'recherche_entreprises',
  first_detected_at     timestamptz not null default now(),
  last_checked_at       timestamptz not null default now(),

  opportunity_score     integer not null default 0 check (opportunity_score between 0 and 100),
  -- `[{ "criterion": "...", "label": "...", "points": n }]` — jamais une raison
  -- qui ne correspond à aucune donnée réellement présente sur la ligne.
  score_reasons         jsonb not null default '[]'::jsonb,

  -- Priorité de travail manuelle, indépendante du score : vous pouvez remonter
  -- un prospect sans que son score change, ou l'inverse.
  priority              text not null default 'normale' check (priority in ('haute', 'normale', 'basse')),
  status                public.prospect_status not null default 'nouveau',

  assigned_to           uuid references auth.users (id) on delete set null,
  next_followup_at      timestamptz,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table public.prospects is
  'Prospect Radar — entreprises détectées. Aucune colonne organization_id : cette table n''appartient à aucun tenant.';
comment on column public.prospects.score_reasons is
  'Raisons du score, une par critère VÉRIFIÉ. Jamais une raison inventée pour justifier une valeur.';

create index prospects_status_idx on public.prospects (status);
create index prospects_zone_idx on public.prospects (zone_id);
create index prospects_sector_idx on public.prospects (sector_id);
create index prospects_score_idx on public.prospects (opportunity_score desc);
create index prospects_assigned_idx on public.prospects (assigned_to) where assigned_to is not null;
create index prospects_followup_idx on public.prospects (next_followup_at) where next_followup_at is not null;

create trigger prospects_set_updated_at
  before update on public.prospects
  for each row execute function public.set_updated_at();

-- `assigned_to` ne doit jamais pointer vers un utilisateur qui n'est pas
-- administrateur plateforme : sans ce garde, une erreur de saisie (mauvais
-- UUID collé) assignerait silencieusement un prospect à n'importe quel
-- utilisateur REZO360, client compris.
create or replace function app.enforce_prospect_assignee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.assigned_to is not null and not exists (
    select 1 from public.platform_admins where user_id = new.assigned_to
  ) then
    raise exception 'assigned_to doit être un administrateur plateforme.' using errcode = 'foreign_key_violation';
  end if;
  return new;
end;
$$;

create trigger prospects_enforce_assignee
  before insert or update of assigned_to on public.prospects
  for each row execute function app.enforce_prospect_assignee();

-- -----------------------------------------------------------------------------
-- Opposition — la garantie qui doit survivre à TOUT resynchronisation
-- -----------------------------------------------------------------------------
create table public.prospect_suppressions (
  siren        text primary key check (siren ~ '^[0-9]{9}$'),
  reason       text,
  requested_at timestamptz not null default now(),
  created_by   uuid references auth.users (id) on delete set null
);

comment on table public.prospect_suppressions is
  'Liste d''opposition, indépendante de prospects.status. Consultée par le worker AVANT tout upsert (Phase 3) ; '
  'appliquée en base par le trigger ci-dessous, qui ne dépend d''aucune discipline du code appelant.';

-- Le filet de sécurité : même si le worker de synchronisation (Phase 3) avait
-- un jour un bug qui oublie de consulter `prospect_suppressions` avant
-- d'upserter, cette ligne ne pourrait jamais ressortir de `ne_plus_contacter`.
-- C'est délibérément plus fort qu'une discipline de code : une garantie de
-- base de données ne peut pas être contournée par un correctif distrait.
create or replace function app.enforce_prospect_suppression()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.prospect_suppressions where siren = new.siren) then
    new.status := 'ne_plus_contacter';
  end if;
  return new;
end;
$$;

create trigger prospects_enforce_suppression
  before insert or update on public.prospects
  for each row execute function app.enforce_prospect_suppression();

-- -----------------------------------------------------------------------------
-- prospect_establishments — l'établissement, identifié par SIRET
-- -----------------------------------------------------------------------------
create table public.prospect_establishments (
  siret            text primary key check (siret ~ '^[0-9]{14}$'),
  siren            text not null references public.prospects (siren) on delete cascade,
  enseigne         text,
  is_headquarters  boolean not null default false,
  adresse_line     text,
  code_postal      text,
  commune          text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.prospect_establishments is
  'Établissements d''un prospect (SIRET). Un SIREN peut en porter plusieurs ; le siège est signalé, jamais supposé être le premier.';

create index prospect_establishments_siren_idx on public.prospect_establishments (siren);

create trigger prospect_establishments_set_updated_at
  before update on public.prospect_establishments
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- prospect_contacts — coordonnées, avec provenance. Vide tant qu'aucun
-- enrichissement n'est branché (Phase 11) : la structure n'attend que ça.
-- -----------------------------------------------------------------------------
create table public.prospect_contacts (
  id           uuid primary key default gen_random_uuid(),
  siren        text not null references public.prospects (siren) on delete cascade,
  contact_type text not null check (contact_type in ('email', 'phone', 'website')),
  value        text not null check (char_length(value) between 1 and 300),
  source       text not null,
  collected_at timestamptz not null default now(),
  verified_at  timestamptz,
  -- 0 à 1 : laisse la place à un futur fournisseur qui qualifie sa propre
  -- confiance, sans imposer une échelle avant d'en avoir besoin.
  confidence   numeric check (confidence between 0 and 1),
  created_at   timestamptz not null default now()
);

comment on table public.prospect_contacts is
  'Coordonnées collectées, avec provenance et confiance. Aucune ligne n''est jamais inventée : '
  'vide en V1, faute de source d''enrichissement validée.';

create index prospect_contacts_siren_idx on public.prospect_contacts (siren);
create unique index prospect_contacts_dedup_idx on public.prospect_contacts (siren, contact_type, value);

-- -----------------------------------------------------------------------------
-- prospect_notes — libres, éditables par un administrateur
-- -----------------------------------------------------------------------------
create table public.prospect_notes (
  id         uuid primary key default gen_random_uuid(),
  siren      text not null references public.prospects (siren) on delete cascade,
  author_id  uuid references auth.users (id) on delete set null,
  body       text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index prospect_notes_siren_idx on public.prospect_notes (siren, created_at desc);

create trigger prospect_notes_set_updated_at
  before update on public.prospect_notes
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- prospect_followups — relances programmées, jamais un envoi automatique
-- -----------------------------------------------------------------------------
create table public.prospect_followups (
  id           uuid primary key default gen_random_uuid(),
  siren        text not null references public.prospects (siren) on delete cascade,
  due_at       timestamptz not null,
  note         text,
  kind         text,
  created_by   uuid references auth.users (id) on delete set null,
  completed_at timestamptz,
  created_at   timestamptz not null default now()
);

comment on table public.prospect_followups is
  'Relances programmées manuellement. Aucun mécanisme n''envoie quoi que ce soit : c''est un pense-bête, pas un automate.';

create index prospect_followups_due_idx on public.prospect_followups (due_at) where completed_at is null;
create index prospect_followups_siren_idx on public.prospect_followups (siren);

-- -----------------------------------------------------------------------------
-- prospect_activities — timeline insert-only, avec instantané du score aux
-- moments qui comptent
-- -----------------------------------------------------------------------------
create table public.prospect_activities (
  id                    uuid primary key default gen_random_uuid(),
  siren                 text not null references public.prospects (siren) on delete cascade,
  event                 text not null check (event ~ '^[a-z_]+$'),
  actor_id              uuid references auth.users (id) on delete set null,
  -- Posés UNIQUEMENT pour les événements commerciaux qui le justifient
  -- (qualification, premier contact, intérêt, essai, conversion) — NULL pour
  -- une simple note ou un changement mineur. Voir app.snapshot_prospect_score.
  score_snapshot        integer,
  score_reasons_snapshot jsonb,
  metadata              jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now()
);

comment on table public.prospect_activities is
  'Historique inaltérable du parcours commercial. Écrite par trigger, jamais par le client — même patron qu''audit_logs.';

create index prospect_activities_siren_idx on public.prospect_activities (siren, created_at desc);

create or replace function app.reject_prospect_activity_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'La timeline d''un prospect est immuable : ni modification ni suppression.'
    using errcode = 'insufficient_privilege';
end;
$$;

create trigger prospect_activities_immutable
  before update or delete on public.prospect_activities
  for each row execute function app.reject_prospect_activity_mutation();

-- Instantané du score, posé aux transitions qui comptent (§5 de votre
-- validation). Appelée par le trigger de changement de statut ci-dessous —
-- PAS par le futur calcul de score (Phase 5), qui n'a pas à savoir que ces
-- transitions existent.
create or replace function app.snapshot_prospect_score(
  p_siren text, p_event text, p_actor uuid, p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_score   integer;
  v_reasons jsonb;
begin
  select opportunity_score, score_reasons into v_score, v_reasons
  from public.prospects where siren = p_siren;

  insert into public.prospect_activities (siren, event, actor_id, score_snapshot, score_reasons_snapshot, metadata)
  values (p_siren, p_event, p_actor, v_score, v_reasons, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

revoke all on function app.snapshot_prospect_score(text, text, uuid, jsonb) from public, anon, authenticated;

-- Transitions considérées comme des événements commerciaux importants —
-- toutes les autres écrivent quand même une ligne de timeline (event =
-- statut cible), mais sans instantané de score.
create or replace function app.audit_prospect_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if tg_op = 'INSERT' then
    perform app.snapshot_prospect_score(new.siren, 'detecte', v_actor);
    return new;
  end if;

  if new.status is distinct from old.status then
    if new.status in ('a_qualifier', 'contacte', 'interesse', 'essai', 'converti') then
      perform app.snapshot_prospect_score(
        new.siren, new.status::text, v_actor,
        jsonb_build_object('from', old.status, 'to', new.status)
      );
    else
      insert into public.prospect_activities (siren, event, actor_id, metadata)
      values (new.siren, new.status::text, v_actor, jsonb_build_object('from', old.status, 'to', new.status));
    end if;
  end if;

  return new;
end;
$$;

create trigger prospects_audit_status
  after insert or update of status on public.prospects
  for each row execute function app.audit_prospect_status_change();

-- -----------------------------------------------------------------------------
-- prospecting_runs — un run par passage du worker (Phase 3+)
-- -----------------------------------------------------------------------------
create table public.prospecting_runs (
  id             uuid primary key default gen_random_uuid(),
  started_at     timestamptz not null default now(),
  completed_at   timestamptz,
  status         text not null default 'running' check (status in ('running', 'completed', 'completed_with_errors', 'failed')),
  source         text not null default 'recherche_entreprises',
  fetched        integer not null default 0 check (fetched >= 0),
  filtered       integer not null default 0 check (filtered >= 0),
  created        integer not null default 0 check (created >= 0),
  updated        integer not null default 0 check (updated >= 0),
  ignored        integer not null default 0 check (ignored >= 0),
  errors         integer not null default 0 check (errors >= 0),
  error_message  text
);

comment on table public.prospecting_runs is
  'Point de reprise et observabilité du worker quotidien. completed_at NULL + status running = run en cours ou interrompu.';

create index prospecting_runs_started_idx on public.prospecting_runs (started_at desc);

-- -----------------------------------------------------------------------------
-- prospecting_message_templates — structure posée, contenu en Phase 8
-- -----------------------------------------------------------------------------
create table public.prospecting_message_templates (
  id              uuid primary key default gen_random_uuid(),
  sector_id       uuid not null references public.prospecting_sectors (id) on delete cascade,
  opening_variant text,
  pain_points     jsonb not null default '[]'::jsonb,
  features        jsonb not null default '[]'::jsonb,
  body_template   text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.prospecting_message_templates is
  'Gabarits de brouillon par secteur (§18). Vide tant que la Phase 8 n''a pas rédigé les argumentaires.';

create trigger prospecting_message_templates_set_updated_at
  before update on public.prospecting_message_templates
  for each row execute function public.set_updated_at();

-- =============================================================================
-- RLS — une seule règle, répétée sur chaque table : app.has_platform_permission
-- =============================================================================
-- Convention : lecture = 'prospecting.view', écriture = 'prospecting.manage'.
-- `prospecting_zones`/`prospecting_sectors`/`prospecting_score_weights`/
-- `prospecting_message_templates` sont de la CONFIGURATION : lecture par tout
-- administrateur, écriture réservée à 'prospecting.manage' — comme
-- `role_permissions` face à `org_role`.

do $$
declare
  t text;
begin
  foreach t in array array[
    'prospecting_zones', 'prospecting_sectors', 'prospecting_score_weights',
    'prospects', 'prospect_establishments', 'prospect_contacts', 'prospect_notes',
    'prospect_followups', 'prospect_activities', 'prospect_suppressions',
    'prospecting_runs', 'prospecting_message_templates'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant select on table public.%I to authenticated', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (app.has_platform_permission(''prospecting.view''))',
      t || '_select_platform', t
    );
  end loop;
end
$$;

-- Écriture : `prospecting.manage`, table par table (les triggers ci-dessus
-- restent seuls maîtres de `prospect_activities` : aucune policy insert/update
-- n'y est ajoutée pour le client, y compris un administrateur).
grant insert, update, delete on table public.prospecting_zones to authenticated;
create policy "prospecting_zones_manage_platform" on public.prospecting_zones
  for insert to authenticated with check (app.has_platform_permission('prospecting.manage'));
create policy "prospecting_zones_update_platform" on public.prospecting_zones
  for update to authenticated using (app.has_platform_permission('prospecting.manage'))
  with check (app.has_platform_permission('prospecting.manage'));
create policy "prospecting_zones_delete_platform" on public.prospecting_zones
  for delete to authenticated using (app.has_platform_permission('prospecting.manage'));

grant insert, update, delete on table public.prospecting_sectors to authenticated;
create policy "prospecting_sectors_manage_platform" on public.prospecting_sectors
  for insert to authenticated with check (app.has_platform_permission('prospecting.manage'));
create policy "prospecting_sectors_update_platform" on public.prospecting_sectors
  for update to authenticated using (app.has_platform_permission('prospecting.manage'))
  with check (app.has_platform_permission('prospecting.manage'));
create policy "prospecting_sectors_delete_platform" on public.prospecting_sectors
  for delete to authenticated using (app.has_platform_permission('prospecting.manage'));

grant insert, update, delete on table public.prospecting_score_weights to authenticated;
create policy "prospecting_score_weights_manage_platform" on public.prospecting_score_weights
  for insert to authenticated with check (app.has_platform_permission('prospecting.manage'));
create policy "prospecting_score_weights_update_platform" on public.prospecting_score_weights
  for update to authenticated using (app.has_platform_permission('prospecting.manage'))
  with check (app.has_platform_permission('prospecting.manage'));
create policy "prospecting_score_weights_delete_platform" on public.prospecting_score_weights
  for delete to authenticated using (app.has_platform_permission('prospecting.manage'));

grant insert, update, delete on table public.prospecting_message_templates to authenticated;
create policy "prospecting_templates_manage_platform" on public.prospecting_message_templates
  for insert to authenticated with check (app.has_platform_permission('prospecting.manage'));
create policy "prospecting_templates_update_platform" on public.prospecting_message_templates
  for update to authenticated using (app.has_platform_permission('prospecting.manage'))
  with check (app.has_platform_permission('prospecting.manage'));
create policy "prospecting_templates_delete_platform" on public.prospecting_message_templates
  for delete to authenticated using (app.has_platform_permission('prospecting.manage'));

-- `prospects` : écrit par le worker (service_role, Phase 3) et par
-- l'administrateur (qualification, priorité, assignation, statut manuel).
grant insert, update on table public.prospects to authenticated;
create policy "prospects_insert_platform" on public.prospects
  for insert to authenticated with check (app.has_platform_permission('prospecting.manage'));
create policy "prospects_update_platform" on public.prospects
  for update to authenticated using (app.has_platform_permission('prospecting.manage'))
  with check (app.has_platform_permission('prospecting.manage'));
-- Aucune policy DELETE : un prospect ne se supprime pas, il se marque
-- 'ne_plus_contacter' ou 'ignore' — la ligne et son historique restent.

grant insert, update, delete on table public.prospect_establishments to authenticated;
create policy "prospect_establishments_insert_platform" on public.prospect_establishments
  for insert to authenticated with check (app.has_platform_permission('prospecting.manage'));
create policy "prospect_establishments_update_platform" on public.prospect_establishments
  for update to authenticated using (app.has_platform_permission('prospecting.manage'))
  with check (app.has_platform_permission('prospecting.manage'));
create policy "prospect_establishments_delete_platform" on public.prospect_establishments
  for delete to authenticated using (app.has_platform_permission('prospecting.manage'));

grant insert, update, delete on table public.prospect_contacts to authenticated;
create policy "prospect_contacts_insert_platform" on public.prospect_contacts
  for insert to authenticated with check (app.has_platform_permission('prospecting.manage'));
create policy "prospect_contacts_update_platform" on public.prospect_contacts
  for update to authenticated using (app.has_platform_permission('prospecting.manage'))
  with check (app.has_platform_permission('prospecting.manage'));
create policy "prospect_contacts_delete_platform" on public.prospect_contacts
  for delete to authenticated using (app.has_platform_permission('prospecting.manage'));

grant insert, update, delete on table public.prospect_notes to authenticated;
create policy "prospect_notes_insert_platform" on public.prospect_notes
  for insert to authenticated with check (app.has_platform_permission('prospecting.manage'));
create policy "prospect_notes_update_platform" on public.prospect_notes
  for update to authenticated using (app.has_platform_permission('prospecting.manage'))
  with check (app.has_platform_permission('prospecting.manage'));
create policy "prospect_notes_delete_platform" on public.prospect_notes
  for delete to authenticated using (app.has_platform_permission('prospecting.manage'));

grant insert, update, delete on table public.prospect_followups to authenticated;
create policy "prospect_followups_insert_platform" on public.prospect_followups
  for insert to authenticated with check (app.has_platform_permission('prospecting.manage'));
create policy "prospect_followups_update_platform" on public.prospect_followups
  for update to authenticated using (app.has_platform_permission('prospecting.manage'))
  with check (app.has_platform_permission('prospecting.manage'));
create policy "prospect_followups_delete_platform" on public.prospect_followups
  for delete to authenticated using (app.has_platform_permission('prospecting.manage'));

-- `prospect_suppressions` : insertion et suppression (correction d'une entrée
-- erronée) réservées à 'prospecting.manage'. Aucune policy UPDATE — une
-- opposition ne se modifie pas, elle se retire puis se repose si nécessaire.
grant insert, delete on table public.prospect_suppressions to authenticated;
create policy "prospect_suppressions_insert_platform" on public.prospect_suppressions
  for insert to authenticated with check (app.has_platform_permission('prospecting.manage'));
create policy "prospect_suppressions_delete_platform" on public.prospect_suppressions
  for delete to authenticated using (app.has_platform_permission('prospecting.manage'));

-- `prospecting_runs` : lecture seule pour le client, même administrateur —
-- alimentée exclusivement par le worker (service_role, Phase 10).
-- (La policy SELECT générique posée par la boucle plus haut suffit ; aucune
-- policy d'écriture n'est ajoutée pour `authenticated`.)

-- -----------------------------------------------------------------------------
-- service_role — le contournement RLS ne dispense pas des GRANTs de table
-- -----------------------------------------------------------------------------
-- `service_role` a l'attribut BYPASSRLS : les policies ci-dessus ne
-- s'appliquent jamais à lui. Mais Supabase n'accorde plus automatiquement de
-- privilèges sur une table neuve (voir supabase/config.toml,
-- `auto_expose_new_tables`) : sans ces GRANTs explicites, le worker de
-- synchronisation (Phase 3) et le worker de score (Phase 5) échoueraient sur
-- un simple « permission denied », malgré le contournement RLS. Même piège
-- que rencontré et corrigé sur `admin_signup_alerts`/`quote_reminders`.
grant select, insert, update on table public.prospects to service_role;
grant select, insert, update on table public.prospect_establishments to service_role;
grant select, insert, update on table public.prospect_contacts to service_role;
grant select on table public.prospect_suppressions to service_role;
grant select, insert, update on table public.prospecting_runs to service_role;
grant select on table public.prospecting_zones to service_role;
grant select on table public.prospecting_sectors to service_role;
grant select on table public.prospecting_score_weights to service_role;
grant select, insert on table public.prospect_activities to service_role;

-- -----------------------------------------------------------------------------
-- Contrôle : un utilisateur authentifié SANS permission plateforme ne voit rien
-- -----------------------------------------------------------------------------
-- N'utilise aucune session réelle : vérifie que la définition même des
-- policies ne contient pas de clause plus permissive que
-- `app.has_platform_permission(...)`. Une régression future qui ajouterait
-- `using (true)` par erreur romprait ce contrôle avant même d'être déployée
-- auprès d'un client.
do $$
declare
  v_bad record;
begin
  for v_bad in
    select schemaname, tablename, policyname, qual
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'prospecting_zones', 'prospecting_sectors', 'prospecting_score_weights',
        'prospects', 'prospect_establishments', 'prospect_contacts', 'prospect_notes',
        'prospect_followups', 'prospect_activities', 'prospect_suppressions',
        'prospecting_runs', 'prospecting_message_templates'
      )
      and coalesce(qual, '') not like '%has_platform_permission%'
      and coalesce(with_check, '') not like '%has_platform_permission%'
  loop
    raise exception 'Policy % sur % n''utilise pas has_platform_permission : %', v_bad.policyname, v_bad.tablename, v_bad.qual;
  end loop;
end
$$;
