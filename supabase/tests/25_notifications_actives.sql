-- =============================================================================
-- 25 — Notifications actives : la file, les événements, le tirage, le recul
-- =============================================================================
--
-- Ce que cette suite prouve :
--
--   1. une affectation enfile UNE ligne pour le technicien, jamais pour
--      l'acteur ; la réaffecter trois fois n'en fait qu'une (anti-rafale), avec
--      l'instantané du dernier état ; une mission brouillon ou annulée ne
--      prévient personne ;
--   2. une demande de congé prévient qui peut valider, pas le demandeur ; la
--      décision prévient le demandeur seul ;
--   3. un compte rendu soumis prévient qui contrôle, sauf le technicien ; un
--      compte rendu renvoyé prévient le technicien ;
--   4. le tirage verrouille, joint l'adresse et les réglages, et ne rend pas
--      deux fois la même ligne ; un échec repousse avec recul ; le huitième
--      échec abandonne ; « envoyé » et « ignoré » ferment la ligne ;
--   5. la file est fermée aux clients ; l'entreprise B n'y voit rien.
--
-- Transaction annulée. Rien ne reste en base.
-- =============================================================================

begin;
set local search_path = pg_temp, public;

-- @inclure communs/organisation-abonnee.sql

insert into t_ids (k, v) values
  ('patron',   '00000000-0000-4000-8000-000000250001'),
  ('chef',     '00000000-0000-4000-8000-000000250002'),
  ('tech_a',   '00000000-0000-4000-8000-000000250003'),
  ('tech_b',   '00000000-0000-4000-8000-000000250004'),
  ('patron_b', '00000000-0000-4000-8000-000000250005');
select pg_temp.creer_comptes();

create temporary table t_ctx (org_id uuid, membre_a uuid, membre_b uuid, mission uuid, conge uuid, interv uuid, rapport uuid, livraison uuid);
grant select, update on t_ctx to authenticated;
insert into t_ctx (org_id)
values (pg_temp.organisation_abonnee('notif-a', 'Notif A', 'patron', 'business'));
select pg_temp.organisation_abonnee('notif-b', 'Notif B', 'patron_b', 'business');

select pg_temp.ajouter_membre(org_id, 'chef', 'team_leader') from t_ctx;
select pg_temp.ajouter_membre(org_id, 'tech_a', 'technician') from t_ctx;
select pg_temp.ajouter_membre(org_id, 'tech_b', 'technician') from t_ctx;
update t_ctx set
  membre_a = (select id from public.organization_members where user_id = pg_temp.uid('tech_a')),
  membre_b = (select id from public.organization_members where user_id = pg_temp.uid('tech_b'));

-- Ne compter que les lignes de CETTE suite : la base liée a de vraies données.
-- `security definer` : la file est fermée à `authenticated` (c'est testé en
-- partie 5) ; l'aide la lit avec les droits du lanceur.
create function pg_temp.livraisons(p_event text, p_dest text) returns bigint
language sql stable security definer as $$
  select count(*) from public.notification_deliveries d
  where d.organization_id = (select org_id from t_ctx) and d.event = p_event
    and d.recipient_user_id = pg_temp.uid(p_dest)
$$;

create function pg_temp.charge(p_event text, p_dest text, p_entity uuid) returns jsonb
language sql stable security definer as $$
  select d.payload from public.notification_deliveries d
  where d.event = p_event and d.recipient_user_id = pg_temp.uid(p_dest) and d.entity_id = p_entity
  order by d.created_at desc limit 1
$$;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 1 — l''affectation ==='; end $$;
-- =============================================================================

select pg_temp.login('patron'); set local role authenticated;
do $$ declare m uuid; begin
  insert into public.missions (organization_id, title, scheduled_start, scheduled_end, created_by, city, customer_name)
  select org_id, 'Raccordement rue des Flamboyants', now() + interval '1 day', now() + interval '1 day 2 hours', pg_temp.uid('patron'), 'Fort-de-France', 'Dupont'
  from t_ctx returning id into m;
  update t_ctx set mission = m;
  perform pg_temp.ok(pg_temp.livraisons('mission_assigned', 'tech_a') = 0, 'un brouillon sans affectation ne previent personne');

  update public.missions set assigned_user_id = (select membre_a from t_ctx), status = 'assigned' where id = m;
  perform pg_temp.ok(pg_temp.livraisons('mission_assigned', 'tech_a') = 1, 'l''affectation enfile une ligne pour le technicien');
  perform pg_temp.ok(pg_temp.livraisons('mission_assigned', 'patron') = 0, 'jamais pour l''acteur');

  -- Réaffectée à tech_b puis rendue à tech_a : tech_a garde UNE ligne, à jour.
  update public.missions set title = 'Raccordement rue des Flamboyants (urgent)', assigned_user_id = (select membre_b from t_ctx) where id = m;
  update public.missions set assigned_user_id = (select membre_a from t_ctx) where id = m;
  perform pg_temp.ok(pg_temp.livraisons('mission_assigned', 'tech_a') = 1 and pg_temp.livraisons('mission_assigned', 'tech_b') = 1,
    'la reaffectation ne duplique pas la ligne en attente');
  perform pg_temp.ok((pg_temp.charge('mission_assigned', 'tech_a', m)->>'title') like '%(urgent)',
    'l''instantane est celui du dernier etat');
  perform pg_temp.ok((pg_temp.charge('mission_assigned', 'tech_a', m)->>'path') = '/missions/' || m,
    'le lien profond mene a la mission');
  perform pg_temp.ok((pg_temp.charge('mission_assigned', 'tech_a', m)->>'actor') = 'patron',
    'l''auteur est nomme');

  -- Un chef qui s'affecte lui-même : rien.
  update public.missions set status = 'cancelled' where id = m;
  perform pg_temp.ok(pg_temp.livraisons('mission_assigned', 'tech_a') = 1, 'une annulation n''enfile rien de plus');
