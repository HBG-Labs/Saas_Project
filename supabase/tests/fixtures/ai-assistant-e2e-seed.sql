-- Données de vérité terrain pour l'audit de l'Assistant IA.
-- À exécuter uniquement sur une base locale ou une branche Supabase de test.
-- Tous les libellés et identifiants sont préfixés E2E_AI / e2e.

do $$
declare
  v_org uuid := 'e2e00000-0000-4000-8000-000000000001';
  v_other_org uuid := 'e2e00000-0000-4000-8000-000000000002';
  v_owner uuid := '850de84f-cb92-40a8-aa93-862edb05611b';
  v_technician_member uuid;
begin
  select id into strict v_technician_member
  from public.organization_members
  where organization_id = v_org
    and user_id = 'e5eaca3a-6c32-446e-8467-60b215413818';

  update public.organizations set
    name = 'E2E_AI_ORG_COMPLETE',
    legal_name = 'E2E_AI Réseau Antilles SAS',
    registration_number = '12345678900012',
    vat_number = 'FR32123456789',
    email = 'audit-e2e@example.test',
    phone = '+596 596 00 00 00',
    address_line1 = '12 rue des Tests',
    postal_code = '97200',
    city = 'Fort-de-France',
    country = 'FR',
    industry = 'general',
    default_vat_rate = 8.5,
    quote_payment_terms = '30 jours fin de mois',
    quote_payment_method = 'Virement',
    holiday_territory = 'martinique',
    updated_at = now()
  where id = v_org;

  insert into public.customers (
    id, organization_id, reference, name, legal_name, registration_number,
    vat_number, email, phone, address_line1, postal_code, city, country, notes,
    customer_type, status, created_by, created_at
  ) values
  ('e2e20000-0000-4000-8000-000000000001', v_org, 'E2E-CLI-001',
   'E2E_AI Tricatel', 'E2E_AI Tricatel SAS', '11111111100011', 'FR11111111111',
   'tricatel@example.test', '+59600000101', '1 rue de la Première', '97200',
   'Fort-de-France', 'FR', 'Premier client de référence', 'company', 'active',
   v_owner, '2025-01-01T08:00:00Z'),
  ('e2e20000-0000-4000-8000-000000000002', v_org, 'E2E-CLI-002',
   'E2E_AI Tricatèl', 'E2E_AI Tricatèl SARL', null, null, null, null, null, null,
   'Le Lamentin', 'FR', null, 'company', 'active', v_owner,
   '2025-01-02T08:00:00Z')
  on conflict (id) do update
    set name = excluded.name, created_at = excluded.created_at;

  insert into public.customers (
    id, organization_id, reference, name, city, country, customer_type, status,
    created_by, created_at
  )
  select md5('E2E_AI_CUSTOMER_' || g)::uuid, v_org,
    'E2E-CLI-' || lpad(g::text, 3, '0'),
    case when g = 51 then 'E2E_AI Client Zèbre-d''Or'
         else 'E2E_AI Client ' || lpad(g::text, 3, '0') end,
    case when g % 3 = 0 then 'Schoelcher'
         when g % 3 = 1 then 'Ducos' else 'Le Robert' end,
    'FR', 'company',
    (case when g = 50 then 'archived' else 'active' end)::public.content_status,
    v_owner,
    '2025-01-01T08:00:00Z'::timestamptz + (g || ' days')::interval
  from generate_series(3, 51) g
  on conflict (id) do update
    set name = excluded.name, created_at = excluded.created_at;

  insert into public.customer_contacts (
    id, customer_id, organization_id, first_name, last_name, role_label, email,
    phone, is_primary, notes
  ) values
  ('e2e21000-0000-4000-8000-000000000001',
   'e2e20000-0000-4000-8000-000000000001', v_org, 'Élodie', 'D''Aubigné',
   'Responsable achats', 'elodie@example.test', '+59600000201', true,
   'Appeler avant 16 h'),
  ('e2e21000-0000-4000-8000-000000000002',
   'e2e20000-0000-4000-8000-000000000001', v_org, null, 'Saint-John',
   'Gardien', null, null, false, null)
  on conflict (id) do nothing;

  insert into public.sites (
    id, customer_id, organization_id, name, code, address_line1, postal_code,
    city, country, latitude, longitude, access_notes, contact_id, status,
    created_at
  ) values
  ('e2e22000-0000-4000-8000-000000000001',
   'e2e20000-0000-4000-8000-000000000001', v_org,
   'E2E_AI Site Baie-des-Flamands', 'E2E-SITE-01', '8 quai des Tests', '97200',
   'Fort-de-France', 'FR', 14.6161, -61.0588, 'Portail bleu, code E2E 2048',
   'e2e21000-0000-4000-8000-000000000001', 'active',
   '2025-01-03T08:00:00Z'),
  ('e2e22000-0000-4000-8000-000000000002',
   'e2e20000-0000-4000-8000-000000000002', v_org,
   'E2E_AI Dépôt Nord', 'E2E-SITE-02', null, null, 'Le Lamentin', 'FR', null,
   null, null, null, 'active', '2025-01-04T08:00:00Z')
  on conflict (id) do nothing;

  insert into public.teams (
    id, organization_id, name, slug, description, color, manager_id, status,
    created_by, created_at
  ) values (
    'e2e23000-0000-4000-8000-000000000001', v_org,
    'E2E_AI Équipe Fibre', 'e2e-ai-equipe-fibre', 'Équipe de test', '#1d4ed8',
    (select id from public.organization_members
     where organization_id = v_org
       and user_id = '077abbc2-5b5b-4b06-aa90-5814462d48b7'),
    'active', v_owner, '2025-01-05T08:00:00Z'
  ) on conflict (id) do nothing;

  insert into public.team_members (id, team_id, member_id, role) values
  ('e2e23100-0000-4000-8000-000000000001',
   'e2e23000-0000-4000-8000-000000000001',
   (select id from public.organization_members
    where organization_id = v_org
      and user_id = '077abbc2-5b5b-4b06-aa90-5814462d48b7'), 'lead'),
  ('e2e23100-0000-4000-8000-000000000002',
   'e2e23000-0000-4000-8000-000000000001', v_technician_member, 'member')
  on conflict (id) do nothing;

  insert into public.missions (
    id, organization_id, reference, title, description, priority, status,
    assigned_team_id, assigned_user_id, scheduled_start, scheduled_end,
    location_label, city, country, customer_name, notes, created_by, created_at,
    customer_id, site_id
  )
  select md5('E2E_AI_MISSION_' || g)::uuid, v_org,
    'E2E-MIS-' || lpad(g::text, 3, '0'),
    case when g = 1 then 'E2E_AI Première mission Tricatel'
         when g = 51 then 'E2E_AI Mission limite cinquante-et-un'
         else 'E2E_AI Mission ' || lpad(g::text, 3, '0') end,
    case when g = 7 then 'Mission urgente avec date dépassée'
         else 'Mission de couverture IA' end,
    (case when g in (7, 49) then 'urgent'
          when g % 5 = 0 then 'high' else 'normal' end)::public.mission_priority,
    (case when g = 7 then 'assigned'
          when g % 7 = 0 then 'completed'
          when g % 3 = 0 then 'accepted' else 'draft' end)::public.mission_status,
    'e2e23000-0000-4000-8000-000000000001', v_technician_member,
    case when g = 7 then now() - interval '3 days'
         else now() + ((g - 20) || ' days')::interval end,
    case when g = 7 then now() - interval '2 days'
         else now() + ((g - 20) || ' days')::interval + interval '2 hours' end,
    'E2E_AI Zone ' || g,
    case when g % 2 = 0 then 'Fort-de-France' else 'Le Lamentin' end,
    'FR',
    case when g <= 30 then 'E2E_AI Tricatel'
         else 'E2E_AI Client ' || lpad(((g % 49) + 3)::text, 3, '0') end,
    case when g = 8 then 'Valeurs nulles volontaires sur certains champs'
         else null end,
    v_owner,
    '2025-02-01T08:00:00Z'::timestamptz + (g || ' days')::interval,
    case when g <= 30 then 'e2e20000-0000-4000-8000-000000000001'::uuid
         else md5('E2E_AI_CUSTOMER_' || ((g % 49) + 3))::uuid end,
    case when g <= 30 then 'e2e22000-0000-4000-8000-000000000001'::uuid
         else null end
  from generate_series(1, 51) g
  on conflict (id) do update
    set title = excluded.title, status = excluded.status,
        scheduled_start = excluded.scheduled_start,
        scheduled_end = excluded.scheduled_end,
        created_at = excluded.created_at;

  insert into public.mission_assignments (
    id, mission_id, team_id, member_id, assigned_by, assigned_at, accepted_at
  )
  select md5('E2E_AI_ASSIGNMENT_' || g)::uuid,
    md5('E2E_AI_MISSION_' || g)::uuid,
    'e2e23000-0000-4000-8000-000000000001', v_technician_member, v_owner,
    now() - (g || ' days')::interval,
    case when g % 2 = 0
         then now() - (g || ' days')::interval + interval '1 hour'
         else null end
  from generate_series(1, 51) g
  on conflict (id) do nothing;

  insert into public.mission_status_events (
    id, mission_id, from_status, to_status, actor_id, reason, created_at
  )
  select md5('E2E_AI_STATUS_' || g)::uuid,
    md5('E2E_AI_MISSION_' || g)::uuid, 'draft', 'assigned', v_owner,
    case when g = 7 then 'E2E_AI urgence client' else 'E2E_AI affectation' end,
    '2025-02-01T09:00:00Z'::timestamptz + (g || ' days')::interval
  from generate_series(1, 51) g
  on conflict (id) do nothing;

  insert into public.customers (
    id, organization_id, reference, name, city, country, customer_type, status,
    created_by, created_at
  ) values (
    'e2e29000-0000-4000-8000-000000000001', v_other_org,
    'E2E-SECRET-CLI', 'E2E_AI CLIENT AUTRE ORGANISATION SECRET', 'Paris', 'FR',
    'company', 'active', 'f742628b-2eac-4f34-9f4a-7feeec631a8f',
    '2024-01-01T00:00:00Z'
  ) on conflict (id) do nothing;
