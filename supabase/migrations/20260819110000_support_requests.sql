-- =============================================================================
-- Demandes d'assistance : les recevoir vraiment
-- =============================================================================
--
-- CE QUI EXISTAIT
--
-- Le formulaire du centre d'assistance attendait neuf cents millisecondes, puis
-- affichait « envoyé ». Rien n'était transmis, rien n'était conservé. Un client
-- ayant un vrai problème écrivait, lisait la confirmation, et attendait une
-- réponse qui ne pouvait pas venir.
--
-- ÉCRIRE D'ABORD, NOTIFIER ENSUITE
--
-- La table fait foi ; le courriel de notification est un confort. Perdre la
-- demande d'un client parce qu'un serveur de messagerie a hoqueté reproduirait
-- exactement le défaut qu'on corrige — une promesse d'interface que rien ne
-- soutient.
--
-- QUI PEUT ÉCRIRE, QUI PEUT LIRE
--
-- Écrire : tout le monde, y compris un visiteur non connecté. La bulle
-- s'affiche sur les pages publiques, et un prospect qui hésite doit pouvoir
-- poser sa question — c'est un canal commercial autant qu'un support.
--
-- Lire : PERSONNE, par aucune policy. Il n'existe pas d'arrière-guichet dans
-- l'application, et en inventer un dépasserait le besoin. Les demandes se
-- consultent par le courriel de notification et le tableau de bord Supabase,
-- c'est-à-dire avec `service_role`, qui contourne la RLS.
--
-- Conséquence assumée : l'auteur lui-même ne peut pas relire sa demande. Elle
-- n'a pas d'existence dans l'interface, seulement dans votre boîte.
-- =============================================================================

create table if not exists public.support_requests (
  id          uuid primary key default gen_random_uuid(),
  -- `null` pour un visiteur anonyme. `on delete set null` : la suppression d'un
  -- compte ne doit pas emporter une demande à laquelle on n'a pas répondu.
  user_id     uuid references auth.users (id) on delete set null,
  name        text not null,
  email       text not null,
  phone       text,
  message     text not null,
  /**
   * Métadonnées des fichiers joints : nom, chemin de stockage, taille, type.
   *
   * Une table fille serait plus orthodoxe, mais une demande d'assistance
   * s'écrit une fois et ne se requête jamais fichier par fichier.
   */
  attachments jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);

comment on table public.support_requests is
  'Demandes envoyées depuis le centre d''assistance. Écriture ouverte à tous, '
  'lecture réservée à service_role : la consultation se fait par courriel.';

create index if not exists support_requests_created_idx
  on public.support_requests (created_at desc);

-- Le plafond horaire compte par adresse : cet index sert la requête du trigger.
create index if not exists support_requests_email_created_idx
  on public.support_requests (lower(email), created_at desc);

alter table public.support_requests enable row level security;

-- -----------------------------------------------------------------------------
-- Droits
-- -----------------------------------------------------------------------------

drop policy if exists "support_requests_insert" on public.support_requests;
create policy "support_requests_insert"
  on public.support_requests for insert
  to anon, authenticated
  with check (
    -- Un anonyme n'usurpe pas une identité : `user_id` doit être le sien, ou nul.
    user_id is null or user_id = (select auth.uid())
  );

-- Aucune policy SELECT, UPDATE ni DELETE. L'absence est délibérée : sur une
-- table en RLS, ce qui n'est pas autorisé est refusé, et `service_role` passe
-- outre. Écrire une policy de lecture « pour plus tard » ouvrirait un accès que
-- personne n'a demandé.

-- -----------------------------------------------------------------------------
-- Garde-fou anti-pourriel
-- -----------------------------------------------------------------------------
--
-- PAR TRIGGER, ET NON PAR PRÉDICAT RLS. Une policy qui compterait les lignes de
-- sa propre table s'interrogerait à travers la RLS qu'elle définit — sans
-- policy de lecture, ce comptage ne verrait rien et le plafond ne mordrait
-- jamais. Un trigger, lui, compte librement.
--
-- Deux plafonds, parce qu'ils protègent de deux choses :
--
--   • par adresse — empêche un formulaire renvoyé en boucle, volontairement ou
--     par un double-clic malheureux ;
--   • global sur les demandes anonymes — protège la table d'un robot qui
--     varierait les adresses. Il gênera aussi les demandes légitimes pendant
--     une attaque : c'est le prix, et il vaut mieux qu'une table saturée.
--
-- CE QUE CELA NE FAIT PAS : protéger votre boîte aux lettres. Un attaquant
-- déterminé passera. Un CAPTCHA serait la marche suivante ; elle n'est pas
-- franchie ici.

create or replace function app.enforce_support_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meme_adresse integer;
  v_anonymes     integer;
begin
  select count(*) into v_meme_adresse
  from public.support_requests s
  where lower(s.email) = lower(new.email)
    and s.created_at > now() - interval '1 hour';

  if v_meme_adresse >= 5 then
    raise exception
      'Trop de demandes envoyées depuis cette adresse. Réessayez dans une heure, ou écrivez directement à contact@rezo360.fr.'
      using errcode = 'check_violation';
  end if;

  if new.user_id is null then
    select count(*) into v_anonymes
    from public.support_requests s
    where s.user_id is null
      and s.created_at > now() - interval '1 hour';

    if v_anonymes >= 40 then
      raise exception
        'Le service de messagerie est momentanément saturé. Écrivez directement à contact@rezo360.fr.'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists support_requests_rate_limit on public.support_requests;
create trigger support_requests_rate_limit
  before insert on public.support_requests
  for each row execute function app.enforce_support_rate_limit();

-- -----------------------------------------------------------------------------
-- Dépôt des pièces jointes
-- -----------------------------------------------------------------------------
--
-- Bucket PRIVÉ, comme `intervention-attachments` : une capture d'écran de
-- support peut montrer des données client, un écran de facturation, une adresse.
-- Rien de tout cela ne doit être accessible à qui devine une URL.
--
-- Types volontairement plus étroits que pour les interventions : une demande
-- d'assistance s'illustre par une capture ou un PDF, pas par un tableur.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'support-attachments',
  'support-attachments',
  false,
  10485760,  -- 10 Mio : une capture d'écran passe largement, une vidéo non
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Dépôt ouvert à tous, comme le formulaire lui-même. Le plafond de taille et la
-- liste de types tiennent lieu de garde-fou : ce sont eux qui empêchent le
-- bucket de servir d'hébergement gratuit.
drop policy if exists "support_attachments_upload" on storage.objects;
create policy "support_attachments_upload"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'support-attachments');

-- Aucune policy de lecture, de modification ni de suppression : les fichiers se
-- consultent par URL signée, émise avec `service_role` au moment de la
-- notification. Celui qui dépose ne peut pas relire — pas même le sien, faute
-- de pouvoir prouver qu'il en est l'auteur une fois déconnecté.
