-- =============================================================================
-- Formulaires métier : la définition est relationnelle, les réponses sont un document
-- =============================================================================
--
-- LE PROBLÈME
--
-- Un raccordement FTTH se constate par une puissance optique et un nombre de
-- soudures. Un entretien de pompe à chaleur, par une pression et une
-- température de fluide. Une tonte, par une surface. Le cœur ne peut pas porter
-- ces colonnes — il en faudrait des centaines, la plupart nulles.
--
-- CE QUI EST RELATIONNEL, ET POURQUOI
--
-- La DÉFINITION des formulaires est en tables. Un modèle décrit en `jsonb` ne
-- peut être ni contraint, ni indexé, ni migré proprement : on découvre ses
-- incohérences à l'exécution, dans le navigateur d'un technicien sur un toit.
-- Un champ est une ligne, avec son type, ses bornes et son unité.
--
-- CE QUI EST UN DOCUMENT, ET POURQUOI
--
-- Les RÉPONSES sont en `jsonb`. Leur forme change à chaque modèle, et on ne
-- filtre jamais « toutes les interventions dont la pression dépasse 12 bars »
-- à travers les métiers. Le contenu est validé à l'écriture contre
-- `form_fields` — c'est la définition qui contraint, pas le type de la colonne.
--
-- ⚠️ Le jour où une valeur doit remonter dans les statistiques, elle est
-- promue en colonne typée ou en colonne générée. Un chiffre qui compte n'a pas
-- sa place dans un document que personne n'indexe.
--
-- LE VERSIONNAGE
--
-- Une ligne de `form_templates` EST une version. Modifier un formulaire crée
-- une nouvelle ligne et archive l'ancienne ; les réponses déjà saisies
-- continuent de pointer la version qu'elles ont remplie. Sans cela, faire
-- évoluer un modèle rendrait illisibles tous les comptes rendus passés — ils
-- afficheraient des champs qui n'existaient pas au moment de la saisie.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Types de champ
-- -----------------------------------------------------------------------------
--
-- Sept, et c'est délibéré. La tentation d'en prévoir vingt « au cas où »
-- produit un moteur que personne ne maîtrise, et des types que personne
-- n'emploie. Toute addition devra servir au moins deux métiers.
--
-- `photo` et `signature` sont ABSENTS : ils supposent le chemin de téléversement
-- vers `intervention_attachments`, qui n'a jamais été exercé. Les déclarer sans
-- les brancher promettrait ce que l'application ne sait pas encore faire.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'form_field_type') then
    create type public.form_field_type as enum (
      'text', 'textarea', 'number', 'boolean', 'select', 'multiselect', 'date'
    );
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- form_templates
-- -----------------------------------------------------------------------------
create table if not exists public.form_templates (
  id                   uuid primary key default gen_random_uuid(),
  intervention_type_id uuid not null references public.intervention_types (id) on delete cascade,
  version              integer not null default 1 check (version >= 1),
  label                text not null check (char_length(label) between 2 and 120),
  description          text,
  status               public.content_status not null default 'active',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (intervention_type_id, version)
);

comment on table public.form_templates is
  'Modèle de saisie rattaché à un type d''intervention. Une ligne = une version.';

-- Un seul modèle actif par type : sans cette contrainte, deux versions
-- pourraient être proposées en même temps et le choix dépendrait de l'ordre de
-- la requête — un défaut qui ne se manifeste qu'en production.
create unique index if not exists form_templates_one_active_per_type
  on public.form_templates (intervention_type_id)
  where status = 'active';

drop trigger if exists form_templates_set_updated_at on public.form_templates;
create trigger form_templates_set_updated_at
  before update on public.form_templates
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- form_fields
-- -----------------------------------------------------------------------------
create table if not exists public.form_fields (
  id               uuid primary key default gen_random_uuid(),
  form_template_id uuid not null references public.form_templates (id) on delete cascade,
  -- Clé employée dans le document de réponses. Stable : la renommer romprait
  -- la lecture de tout ce qui a déjà été saisi.
  key              text not null check (key ~ '^[a-z][a-z0-9_]*$'),
  label            text not null check (char_length(label) between 1 and 120),
  help             text,
  type             public.form_field_type not null,
  required         boolean not null default false,
  -- Unité affichée à côté du champ : dB, bar, °C, m². Jamais convertie — c'est
  -- une étiquette, pas une dimension.
  unit             text,
  min_value        numeric,
  max_value        numeric,
  -- `["Monomode", "Multimode"]` pour `select` et `multiselect`. Nul ailleurs.
  options          jsonb,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  unique (form_template_id, key),

  -- Un choix sans options est un champ inutilisable ; des options sur un nombre
  -- sont une erreur de saisie du modèle. Les deux se détectent à l'écriture.
  constraint form_fields_options_coherent check (
    (type in ('select', 'multiselect') and options is not null
       and jsonb_typeof(options) = 'array' and jsonb_array_length(options) > 0)
    or (type not in ('select', 'multiselect') and options is null)
  ),
  constraint form_fields_bounds_numeric check (
    (min_value is null and max_value is null) or type = 'number'
  ),
  constraint form_fields_bounds_order check (
    min_value is null or max_value is null or max_value >= min_value
  )
);

