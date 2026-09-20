-- =============================================================================
-- Notifications : persistance de l'état lu / écarté (phase 2, arbitrage C)
-- =============================================================================
--
-- CE QUE CETTE MIGRATION FAIT, ET CE QU'ELLE NE FAIT PAS
--
-- Les notifications de REZO360 sont DÉRIVÉES : le client les recalcule à chaque
-- rendu depuis l'état réel — missions assignées, congés en attente, stock bas,
-- matériel à étalonner, messages clients. Ce mécanisme fonctionne et reste
-- toujours juste, puisqu'il lit la vérité au lieu d'en garder une copie.
--
-- Ce qui ne suivait pas, c'était l'état de lecture : « lu » et « écarté »
-- vivaient dans le localStorage du navigateur. Une notification lue au bureau
-- réapparaissait non lue sur le téléphone, et un navigateur vidé effaçait tout.
--
-- Cette table ne persiste QUE cet état. Elle ne stocke aucune notification —
-- ni titre, ni contenu, ni lien — seulement une clé et deux dates. La
-- dérivation reste côté client ; aucun trigger n'est posé sur les tables
-- métier ; aucun pipeline d'événements n'est introduit. C'est le choix validé :
-- persister l'état, garder la dérivation.
--
-- LA CLÉ
--
-- `notification_key` est l'identifiant que le client construit de façon
-- déterministe (`leave_pending_<uuid>`, `stock_low_<uuid>_<quantité>`…). Il
-- n'a de sens que pour le client ; le serveur ne l'interprète pas. C'est
-- délibéré : la base ne connaît pas les notifications, elle connaît ce qu'une
-- personne en a fait.
--
-- UNE LIGNE = UN ÉTAT
--
-- Une ligne n'existe que si la personne a fait quelque chose : lu, écarté, ou
-- les deux. La contrainte `notification_states_has_state` refuse une ligne
-- vide, qui n'aurait aucune raison d'être et ne ferait que grossir la table.
-- =============================================================================

create table public.notification_states (
  user_id          uuid        not null references auth.users (id) on delete cascade,
  organization_id  uuid        not null references public.organizations (id) on delete cascade,
  notification_key text        not null,
  read_at          timestamptz,
  dismissed_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  primary key (user_id, organization_id, notification_key),

  constraint notification_states_key_format
    check (length(notification_key) between 1 and 200),

  constraint notification_states_has_state
    check (read_at is not null or dismissed_at is not null)
);

comment on table public.notification_states is
  'État lu / écarté d''une notification dérivée, par personne et par organisation. Ne stocke pas la notification.';
comment on column public.notification_states.notification_key is
  'Identifiant déterministe construit par le client. Opaque pour le serveur.';

-- Nettoyage à la suppression d'une organisation ou d'un compte : par cascade.
-- Nettoyage d'une notification qui n'existe plus (mission archivée, congé
-- tranché) : le client cesse de la dériver, la ligne devient inerte. Elle est
-- petite (une clé, deux dates) et peut être purgée plus tard par un worker si
-- la table grossit — mesurer avant d'écrire ce worker.

create trigger notification_states_set_updated_at
  before update on public.notification_states
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Droits
-- -----------------------------------------------------------------------------
-- Une personne ne voit et ne touche que SES lignes, et seulement dans une
-- organisation dont elle est membre. La seconde condition compte : quitter une
-- organisation ne doit pas laisser lire — ni réécrire — ce qu'on y avait lu.
--
-- Une politique par commande, jamais `for all` : chaque commande énonce sa
-- propre condition, et `with check` sur l'écriture empêche de créer une ligne
-- au nom de quelqu'un d'autre.
-- -----------------------------------------------------------------------------

alter table public.notification_states enable row level security;

revoke all on public.notification_states from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.notification_states to authenticated;
grant all on public.notification_states to service_role;

create policy notification_states_select
  on public.notification_states for select to authenticated
  using (
    user_id = (select auth.uid())
    and (select app.is_org_member(organization_id))
  );

create policy notification_states_insert
  on public.notification_states for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select app.is_org_member(organization_id))
  );

create policy notification_states_update
  on public.notification_states for update to authenticated
  using (
    user_id = (select auth.uid())
    and (select app.is_org_member(organization_id))
  )
  with check (
    user_id = (select auth.uid())
    and (select app.is_org_member(organization_id))
  );

create policy notification_states_delete
  on public.notification_states for delete to authenticated
  using (
    user_id = (select auth.uid())
    and (select app.is_org_member(organization_id))
  );
