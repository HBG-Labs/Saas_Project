-- =============================================================================
-- Alerte administrateur à chaque inscription réelle
-- =============================================================================
--
-- L'ÉVÉNEMENT CHOISI, ET POURQUOI
--
-- `auth.users` reçoit une ligne à l'inscription (email/mot de passe ou Google),
-- et c'est TOUT ce qu'une reconnexion, un rafraîchissement de jeton, une
-- modification de profil ou d'abonnement ne refont jamais : ces événements ne
-- réinsèrent rien dans `auth.users`. C'est la seule table dont l'INSERT est
-- garanti unique par personne, une fois pour toutes.
--
-- Deux autres chemins insèrent aussi dans `auth.users` sans être une nouvelle
-- inscription REZO360 : un collaborateur ajouté par un client existant
-- (`accept-invitation-signup`, `create-member`, tous deux via
-- `admin.createUser()`). Ces deux fonctions posent désormais
-- `rezo360_member_added_by_admin: true` dans `raw_user_meta_data` ; le trigger
-- ci-dessous les reconnaît et ne les alerte pas — ce n'est pas un nouveau
-- client, c'est la croissance d'un client déjà là.
--
-- CE QUE LE TRIGGER NE FAIT PAS : ENVOYER
--
-- Il se contente d'ENFILER une ligne dans `admin_signup_alerts`, exactement le
-- patron déjà en place pour `subscription_seat_sync_jobs` et l'ordonnanceur de
-- transmission. Un worker `pg_cron` l'envoie séparément, ce qui donne trois
-- garanties gratuitement :
--
--   • l'inscription n'attend jamais un serveur de messagerie ou OneSignal ;
--   • une panne d'e-mail ou de push se rattrape au prochain passage du worker,
--     sans repasser par le navigateur du nouvel inscrit ;
--   • `user_id` est clé primaire : la ligne existe au plus une fois, quoi
--     qu'il arrive côté client.
--
-- L'ENSEMBLE DU TRIGGER EST BLINDÉ CONTRE SES PROPRES ERREURS
--
-- Il tourne APRÈS l'insertion, dans la MÊME transaction que la création du
-- compte : une exception non rattrapée annulerait l'inscription elle-même.
-- Un bug dans ce fichier ne doit jamais empêcher quiconque de s'inscrire —
-- exactement l'exigence posée pour l'envoi, étendue ici par prudence à
-- l'enregistrement lui-même.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- La file d'attente
-- -----------------------------------------------------------------------------
create table public.admin_signup_alerts (
  -- Clé = idempotence : une seule ligne par personne, pour toujours. Un
  -- second appel du trigger (il ne peut structurellement pas y en avoir,
  -- `auth.users.id` est unique) ou un rejeu manuel ne peuvent pas dupliquer.
  user_id           uuid primary key references auth.users (id) on delete cascade,
  -- Capturé à l'inscription : `auth.users.email` peut changer ensuite, l'alerte
  -- doit rester celle du jour de l'inscription.
  email             text not null,
  signed_up_at      timestamptz not null default now(),

  attempts          integer not null default 0 check (attempts >= 0),
  next_attempt_at   timestamptz not null default now(),
  locked_at         timestamptz,
  last_error        text,

  -- Les deux canaux sont suivis SÉPARÉMENT : si l'e-mail échoue mais le push
  -- réussit, une reprise ne doit renvoyer QUE l'e-mail. C'est ce qui rend les
  -- essais suivants idempotents canal par canal, pas seulement ligne par ligne.
  email_status      text not null default 'pending'
                       check (email_status in ('pending', 'sent', 'skipped')),
  email_sent_at     timestamptz,
  email_provider_id text,
  email_error       text,

  push_status       text not null default 'pending'
                       check (push_status in ('pending', 'sent', 'skipped')),
  push_sent_at      timestamptz,
  push_error        text,

  updated_at        timestamptz not null default now()
);

create index admin_signup_alerts_pending_idx
  on public.admin_signup_alerts (next_attempt_at)
  where email_status <> 'sent' or push_status <> 'sent';

alter table public.admin_signup_alerts enable row level security;
revoke all on table public.admin_signup_alerts from public, anon, authenticated;
grant select, update on table public.admin_signup_alerts to service_role;

comment on table public.admin_signup_alerts is
  'File d''attente des alertes administrateur (e-mail + push) à chaque inscription réelle. '
  'Écrite par le trigger sur auth.users, traitée par le worker notify-admin-signup-worker. '
  'Aucun accès client : ni RLS ni policy, service_role uniquement.';

-- -----------------------------------------------------------------------------
-- Le trigger d'inscription
-- -----------------------------------------------------------------------------
create or replace function app.enqueue_admin_signup_alert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Comptes de démonstration (`supabase/seed/demo_accounts.sql` et les jeux de
  -- données fictives) : jamais une inscription réelle, jamais une alerte.
  if new.email ilike '%@rezo360.test' then
    return new;
  end if;

  -- Compte créé PAR un client existant pour un collaborateur (invitation ou
  -- création directe par le dirigeant) : posé explicitement par
  -- `accept-invitation-signup` et `create-member`. Ce n'est pas une nouvelle
  -- inscription REZO360.
  if new.raw_user_meta_data ->> 'rezo360_member_added_by_admin' = 'true' then
    return new;
  end if;

  insert into public.admin_signup_alerts (user_id, email)
  values (new.id, new.email)
  on conflict (user_id) do nothing;

  return new;