end;
$$;

do $$
declare
  v_org uuid := 'e2e00000-0000-4000-8000-000000000001';
  v_owner uuid := '850de84f-cb92-40a8-aa93-862edb05611b';
  v_owner_member uuid;
  v_manager uuid := '077abbc2-5b5b-4b06-aa90-5814462d48b7';
  v_manager_member uuid;
  v_technician_member uuid;
  v_form_template uuid;
  v_checklist_template uuid;
begin
  select id into strict v_owner_member from public.organization_members
  where organization_id = v_org and user_id = v_owner;
  select id into strict v_manager_member from public.organization_members
  where organization_id = v_org and user_id = v_manager;
  select id into strict v_technician_member from public.organization_members
  where organization_id = v_org
    and user_id = 'e5eaca3a-6c32-446e-8467-60b215413818';

  insert into public.interventions (
    id, mission_id, organization_id, technician_id, status, start_time,
    end_time, start_latitude, start_longitude, notes, created_at
  ) values
  ('e2e30000-0000-4000-8000-000000000001', md5('E2E_AI_MISSION_1')::uuid,
   v_org, v_technician_member, 'completed', now() - interval '10 days',
   now() - interval '10 days' + interval '3 hours', 14.6161, -61.0588,
   'E2E_AI intervention terminée', '2025-03-01T08:00:00Z'),
  ('e2e30000-0000-4000-8000-000000000002', md5('E2E_AI_MISSION_7')::uuid,
   v_org, v_technician_member, 'planned', null, null, null, null,
   'E2E_AI intervention urgente en retard', '2025-03-02T08:00:00Z'),
  ('e2e30000-0000-4000-8000-000000000003', md5('E2E_AI_MISSION_3')::uuid,
   v_org, v_manager_member, 'in_progress', now() - interval '2 hours', null,
   14.6415, -61.0242, 'E2E_AI intervention en cours',
   '2025-03-03T08:00:00Z')
  on conflict (id) do update set status = excluded.status,
    start_time = excluded.start_time, end_time = excluded.end_time;

  -- Le trigger de chronométrage impose un seul segment ouvert et remplace les
  -- horodatages fournis. On suit donc le même enchaînement que l'application.
  insert into public.intervention_time_entries (id, intervention_id, kind)
  values ('e2e31000-0000-4000-8000-000000000001',
          'e2e30000-0000-4000-8000-000000000001', 'work')
  on conflict (id) do nothing;
  update public.intervention_time_entries set ended_at = now()
  where id = 'e2e31000-0000-4000-8000-000000000001' and ended_at is null;

  insert into public.intervention_time_entries (id, intervention_id, kind, reason)
  values ('e2e31000-0000-4000-8000-000000000002',
          'e2e30000-0000-4000-8000-000000000001', 'pause', 'Déjeuner')
  on conflict (id) do nothing;
  update public.intervention_time_entries set ended_at = now()
  where id = 'e2e31000-0000-4000-8000-000000000002' and ended_at is null;

  insert into public.intervention_time_entries (id, intervention_id, kind)
  values ('e2e31000-0000-4000-8000-000000000003',
          'e2e30000-0000-4000-8000-000000000003', 'work')
  on conflict (id) do nothing;

  insert into public.intervention_reports (
    id, intervention_id, organization_id, technician_id, work_description,
    observations, materials_used, tools_used, customer_signature_name, status,
    submitted_at, reviewed_at, reviewed_by, created_at
  ) values (
    'e2e32000-0000-4000-8000-000000000001',
    'e2e30000-0000-4000-8000-000000000001', v_org, v_technician_member,
    'Remplacement du connecteur optique', 'Mesure finale : -18,4 dBm',
    '[{"name":"Connecteur SC/APC","quantity":2}]'::jsonb,
    '[{"name":"Photomètre"}]'::jsonb, 'E2E_AI Client Signataire',
    'approved', '2025-03-01T12:00:00Z', '2025-03-01T13:00:00Z', v_owner_member,
    '2025-03-01T08:00:00Z'
  ) on conflict (id) do nothing;

  select id into v_form_template from public.form_templates
  where status = 'active' order by created_at limit 1;
  if v_form_template is not null then
    insert into public.intervention_form_responses (
      id, intervention_id, organization_id, form_template_id, values,
      completed_at, created_at
    ) values (
      'e2e34000-0000-4000-8000-000000000001',
      'e2e30000-0000-4000-8000-000000000001', v_org, v_form_template,
      '{"E2E_AI_mesure":"-18.4 dBm"}'::jsonb, '2025-03-01T11:30:00Z',
      '2025-03-01T11:00:00Z'
    ) on conflict (id) do nothing;
  end if;

  select id into v_checklist_template from public.checklist_templates
  where status = 'active' order by created_at limit 1;
  if v_checklist_template is not null then
    insert into public.intervention_checklist_responses (
      id, intervention_id, organization_id, checklist_template_id, checked,
      completed_at, created_at
    ) values (
      'e2e35000-0000-4000-8000-000000000001',
      'e2e30000-0000-4000-8000-000000000001', v_org,
      v_checklist_template, '{"E2E_AI_SECURITE":true}'::jsonb,
      '2025-03-01T11:30:00Z', '2025-03-01T11:00:00Z'
    ) on conflict (id) do nothing;
  end if;

  insert into public.leave_requests (
    id, organization_id, member_id, type, start_date, end_date, days_count,
    reason, status, requested_at, reviewed_by, reviewed_at, review_note
  ) values
  ('e2e36000-0000-4000-8000-000000000001', v_org, v_technician_member,
   'paid_leave', current_date + 5, current_date + 7, 3,
   'E2E_AI congé futur', 'approved', now() - interval '2 days', v_owner,
   now() - interval '1 day', 'Validé pour le test'),
  ('e2e36000-0000-4000-8000-000000000002', v_org, v_manager_member,
   'rtt', current_date - 10, current_date - 10, 1,
   null, 'pending', now() - interval '11 days', null, null, null)
  on conflict (id) do nothing;

  insert into public.leave_balances (
    id, organization_id, member_id, year, paid_leave_acquired, rtt_acquired,
    recovery_hours
  ) values (
    'e2e36100-0000-4000-8000-000000000001', v_org, v_technician_member,
    extract(year from current_date)::integer, 25.5, 10, 7.5
  ) on conflict (id) do nothing;

  insert into public.recurring_tasks (
    id, organization_id, title, frequency, next_date, customer_id, site_id,
    assigned_member_id, estimated_minutes, notes, is_active, created_by
  ) values (
    'e2e37000-0000-4000-8000-000000000001', v_org,
    'E2E_AI Contrôle trimestriel', 'quarterly', current_date + 20,
    'e2e20000-0000-4000-8000-000000000001',
    'e2e22000-0000-4000-8000-000000000001', v_technician_member, 90,
    'E2E_AI tâche récurrente', true, v_owner
  ) on conflict (id) do nothing;

  insert into public.technician_locations (
    member_id, organization_id, latitude, longitude, accuracy_m, heading,
    speed_kmh, battery_pct, presence, vehicle_plate, recorded_at
  ) values (
    v_technician_member, v_org, 14.6100, -61.0800, 5.2, 90, 0, 73,
    'available', 'E2E-972-AA', now()
  ) on conflict (member_id) do update set presence = excluded.presence,
    recorded_at = excluded.recorded_at;

  insert into public.technician_location_pings (
    id, organization_id, member_id, latitude, longitude, heading, speed_kmh,
    battery_pct, presence, note, recorded_at
  ) values (
    'e2e38000-0000-4000-8000-000000000001', v_org,
    v_technician_member, 14.6100, -61.0800, 90, 0, 73, 'available',
    'E2E_AI point de test', now() - interval '5 minutes'
  ) on conflict (id) do nothing;
end;
$$;