create index if not exists form_fields_template_order_idx
  on public.form_fields (form_template_id, sort_order);

-- -----------------------------------------------------------------------------
-- intervention_form_responses
-- -----------------------------------------------------------------------------
--
-- Table séparée, et non une colonne `jsonb` sur `interventions`. Trois raisons :
--
--   • `interventions` est lue à chaque affichage de liste ; les réponses ne
--     servent qu'au détail. Les charger systématiquement serait du poids inutile.
--   • `form_template_id` enregistre QUELLE VERSION a été remplie.
--   • la table peut recevoir sa propre policy — un chef d'équipe peut voir
--     l'intervention sans forcément voir le détail des mesures.
create table if not exists public.intervention_form_responses (
  id               uuid primary key default gen_random_uuid(),
  intervention_id  uuid not null unique references public.interventions (id) on delete cascade,
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  form_template_id uuid not null references public.form_templates (id) on delete restrict,
  values           jsonb not null default '{}'::jsonb,
  completed_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint intervention_form_responses_values_object check (
    jsonb_typeof(values) = 'object'
  )
);

create index if not exists intervention_form_responses_org_idx
  on public.intervention_form_responses (organization_id);

drop trigger if exists intervention_form_responses_set_updated_at
  on public.intervention_form_responses;
create trigger intervention_form_responses_set_updated_at
  before update on public.intervention_form_responses
  for each row execute function public.set_updated_at();

-- L'organisation ne peut pas changer après coup, comme partout ailleurs.
drop trigger if exists intervention_form_responses_organization_immutable
  on public.intervention_form_responses;
create trigger intervention_form_responses_organization_immutable
  before update on public.intervention_form_responses
  for each row execute function app.enforce_organization_immutable();

-- -----------------------------------------------------------------------------
-- Validation serveur
-- -----------------------------------------------------------------------------
--
-- Le client construira un schéma Zod à partir des mêmes `form_fields`, pour le
-- confort de saisie. Cette fonction est la règle. Même principe que partout
-- ailleurs dans ce schéma : le client guide, le serveur décide.
--
-- CE QU'ELLE REFUSE
--
--   • une clé inconnue du modèle — sinon le document dérive silencieusement et
--     accumule des champs que plus aucun formulaire n'affiche ;
--   • un champ obligatoire absent ou vide, mais SEULEMENT à la complétion :
--     un brouillon en cours de saisie sur un toit doit pouvoir être enregistré
--     incomplet ;
--   • un nombre hors bornes, un choix hors liste, un type manifestement faux.
create or replace function app.validate_form_response()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key      text;
  v_field    record;
  v_value    jsonb;
  v_item     jsonb;
  v_number   numeric;