end $$;
reset role;

select pg_temp.login('chef'); set local role authenticated;
do $$ declare m uuid; v_chef uuid; begin
  select id into v_chef from public.organization_members where user_id = pg_temp.uid('chef');
  insert into public.missions (organization_id, title, scheduled_start, scheduled_end, created_by, assigned_user_id, status)
  select org_id, 'Je me l''affecte', now() + interval '2 days', now() + interval '2 days 1 hour', pg_temp.uid('chef'), v_chef, 'assigned'
  from t_ctx returning id into m;
  perform pg_temp.ok(pg_temp.livraisons('mission_assigned', 'chef') = 0, 'on ne se previent pas soi-meme');
end $$;
reset role;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 2 — le conge ==='; end $$;
-- =============================================================================

select pg_temp.login('tech_a'); set local role authenticated;
do $$ declare c uuid; begin
  insert into public.leave_requests (organization_id, member_id, type, start_date, end_date, days_count)
  select org_id, membre_a, 'paid_leave', date '2026-11-02', date '2026-11-04', 3 from t_ctx returning id into c;
  update t_ctx set conge = c;
  perform pg_temp.ok(pg_temp.livraisons('leave_requested', 'patron') = 1, 'la demande previent le patron (leave.approve)');
  perform pg_temp.ok(pg_temp.livraisons('leave_requested', 'chef') = 0, 'pas le chef d''equipe (il ne valide pas)');
  perform pg_temp.ok(pg_temp.livraisons('leave_requested', 'tech_a') = 0 and pg_temp.livraisons('leave_requested', 'tech_b') = 0,
    'ni le demandeur, ni un collegue');
end $$;
reset role;

select pg_temp.login('patron'); set local role authenticated;
update public.leave_requests set status = 'approved' where id = (select conge from t_ctx);
reset role;
select pg_temp.ok(pg_temp.livraisons('leave_decided', 'tech_a') = 1
  and (pg_temp.charge('leave_decided', 'tech_a', (select conge from t_ctx))->>'status') = 'approved',
  'la decision previent le demandeur, avec son sens');
select pg_temp.ok(pg_temp.livraisons('leave_decided', 'patron') = 0, 'pas celui qui decide');

-- =============================================================================
do $$ begin raise notice '=== PARTIE 3 — le compte rendu ==='; end $$;
-- =============================================================================

-- L'intervenant seul termine sa mission : la fixture se joue sous sa session.
select pg_temp.login('tech_a');
do $$ declare m uuid; i uuid; r uuid; begin
  insert into public.missions (organization_id, title, scheduled_start, scheduled_end, created_by, assigned_user_id, status)
  select org_id, 'Chantier a rendre', now() - interval '3 hours', now() - interval '1 hour', pg_temp.uid('patron'), membre_a, 'in_progress'
  from t_ctx returning id into m;
  insert into public.interventions (mission_id, organization_id, technician_id, status)
  select m, org_id, membre_a, 'in_progress' from t_ctx returning id into i;
  -- Un compte rendu se soumet sur une intervention terminée (transition de mission).
  update public.interventions set status = 'completed', end_time = now() where id = i;
  update public.missions set status = 'completed' where id = m;
  insert into public.intervention_reports (intervention_id, organization_id, technician_id, work_description)
  select i, org_id, membre_a, 'Boitier pose, continuite verifiee.' from t_ctx returning id into r;
  update t_ctx set interv = i, rapport = r;
end $$;

select pg_temp.login('tech_a'); set local role authenticated;
update public.intervention_reports set status = 'submitted' where id = (select rapport from t_ctx);
reset role;
select pg_temp.ok(pg_temp.livraisons('report_submitted', 'patron') = 1 and pg_temp.livraisons('report_submitted', 'chef') = 1,
  'le compte rendu soumis previent qui controle : patron et chef');
