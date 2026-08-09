-- =============================================================================
-- Privilèges explicites
-- =============================================================================
-- ⚠️ POINT DE SÉCURITÉ SOUVENT MANQUÉ
--
-- La Row Level Security ne DONNE aucun droit : elle ne fait que restreindre
-- ceux déjà accordés. Une table sans `grant` est inaccessible quelles que
-- soient ses policies ; une table avec `grant all` s'en remet entièrement à
-- elles.
--
-- Supabase configure des privilèges par défaut qui accordent `all` à `anon` et
-- `authenticated` sur toute nouvelle table de `public`. C'est commode, et c'est
-- exactement le problème : `anon` reçoit alors DELETE sur `missions`, et seule
-- l'absence de policy l'arrête. Une policy trop large ajoutée plus tard, et le
-- droit est déjà là.
--
-- Cette migration reprend la main : on révoque tout, puis on n'accorde que les
-- verbes que les policies utilisent réellement. Défense en profondeur — il faut
-- désormais se tromper DEUX fois pour ouvrir une brèche.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Table rase
-- -----------------------------------------------------------------------------
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'profiles', 'categories', 'tools', 'favorites', 'tool_history',
    'role_permissions', 'organizations', 'organization_members',
    'organization_invitations', 'plans', 'plan_features', 'subscriptions',
    'teams', 'team_members', 'missions', 'mission_assignments',
    'mission_status_transitions', 'mission_status_events',
    'interventions', 'intervention_reports', 'intervention_attachments',
    'audit_logs'
  ]
  loop
    execute format('revoke all on public.%I from public, anon, authenticated', v_table);
  end loop;
end
$$;

-- -----------------------------------------------------------------------------
-- Lecture publique — vitrine et catalogue, consultables sans compte
-- -----------------------------------------------------------------------------
grant select on public.categories    to anon, authenticated;
grant select on public.tools         to anon, authenticated;
grant select on public.plans         to anon, authenticated;
grant select on public.plan_features to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Tables de référence — lecture par les comptes connectés
-- -----------------------------------------------------------------------------
-- Le frontend en a besoin pour n'afficher que les actions possibles. Les
-- masquer n'apporterait rien : l'autorisation réelle est ailleurs, et une
-- interface qui propose des actions interdites est simplement mauvaise.
grant select on public.role_permissions           to authenticated;
grant select on public.mission_status_transitions to authenticated;

-- -----------------------------------------------------------------------------
-- Données personnelles
-- -----------------------------------------------------------------------------
-- Pas d'INSERT sur `profiles` : la ligne est créée par le trigger
-- `handle_new_user`. Pas de DELETE : la suppression suit la cascade depuis
-- `auth.users`.
grant select, update            on public.profiles     to authenticated;
grant select, insert, delete    on public.favorites    to authenticated;
grant select, insert, delete    on public.tool_history to authenticated;

-- -----------------------------------------------------------------------------
-- Module professionnel
-- -----------------------------------------------------------------------------
grant select, insert, update, delete on public.organizations            to authenticated;
grant select, insert, update, delete on public.organization_members     to authenticated;
grant select, insert, update, delete on public.organization_invitations to authenticated;
grant select, insert, update, delete on public.teams                    to authenticated;
grant select, insert, update, delete on public.team_members             to authenticated;
grant select, insert, update, delete on public.missions                 to authenticated;
grant select, insert, update, delete on public.mission_assignments      to authenticated;
grant select, insert, update, delete on public.interventions            to authenticated;

-- Pas de DELETE : un compte rendu validé est une pièce probante, le supprimer
-- effacerait la trace d'une intervention facturée.
grant select, insert, update on public.intervention_reports to authenticated;

-- Pas d'UPDATE : un fichier de preuve ne se corrige pas, il se remplace par un
-- nouveau dépôt — ce qui conserve l'original.
grant select, insert, delete on public.intervention_attachments to authenticated;

-- -----------------------------------------------------------------------------
-- Lecture seule stricte
-- -----------------------------------------------------------------------------
-- `subscriptions` : la table la plus sensible du schéma. Un INSERT accordé ici
-- permettrait à n'importe qui de s'attribuer le plan `business` et de déverrouiller
-- tout le module professionnel. Elle est alimentée par le webhook de paiement,
-- avec `service_role`.
grant select on public.subscriptions to authenticated;

-- `mission_status_events` et `audit_logs` : écrits exclusivement par triggers.
-- Un INSERT client permettrait de forger un historique, ce qui viderait la
-- traçabilité de son sens.
grant select on public.mission_status_events to authenticated;
grant select on public.audit_logs            to authenticated;

-- -----------------------------------------------------------------------------
-- Séquences
-- -----------------------------------------------------------------------------
-- Aucune : toutes les clés primaires sont des UUID générés par `gen_random_uuid()`.
-- Rien à accorder, et rien qui permette de déduire un volume d'activité en
-- observant la progression d'un compteur.

-- -----------------------------------------------------------------------------
-- Vérification
-- -----------------------------------------------------------------------------
-- Aucune table de `public` ne doit rester sans RLS. Le dashboard le signale
-- dans Advisors → Security, mais un contrôle à l'application évite de découvrir
-- l'oubli en production.
do $$
declare
  v_unprotected text[];
begin
  select array_agg(c.relname order by c.relname)
  into v_unprotected
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and not c.relrowsecurity;

  if v_unprotected is not null then
    raise exception 'Tables sans RLS dans public : %', array_to_string(v_unprotected, ', ');
  end if;

  raise notice 'RLS active sur toutes les tables de public.';
end
$$;
