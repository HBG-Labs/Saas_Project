-- =============================================================================
-- Correction : aligner les droits des réponses sur ceux des comptes rendus
-- =============================================================================
--
-- LE DÉFAUT
--
-- `20260815100200_form_templates.sql` conditionnait l'écriture d'une réponse à
-- la permission `intervention.report`. Cette permission N'EXISTE PAS : les
-- seules permissions d'intervention semées sont `intervention.view_all` et
-- `intervention.review`.
--
-- Conséquence : `has_org_permission` renvoyait toujours faux, et TOUTE écriture
-- était refusée — y compris celle du technicien légitime. Le défaut a été
-- trouvé en éprouvant la validation sur des cas réels ; il n'aurait produit
-- aucune erreur de migration, seulement un formulaire impossible à enregistrer.
--
-- LA RÈGLE JUSTE
--
-- `intervention_reports` ne s'appuie pas sur une permission mais sur une
-- IDENTITÉ : seul le technicien de l'intervention peut écrire son compte rendu.
-- Les mesures relèvent du même acte — c'est la personne qui était sur place qui
-- les a relevées. Aligner les deux évite qu'un droit diverge de l'autre au fil
-- des évolutions.
--
-- La lecture suit également le modèle du compte rendu : le technicien concerné,
-- ou quelqu'un qui détient `intervention.view_all` ou `intervention.review`.
-- Ma version initiale ouvrait la lecture à tout membre de l'organisation
-- disposant du module — un technicien aurait vu les mesures de ses collègues,
-- ce que le compte rendu lui refuse déjà.
-- =============================================================================

drop policy if exists "intervention_form_responses_select" on public.intervention_form_responses;
create policy "intervention_form_responses_select"
  on public.intervention_form_responses for select
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'interventions'))
    and (
      (select app.has_org_permission(organization_id, 'intervention.view_all'))
      or (select app.has_org_permission(organization_id, 'intervention.review'))
      or intervention_id in (
        select i.id from public.interventions i
        join public.organization_members m on m.id = i.technician_id
        where m.user_id = (select auth.uid())
      )
    )
  );

drop policy if exists "intervention_form_responses_insert" on public.intervention_form_responses;
create policy "intervention_form_responses_insert"
  on public.intervention_form_responses for insert
  to authenticated
  with check (
    (select app.can_use_pro_module(organization_id, 'interventions'))
    and intervention_id in (
      select i.id from public.interventions i
      join public.organization_members m on m.id = i.technician_id
      where m.user_id = (select auth.uid())
    )
  );

-- La mise à jour suit la même règle. Le gel après soumission du compte rendu
-- n'est pas exprimé ici : il relèvera d'un trigger, comme pour
-- `intervention_reports`, où la condition dépend d'un état que la policy ne
-- peut pas consulter proprement.
drop policy if exists "intervention_form_responses_update" on public.intervention_form_responses;
create policy "intervention_form_responses_update"
  on public.intervention_form_responses for update
  to authenticated
  using (
    (select app.can_use_pro_module(organization_id, 'interventions'))
    and intervention_id in (
      select i.id from public.interventions i
      join public.organization_members m on m.id = i.technician_id
      where m.user_id = (select auth.uid())
    )
  )
  with check ((select app.can_use_pro_module(organization_id, 'interventions')));