select pg_temp.ok(pg_temp.livraisons('report_submitted', 'tech_a') = 0 and pg_temp.livraisons('report_submitted', 'tech_b') = 0,
  'pas le technicien, pas un collegue');

select pg_temp.login('chef'); set local role authenticated;
update public.intervention_reports set status = 'rejected', rejection_reason = 'Photo du boitier manquante.' where id = (select rapport from t_ctx);
reset role;
select pg_temp.ok(pg_temp.livraisons('report_rejected', 'tech_a') = 1
  and (pg_temp.charge('report_rejected', 'tech_a', (select rapport from t_ctx))->>'rejection_reason') = 'Photo du boitier manquante.',
  'le renvoi previent le technicien, avec le motif');
select pg_temp.ok(pg_temp.livraisons('report_rejected', 'chef') = 0, 'pas celui qui renvoie');

-- =============================================================================
do $$ begin raise notice '=== PARTIE 4 — le tirage et le recul ==='; end $$;
-- =============================================================================

-- On isole une ligne de la suite pour suivre son cycle.
update t_ctx set livraison = (select d.id from public.notification_deliveries d
  where d.event = 'report_rejected' and d.entity_id = (select rapport from t_ctx));

do $$ declare l record; n int; begin
  -- Un réglage coupé chez tech_a : le tirage le rapporte tel quel.
  insert into public.user_preferences (user_id, notify_report_review) values (pg_temp.uid('tech_a'), false)
  on conflict (user_id) do update set notify_report_review = false;

  select * into l from public.claim_notification_deliveries(100) c where c.id = (select livraison from t_ctx);
  perform pg_temp.ok(l.id is not null, 'le tirage rend la ligne due');
  perform pg_temp.ok(l.recipient_email = 'tech_a@test.local' and l.recipient_name = 'tech_a' and l.organization_name = 'Notif A',
    'avec l''adresse, le nom et l''entreprise');
  perform pg_temp.ok(l.notify_report_review = false and l.notify_new_mission = true,
    'et les reglages du destinataire, tels qu''ils sont MAINTENANT');

  select count(*) into n from public.claim_notification_deliveries(100) c where c.id = (select livraison from t_ctx);
  perform pg_temp.ok(n = 0, 'une ligne verrouillee n''est pas rendue deux fois');

  -- Échec : recul.
  perform public.record_notification_delivery_result((select livraison from t_ctx), 'error', null, 'Resend 503');
  perform pg_temp.ok((select status = 'pending' and attempts = 1 and locked_at is null and last_error = 'Resend 503'
                       and next_attempt_at = now() + interval '2 minutes'
                      from public.notification_deliveries where id = (select livraison from t_ctx)),
    'un echec repousse de deux minutes et libere le verrou');
  update public.notification_deliveries set attempts = 7 where id = (select livraison from t_ctx);
  perform public.record_notification_delivery_result((select livraison from t_ctx), 'error', null, 'Resend 503');
  perform pg_temp.ok((select status = 'failed' from public.notification_deliveries where id = (select livraison from t_ctx)),
    'le huitieme echec abandonne');

  -- Envoyé, ignoré : la ligne se ferme.
  select d.id into l from public.notification_deliveries d where d.event = 'leave_decided' and d.entity_id = (select conge from t_ctx);
  perform public.record_notification_delivery_result(l.id, 'sent', 'resend-123');
  perform pg_temp.ok((select status = 'sent' and provider_id = 'resend-123' and sent_at is not null
                      from public.notification_deliveries where id = l.id), 'envoye : ferme, avec l''identifiant du fournisseur');
  select d.id into l from public.notification_deliveries d where d.event = 'mission_assigned' and d.recipient_user_id = pg_temp.uid('tech_b');
  perform public.record_notification_delivery_result(l.id, 'skipped');
  perform pg_temp.ok((select status = 'skipped' from public.notification_deliveries where id = l.id), 'ignore : ferme sans envoi');

  -- Une ligne fermée n'empêche pas une nouvelle attente pour le même triplet.
  perform pg_temp.refuses(
    $q$select public.record_notification_delivery_result(gen_random_uuid(), 'peut-etre')$q$,
    'un resultat inconnu est refuse');
end $$;

-- =============================================================================
do $$ begin raise notice '=== PARTIE 5 — la file est fermee ==='; end $$;
-- =============================================================================

select pg_temp.login('patron'); set local role authenticated;
select pg_temp.refuses($q$select count(*) from public.notification_deliveries$q$, 'meme le proprietaire ne lit pas la file');
select pg_temp.refuses($q$select * from public.claim_notification_deliveries(1)$q$, 'ni ne tire');
reset role;
select pg_temp.login('patron_b'); set local role authenticated;
select pg_temp.refuses($q$select count(*) from public.notification_deliveries$q$, 'l''entreprise B non plus');
reset role;

select 'TOUS LES TESTS PASSENT' as resultat;

rollback;