begin
  -- 1. Aucune clé étrangère au modèle.
  for v_key in select jsonb_object_keys(new.values)
  loop
    if not exists (
      select 1 from public.form_fields f
      where f.form_template_id = new.form_template_id and f.key = v_key
    ) then
      raise exception 'Champ « % » inconnu de ce formulaire.', v_key
        using errcode = 'check_violation';
    end if;
  end loop;

  -- 2. Chaque valeur fournie respecte la définition de son champ.
  for v_field in
    select * from public.form_fields where form_template_id = new.form_template_id
  loop
    v_value := new.values -> v_field.key;

    if v_value is null or jsonb_typeof(v_value) = 'null'
       or (jsonb_typeof(v_value) = 'string' and trim(v_value #>> '{}') = '')
    then
      -- Absent ou vide : refusé seulement si le formulaire est déclaré complet.
      if v_field.required and new.completed_at is not null then
        raise exception 'Le champ « % » est obligatoire.', v_field.label
          using errcode = 'check_violation';
      end if;
      continue;
    end if;

    if v_field.type = 'number' then
      if jsonb_typeof(v_value) <> 'number' then
        raise exception 'Le champ « % » attend un nombre.', v_field.label
          using errcode = 'check_violation';
      end if;

      v_number := (v_value #>> '{}')::numeric;

      if v_field.min_value is not null and v_number < v_field.min_value then
        raise exception 'Le champ « % » ne peut pas être inférieur à %.',
          v_field.label, v_field.min_value using errcode = 'check_violation';
      end if;

      if v_field.max_value is not null and v_number > v_field.max_value then
        raise exception 'Le champ « % » ne peut pas dépasser %.',
          v_field.label, v_field.max_value using errcode = 'check_violation';
      end if;

    elsif v_field.type = 'boolean' then
      if jsonb_typeof(v_value) <> 'boolean' then
        raise exception 'Le champ « % » attend oui ou non.', v_field.label
          using errcode = 'check_violation';
      end if;

    elsif v_field.type = 'select' then
      if not (v_field.options @> jsonb_build_array(v_value)) then
        raise exception 'Valeur hors liste pour le champ « % ».', v_field.label
          using errcode = 'check_violation';
      end if;

    elsif v_field.type = 'multiselect' then
      if jsonb_typeof(v_value) <> 'array' then
        raise exception 'Le champ « % » attend une liste de choix.', v_field.label
          using errcode = 'check_violation';
      end if;

      for v_item in select jsonb_array_elements(v_value)
      loop
        if not (v_field.options @> jsonb_build_array(v_item)) then
          raise exception 'Valeur hors liste pour le champ « % ».', v_field.label
            using errcode = 'check_violation';
        end if;
      end loop;
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists intervention_form_responses_validate on public.intervention_form_responses;
create trigger intervention_form_responses_validate
  before insert or update of values, completed_at, form_template_id
  on public.intervention_form_responses
  for each row execute function app.validate_form_response();

-- Le formulaire doit appartenir à l'intervention qu'il documente, et à son
-- organisation. Sans ce contrôle, une réponse pourrait être rattachée à
-- l'intervention d'une autre entreprise.
create or replace function app.enforce_form_response_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  select i.organization_id into v_org
  from public.interventions i
  where i.id = new.intervention_id;

  if v_org is null or v_org <> new.organization_id then
    raise exception 'Cette réponse ne correspond pas à l''organisation de l''intervention.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists intervention_form_responses_org_matches
  on public.intervention_form_responses;
create trigger intervention_form_responses_org_matches
  before insert or update of intervention_id, organization_id
  on public.intervention_form_responses
  for each row execute function app.enforce_form_response_org();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.form_templates enable row level security;
alter table public.form_fields enable row level security;
alter table public.intervention_form_responses enable row level security;

-- Modèles et champs : référentiels livrés avec le produit, lus par tout compte
-- connecté. Aucune écriture cliente — ils changent par migration.
drop policy if exists "form_templates_select_authenticated" on public.form_templates;
create policy "form_templates_select_authenticated"
  on public.form_templates for select
  to authenticated
  using (status = 'active');

drop policy if exists "form_fields_select_authenticated" on public.form_fields;
create policy "form_fields_select_authenticated"
  on public.form_fields for select
  to authenticated
  using (
    exists (
      select 1 from public.form_templates t
      where t.id = form_fields.form_template_id and t.status = 'active'
    )
  );

-- Réponses : donnée d'entreprise. Même porte que les interventions elles-mêmes,
-- pour que le droit d'écrire un compte rendu et celui d'en saisir les mesures
-- ne puissent pas diverger.
drop policy if exists "intervention_form_responses_select" on public.intervention_form_responses;
create policy "intervention_form_responses_select"
  on public.intervention_form_responses for select
  to authenticated
  using (app.can_use_pro_module(organization_id, 'interventions'));

drop policy if exists "intervention_form_responses_insert" on public.intervention_form_responses;
create policy "intervention_form_responses_insert"
  on public.intervention_form_responses for insert
  to authenticated
  with check (
    app.can_use_pro_module(organization_id, 'interventions')
    and app.has_org_permission(organization_id, 'intervention.report')
  );

drop policy if exists "intervention_form_responses_update" on public.intervention_form_responses;
create policy "intervention_form_responses_update"
  on public.intervention_form_responses for update
  to authenticated
  using (
    app.can_use_pro_module(organization_id, 'interventions')
    and app.has_org_permission(organization_id, 'intervention.report')
  )
  with check (app.can_use_pro_module(organization_id, 'interventions'));

revoke all on public.form_templates from public, anon, authenticated;
revoke all on public.form_fields from public, anon, authenticated;
revoke all on public.intervention_form_responses from public, anon, authenticated;

grant select on public.form_templates to authenticated;
grant select on public.form_fields to authenticated;
grant select, insert, update on public.intervention_form_responses to authenticated;
