-- =============================================================================
-- Paternité et immuabilité du compte rendu
-- =============================================================================
--
-- LE CONSTAT, MESURÉ
--
-- `intervention_reports_update` autorise la mise à jour à qui détient
-- `intervention.review`, à TOUT statut et sur TOUTES les colonnes — une policy
-- ne raisonne pas colonne par colonne. Le trigger de séparation des pouvoirs,
-- lui, ne garde que le passage vers `approved` ou `rejected` et laisse tout le
-- reste passer.
--
-- Sondage sur la base :
--   • le contrôleur réécrit le texte du technicien PUIS valide   → RÉUSSI
--   • le contrôleur modifie un compte rendu DÉJÀ VALIDÉ          → RÉUSSI
--
-- Le compte rendu portait alors le nom du technicien et les mots du contrôleur.
-- Pour une pièce que l'on montre à un client, ou que l'on produit en cas de
-- litige, c'est la fin de toute valeur probante.
--
-- LE PRINCIPE MANQUANT
--
-- La séparation des pouvoirs était écrite dans un seul sens : « un intervenant
-- ne valide jamais son propre compte rendu ». Le versant symétrique manquait :
-- CELUI QUI CONTRÔLE N'ÉCRIT PAS. Il approuve, il refuse en motivant, il ne
-- réécrit pas.
--
-- Et un compte rendu validé devient définitif. Le rouvrir en silence viderait
-- la validation de son sens : ce qui a été approuvé n'est plus ce qui est lu.
-- Une correction passe désormais par un refus motivé, qui laisse une trace.
-- =============================================================================

create or replace function app.enforce_report_authorship()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor     uuid := (select auth.uid());
  v_tech_user uuid;
  v_is_author boolean;
begin
  -- Écriture par un rôle privilégié (migrations, webhook) : hors session.
  if v_actor is null then
    return new;
  end if;

  -- ---------------------------------------------------------------------------
  -- Un compte rendu validé est définitif
  -- ---------------------------------------------------------------------------
  if old.status = 'approved' then
    raise exception
      'Un compte rendu validé ne peut plus être modifié. Pour le corriger, il doit être refusé puis resoumis.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Qui a réalisé l'intervention ? `technician_id` est lui-même imposé par
  -- `enforce_report_org` depuis l'intervention : il n'est pas déclaratif.
  select m.user_id into v_tech_user
  from public.organization_members m
  where m.id = old.technician_id;

  v_is_author := v_tech_user is not null and v_tech_user = v_actor;

  -- ---------------------------------------------------------------------------
  -- Celui qui contrôle n'écrit pas
  -- ---------------------------------------------------------------------------
  --
  -- Le contrôleur ne dispose que de trois leviers : approuver, refuser, motiver
  -- son refus. Le contenu appartient à qui était sur le chantier.
  if not v_is_author then
    if new.work_description is distinct from old.work_description
       or new.observations   is distinct from old.observations
       or new.materials_used is distinct from old.materials_used
       or new.tools_used     is distinct from old.tools_used
       or new.customer_signature_path is distinct from old.customer_signature_path
       or new.customer_signature_name is distinct from old.customer_signature_name
       or new.technician_signature_path is distinct from old.technician_signature_path
    then
      raise exception
        'Le contenu d''un compte rendu appartient à son auteur. Vous pouvez le valider ou le refuser en motivant, pas le réécrire.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  -- ---------------------------------------------------------------------------
  -- L'auteur ne s'auto-décerne pas un contrôle
  -- ---------------------------------------------------------------------------
  --
  -- `reviewed_by` et `reviewed_at` sont posés par
  -- `enforce_report_review_separation`, qui s'exécute APRÈS ce trigger dans
  -- l'ordre alphabétique. À ce stade, toute valeur présente vient donc du
  -- client, et n'a rien à y faire.
  if new.reviewed_by is distinct from old.reviewed_by
     or new.reviewed_at is distinct from old.reviewed_at then
    raise exception 'Les informations de contrôle sont posées par le serveur.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

-- Nommé pour passer AVANT `intervention_reports_review_separation` :
-- « authorship » précède « review_separation » dans l'ordre alphabétique, et
-- l'on veut inspecter ce que le client a réellement envoyé, avant que le second
-- trigger ne pose lui-même `reviewed_by` et `reviewed_at`.
drop trigger if exists intervention_reports_authorship on public.intervention_reports;
create trigger intervention_reports_authorship
  before update on public.intervention_reports
  for each row execute function app.enforce_report_authorship();
