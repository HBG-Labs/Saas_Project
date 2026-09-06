-- =============================================================================
-- L'environnement du depot appartient a la transmission
-- =============================================================================
--
-- CE QUE CETTE COLONNE EVITE
--
-- Un identifiant de depot n'a de sens que dans l'environnement qui l'a
-- attribue. `449110`, delivre par le bac a sable de SUPER PDP, n'existe pas en
-- production. Rien ne le disait : on ne l'a decouvert qu'en voyant
-- l'ordonnanceur recevoir un 404, et il aurait recommence toutes les quinze
-- minutes indefiniment.
--
-- Enregistrer l'environnement au moment du depot rend le cas DETECTABLE au lieu
-- de subi. Une transmission deposee ailleurs que la ou l'organisation est
-- aujourd'hui raccordee est simplement ignoree par l'ordonnanceur, et signalee
-- dans ses journaux.
--
-- Les transmissions anterieures gardent `null` : leur environnement n'est pas
-- reconstituable, et aucune n'est plus selectionnable de toute facon.

alter table public.invoice_transmissions
  add column if not exists provider_environment text
    check (provider_environment is null or provider_environment in ('sandbox', 'production'));

comment on column public.invoice_transmissions.provider_environment is
  'Environnement de la plateforme au moment du depot. Un identifiant de depot n''est valable que dans le sien.';

create index invoice_transmissions_environment_idx
  on public.invoice_transmissions(organization_id, provider_environment)
  where status in ('submitted', 'delivered');

-- -----------------------------------------------------------------------------
-- L'environnement fait partie de l'identite du depot
-- -----------------------------------------------------------------------------
--
-- Reprise integrale de la version en vigueur (20260906172130), avec une seule
-- regle de plus : une fois pose, l'environnement ne se modifie pas. Le laisser
-- mutable permettrait de faire passer un depot du bac a sable pour un depot de
-- production, ce qui est exactement l'erreur que cette colonne doit rendre
-- impossible.

create or replace function app.guard_invoice_transmission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.invoices;
begin
  if tg_op = 'DELETE' then
    raise exception 'Une transmission ne peut pas être supprimée : son historique doit être conservé.'
      using errcode = 'restrict_violation';
  end if;

  if tg_op = 'UPDATE' then
    if new.invoice_id is distinct from old.invoice_id
      or new.organization_id is distinct from old.organization_id
      or new.provider_code is distinct from old.provider_code
      or new.idempotency_key is distinct from old.idempotency_key then
      raise exception 'L’identité d’une transmission ne peut pas être modifiée.'
        using errcode = 'restrict_violation';
    end if;

    if old.provider_submission_id is not null
      and new.provider_submission_id is distinct from old.provider_submission_id then
      raise exception 'L’identifiant attribué par la plateforme ne peut pas être remplacé.'
        using errcode = 'restrict_violation';
    end if;

    -- Meme raison que l'identifiant : l'environnement fait partie de l'identite
    -- du depot. Le changer ferait croire qu'un depot du bac a sable est
    -- interrogeable en production.
    if old.provider_environment is not null
      and new.provider_environment is distinct from old.provider_environment then
      raise exception 'L’environnement d’un dépôt ne peut pas être modifié.'
        using errcode = 'restrict_violation';
    end if;

    if new.attempt_count < old.attempt_count then
      raise exception 'Le compteur de tentatives ne peut pas diminuer.'
        using errcode = 'check_violation';
    end if;

    -- Seule evolution par rapport a 20260904191003 : `cancelled` rejoint les
    -- suites possibles de `delivered`. Tout le reste est inchange.
    if new.status is distinct from old.status and not (
      (old.status in ('queued', 'submitting', 'failed') and new.status in
        ('queued', 'submitting', 'submitted', 'delivered', 'accepted', 'rejected', 'failed', 'cancelled'))
      or (old.status = 'submitted' and new.status in
        ('delivered', 'accepted', 'rejected', 'failed', 'cancelled'))
      or (old.status = 'delivered' and new.status in
        ('accepted', 'rejected', 'failed', 'cancelled'))
    ) then
      raise exception 'Transition de transmission interdite : % vers %.', old.status, new.status
        using errcode = 'check_violation';
    end if;
  else
    select * into v_invoice from public.invoices where id = new.invoice_id;
    if v_invoice.id is null then
      raise exception 'Facture introuvable.' using errcode = 'foreign_key_violation';
    end if;
    if v_invoice.status not in ('issued', 'sent', 'paid') then
      raise exception 'Seule une facture ou un avoir émis peut être transmis.'
        using errcode = 'check_violation';
    end if;
    new.organization_id := v_invoice.organization_id;
  end if;

  if new.status in ('submitted', 'delivered', 'accepted', 'rejected') then
    new.submitted_at := coalesce(new.submitted_at, now());
  end if;
  if new.status in ('delivered', 'accepted') then
    new.delivered_at := coalesce(new.delivered_at, now());
  end if;
  if new.status in ('accepted', 'rejected', 'cancelled') then
    new.completed_at := coalesce(new.completed_at, now());
    new.next_attempt_at := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
