-- =============================================================================
-- Abandon d'une transmission devenue intraçable
-- =============================================================================
--
-- CE QUI S'EST PASSE
--
-- `FAC-2026-00005` porte le depot `449110`, attribue par SUPER PDP dans son BAC
-- A SABLE. La connexion de l'organisation est passee en PRODUCTION depuis. Ce
-- depot n'existe pas dans cet environnement : le partenaire repond 404, et il
-- repondra 404 pour toujours.
--
-- La transmission est `delivered`, donc non terminale : l'ordonnanceur la
-- selectionne a chaque passage. Une fois la tache planifiee active, cela
-- produirait un echec toutes les quinze minutes, indefiniment — au point de
-- rendre le battement de coeur inutilisable comme signal de sante. Une alerte
-- permanente n'est plus une alerte.
--
-- POURQUOI LA MACHINE A ETATS DOIT CHANGER
--
-- Depuis `delivered`, elle n'autorisait que `accepted`, `rejected` et `failed`.
-- Trois conclusions, aucune sortie. Or aucune des trois n'est vraie ici : le
-- document a bel et bien ete remis, dans un environnement qui n'est plus le
-- notre. Il manquait la possibilite d'ABANDONNER le suivi.
--
-- Abandonner n'est pas regresser : `cancelled` est terminal, et le trigger y
-- efface deja l'echeance de reprise. Cette sortie resservira a chaque bascule
-- d'environnement.
--
-- Precedent dans ce depot : `20260903060000_purge_refs_stripe_test.sql`, qui a
-- purge des references Stripe devenues introuvables apres le passage en mode
-- reel. Meme cause, meme remede.

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

-- -----------------------------------------------------------------------------
-- Cloture des depots realises avec les entreprises fictives du bac a sable
-- -----------------------------------------------------------------------------
--
-- `000000001` et `000000002` sont Tricatel et Burger Queen, les deux societes
-- fictives fournies par SUPER PDP pour son bac a sable. Aucun SIREN reel ne
-- prend cette forme : le filtre ne peut pas atteindre un document authentique.
--
-- Seules les transmissions NON TERMINALES sont touchees. Un `rejected` ou un
-- `accepted` a deja conclu son histoire et n'est plus interroge par personne.

update public.invoice_transmissions t
set status            = 'cancelled',
    last_error_code   = null,
    last_error_message = null
from public.invoices i
where i.id = t.invoice_id
  and t.status in ('queued', 'submitted', 'delivered')
  and i.seller_registration_number in ('000000001', '000000002');

-- Controle : plus aucune transmission non terminale ne doit pointer vers un
-- depot du bac a sable. Sinon l'ordonnanceur echouerait a chaque passage.
do $$
declare
  v_restantes integer;
begin
  select count(*) into v_restantes
  from public.invoice_transmissions t
  join public.invoices i on i.id = t.invoice_id
  where t.status in ('queued', 'submitting', 'submitted', 'delivered')
    and i.seller_registration_number in ('000000001', '000000002');

  if v_restantes > 0 then
    raise exception
      'Il reste % transmission(s) du bac a sable en etat non terminal.', v_restantes;
  end if;
end
$$;