exception
  -- Voir l'en-tête du fichier : un incident ici ne doit jamais faire échouer
  -- une inscription réelle. On le signale et on laisse l'inscription aboutir ;
  -- au pire, cette seule personne ne déclenche pas d'alerte.
  when others then
    raise warning 'admin_signup_alerts: mise en file impossible pour % (%).', new.id, sqlerrm;
    return new;
end;
$$;

comment on function app.enqueue_admin_signup_alert() is
  'Met en file une alerte administrateur à chaque véritable inscription sur auth.users. '
  'Exclut les comptes de démonstration et les comptes créés par un client existant pour un '
  'collaborateur. Ne lève jamais : une erreur ici ne doit jamais empêcher une inscription.';

create trigger on_auth_user_created_signup_alert
  after insert on auth.users
  for each row execute function app.enqueue_admin_signup_alert();

-- -----------------------------------------------------------------------------
-- Le tirage atomique du worker — même patron que `claim_subscription_seat_sync_jobs`
-- -----------------------------------------------------------------------------
create or replace function public.claim_admin_signup_alerts(p_limit integer default 25)
returns table (
  user_id      uuid,
  email        text,
  signed_up_at timestamptz,
  attempts     integer,
  email_status text,
  push_status  text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with candidates as (
    select a.user_id
    from public.admin_signup_alerts a
    where a.next_attempt_at <= now()
      and (a.email_status <> 'sent' or a.push_status <> 'sent')
      -- Un verrou vieux de plus de 5 minutes est un worker mort, pas un
      -- worker occupé : on le considère libre plutôt que de bloquer à jamais.
      and (a.locked_at is null or a.locked_at < now() - interval '5 minutes')
    order by a.next_attempt_at, a.signed_up_at
    for update skip locked
    limit least(greatest(coalesce(p_limit, 25), 1), 100)
  ), claimed as (
    update public.admin_signup_alerts a
       set locked_at = now(), updated_at = now()
      from candidates c
     where a.user_id = c.user_id
    returning a.user_id, a.email, a.signed_up_at, a.attempts, a.email_status, a.push_status
  )
  select c.user_id, c.email, c.signed_up_at, c.attempts, c.email_status, c.push_status
  from claimed c;
end;
$$;

revoke all on function public.claim_admin_signup_alerts(integer) from public, anon, authenticated;
grant execute on function public.claim_admin_signup_alerts(integer) to service_role;

comment on function public.claim_admin_signup_alerts(integer) is
  'Verrouille et renvoie un lot d''alertes de signup à traiter (SKIP LOCKED). '
  'service_role uniquement, appelée par notify-admin-signup-worker.';

-- -----------------------------------------------------------------------------
-- Le battement de cœur du worker — même patron que les workers existants
-- -----------------------------------------------------------------------------
create table public.admin_signup_alert_worker_runs (
  id          bigint generated always as identity primary key,
  ran_at      timestamptz not null default now(),
  attempted   integer not null default 0 check (attempted >= 0),
  sent        integer not null default 0 check (sent >= 0),
  failed      integer not null default 0 check (failed >= 0),
  duration_ms integer not null default 0 check (duration_ms >= 0)
);

create index admin_signup_alert_worker_runs_recent_idx
  on public.admin_signup_alert_worker_runs (ran_at desc);

alter table public.admin_signup_alert_worker_runs enable row level security;
revoke all on table public.admin_signup_alert_worker_runs from public, anon, authenticated;
grant select, insert on table public.admin_signup_alert_worker_runs to service_role;
grant usage, select on sequence public.admin_signup_alert_worker_runs_id_seq to service_role;

comment on table public.admin_signup_alert_worker_runs is
  'Battement de cœur de notify-admin-signup-worker : un ordonnanceur muet est '
  'indiscernable d''un ordonnanceur qui n''a rien à faire, sans cette trace.';

-- -----------------------------------------------------------------------------
-- Le déclencheur planifié — même patron que les deux workers existants
-- -----------------------------------------------------------------------------
-- Configuration hors dépôt, à poser une fois dans le SQL Editor :
--
--   select vault.create_secret(
--     'https://<ref>.supabase.co/functions/v1/notify-admin-signup-worker',
--     'admin_signup_alert_worker_url'
--   );
--   select vault.create_secret('<même valeur que le secret Edge Function
--     ADMIN_SIGNUP_ALERT_WORKER_SECRET>', 'admin_signup_alert_worker_secret');
create or replace function app.trigger_admin_signup_alert_worker()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url    text;
  v_secret text;
begin
  select decrypted_secret into v_url
  from vault.decrypted_secrets where name = 'admin_signup_alert_worker_url';

  select decrypted_secret into v_secret
  from vault.decrypted_secrets where name = 'admin_signup_alert_worker_secret';

  if v_url is null or v_secret is null then
    raise notice
      'Worker d''alerte inscription non configuré : renseignez admin_signup_alert_worker_url '
      'et admin_signup_alert_worker_secret dans Vault.';
    return;
  end if;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type',    'application/json',
      'x-worker-secret', v_secret
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
end;
$$;

revoke all on function app.trigger_admin_signup_alert_worker() from public, anon, authenticated;

comment on function app.trigger_admin_signup_alert_worker() is
  'Réveille notify-admin-signup-worker toutes les minutes via pg_cron. '
  'Sans configuration Vault, se tait (raise notice) plutôt que d''échouer bruyamment.';

-- Une minute : le volume est faible (une ligne par inscription) et chaque
-- passage sans rien à faire ne coûte qu'une requête vide — l'admin est alerté
-- quasi immédiatement plutôt qu'avec la latence d'un ordonnanceur de masse.
select cron.schedule(
  'admin-signup-alert-worker',
  '* * * * *',
  $$select app.trigger_admin_signup_alert_worker()$$
);
