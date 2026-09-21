-- REZO360 — tenant commercial fictif, staging uniquement.
--
-- Ce fichier n'est PAS une migration. Il est exécuté dans une transaction par
-- `npm run demo:prepare`, après validation stricte du project ref. Les secrets
-- arrivent par `set_config` dans la session et ne sont jamais écrits ici.

do $$
begin
  if current_setting('rezo360.demo.project_ref', true) <> 'waktfxautydtztcalzbk' then
    raise exception 'REFUS : ce seed est réservé au staging REZO360 autorisé.';
  end if;
  if exists (select 1 from public.organizations where slug = 'rezo360-commercial-demo') then
    raise exception 'REFUS : le tenant commercial existe déjà.';
  end if;
  if exists (
    select 1 from auth.users
    where lower(email) in (
      lower(current_setting('rezo360.demo.email')),
      lower(current_setting('rezo360.demo.portal_email'))
    )
  ) then
    raise exception 'REFUS : un compte de la démonstration existe déjà.';
  end if;
end
$$;

create or replace function pg_temp.demo_user(
  p_id uuid,
  p_email text,
  p_name text,
  p_password text
)
returns void
language plpgsql
as $fn$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated',
    p_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('display_name', p_name, 'email_verified', true),
    now(), now(), '', '', '', ''
  );

  insert into auth.identities (
    provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    p_id::text, p_id,
    jsonb_build_object(
      'sub', p_id::text,
      'email', p_email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email', now(), now(), now()
  );
end;
$fn$;

select pg_temp.demo_user(
  'de360000-0000-4000-8000-000000000001',
  current_setting('rezo360.demo.email'),
  'Harry Bergoz',
  current_setting('rezo360.demo.password')
);
select pg_temp.demo_user(
  'de360000-0000-4000-8000-000000000002',
  current_setting('rezo360.demo.portal_email'),
  'Nadia Belkacem',
  current_setting('rezo360.demo.portal_password')
);
select pg_temp.demo_user(
  'de360000-0000-4000-8000-000000000003',
  'alex.martin@rezo360.test',
  'Alex Martin',
  encode(gen_random_bytes(24), 'base64')
);
select pg_temp.demo_user(
  'de360000-0000-4000-8000-000000000004',
  'lea.robert@rezo360.test',
  'Léa Robert',
  encode(gen_random_bytes(24), 'base64')
);

insert into public.organizations (
  id, slug, name, legal_name, registration_number, vat_number, email, phone,
  address_line1, postal_code, city, country, industry, default_vat_rate,
  quote_payment_terms, quote_payment_method, legal_form, ape_code,
  share_capital_cents, rcs_city, iban, bic, vat_regime, created_by
) values (
  'de360000-0000-4000-8000-000000000010',
  'rezo360-commercial-demo',
  'HBG Labs',
  'HBG Labs SAS',
  '91234567800018',
  'FR44912345678',
  'contact@hbg-labs.fr',
  '01 84 80 36 00',
  '24 avenue de la République',
  '75011',
  'Paris',
  'FR',
  'electrical',
  20,
  'Paiement à 30 jours date de facture.',
  'Virement bancaire',
  'SAS',
  '4321A',
  5000000,
  'Paris',
  'FR7612345987650123456789014',
  'AGRIFRPPXXX',
  'reel_normal',
  'de360000-0000-4000-8000-000000000001'
);

insert into public.subscriptions (
  id, organization_id, plan_code, status, current_period_start,
  current_period_end, trial_ends_at, cancel_at_period_end, provider
) values (
  'de360000-0000-4000-8000-000000000020',
  'de360000-0000-4000-8000-000000000010',
  'enterprise',
  'active',
  now(),
  now() + interval '1 year',
  null,
  false,
  'demo_staging'
);

insert into public.organization_members (
  id, organization_id, user_id, role, status, job_title, phone, joined_at
) values
  ('de360000-0000-4000-8000-000000000012', 'de360000-0000-4000-8000-000000000010', 'de360000-0000-4000-8000-000000000003', 'technician', 'active', 'Technicien électricien', '06 70 22 18 40', now() - interval '2 years'),
  ('de360000-0000-4000-8000-000000000013', 'de360000-0000-4000-8000-000000000010', 'de360000-0000-4000-8000-000000000004', 'team_leader', 'active', 'Cheffe d’équipe', '06 74 19 36 28', now() - interval '18 months');

insert into public.teams (
  id, organization_id, name, slug, description, color, manager_id, created_by
) values
  ('de360000-0000-4000-8000-000000000021', 'de360000-0000-4000-8000-000000000010', 'Équipe Paris Centre', 'paris-centre', 'Dépannages et rénovations électriques', '#2563eb', 'de360000-0000-4000-8000-000000000013', 'de360000-0000-4000-8000-000000000001'),
  ('de360000-0000-4000-8000-000000000022', 'de360000-0000-4000-8000-000000000010', 'Équipe Grands Projets', 'grands-projets', 'Chantiers tertiaires et copropriétés', '#0f766e', 'de360000-0000-4000-8000-000000000013', 'de360000-0000-4000-8000-000000000001'),
  ('de360000-0000-4000-8000-000000000023', 'de360000-0000-4000-8000-000000000010', 'Astreinte', 'astreinte', 'Interventions urgentes', '#ea580c', 'de360000-0000-4000-8000-000000000013', 'de360000-0000-4000-8000-000000000001');

insert into public.team_members (team_id, member_id, role) values
  ('de360000-0000-4000-8000-000000000021', 'de360000-0000-4000-8000-000000000012', 'member'),
  ('de360000-0000-4000-8000-000000000021', 'de360000-0000-4000-8000-000000000013', 'lead'),
  ('de360000-0000-4000-8000-000000000022', 'de360000-0000-4000-8000-000000000013', 'lead');

insert into public.customers (
  id, organization_id, reference, name, legal_name, registration_number,
  vat_number, customer_type, email, phone, address_line1, postal_code, city,
  country, notes, created_by
) values
  ('de360000-0000-4000-8000-000000000101', 'de360000-0000-4000-8000-000000000010', 'CLI-DEMO-001', 'Le Fournil de Belleville', 'SARL Le Fournil de Belleville', '81234567800016', 'FR44812345678', 'company', 'contact@fournil-belleville.example', '01 43 66 12 08', '48 rue de Belleville', '75020', 'Paris', 'FR', 'Boulangerie artisanale — four et pétrin en triphasé.', 'de360000-0000-4000-8000-000000000001'),
  ('de360000-0000-4000-8000-000000000102', 'de360000-0000-4000-8000-000000000010', 'CLI-DEMO-002', 'Résidence Les Lilas', 'Syndicat des copropriétaires Les Lilas', '71234567800014', 'FR44712345678', 'company', 'syndic@les-lilas.example', '01 42 40 77 31', '12 rue des Lilas', '75019', 'Paris', 'FR', 'Trois bâtiments, 84 lots.', 'de360000-0000-4000-8000-000000000001'),
  ('de360000-0000-4000-8000-000000000103', 'de360000-0000-4000-8000-000000000010', 'CLI-DEMO-003', 'Mairie de Montreuil', 'Commune de Montreuil', '21930048000015', 'FR40219300480', 'public_body', 'services-techniques@montreuil.example', '01 48 70 60 00', '1 place Jean Jaurès', '93100', 'Montreuil', 'FR', 'Marché à bons de commande fictif.', 'de360000-0000-4000-8000-000000000001'),
  ('de360000-0000-4000-8000-000000000104', 'de360000-0000-4000-8000-000000000010', 'CLI-DEMO-004', 'La Table d’Alésia', 'SAS La Table d’Alésia', '61234567800012', 'FR44612345678', 'company', 'direction@table-alesia.example', '01 45 39 21 74', '96 rue d’Alésia', '75014', 'Paris', 'FR', 'Intervenir hors service.', 'de360000-0000-4000-8000-000000000001'),
  ('de360000-0000-4000-8000-000000000105', 'de360000-0000-4000-8000-000000000010', 'CLI-DEMO-005', 'Cabinet dentaire Morel', 'SELARL Sophie Morel', '51234567800010', 'FR44512345678', 'company', 'cabinet@morel.example', '01 45 20 33 18', '23 avenue Mozart', '75016', 'Paris', 'FR', 'Cabinet médical en activité.', 'de360000-0000-4000-8000-000000000001'),
  ('de360000-0000-4000-8000-000000000106', 'de360000-0000-4000-8000-000000000010', 'CLI-DEMO-006', 'Novaprint', 'SAS Novaprint', '41234567800018', 'FR44412345678', 'company', 'maintenance@novaprint.example', '01 46 72 15 90', '14 rue Molière', '94200', 'Ivry-sur-Seine', 'FR', 'Contrat de maintenance TGBT.', 'de360000-0000-4000-8000-000000000001');

insert into public.customer_contacts (
  id, customer_id, organization_id, first_name, last_name, role_label, email,
  phone, is_primary, portal_enabled
) values
  ('de360000-0000-4000-8000-000000000201', 'de360000-0000-4000-8000-000000000101', 'de360000-0000-4000-8000-000000000010', 'Nadia', 'Belkacem', 'Gérante', current_setting('rezo360.demo.portal_email'), '06 12 45 78 90', true, true),
  ('de360000-0000-4000-8000-000000000202', 'de360000-0000-4000-8000-000000000102', 'de360000-0000-4000-8000-000000000010', 'Marc', 'Lefebvre', 'Gestionnaire', 'marc.lefebvre@les-lilas.example', '01 42 40 77 31', true, false),
  ('de360000-0000-4000-8000-000000000203', 'de360000-0000-4000-8000-000000000103', 'de360000-0000-4000-8000-000000000010', 'Thomas', 'Nguyen', 'Responsable bâtiments', 'thomas.nguyen@montreuil.example', '01 48 70 61 22', true, false),
  ('de360000-0000-4000-8000-000000000204', 'de360000-0000-4000-8000-000000000104', 'de360000-0000-4000-8000-000000000010', 'Julien', 'Moreau', 'Chef de cuisine', 'julien@table-alesia.example', '06 77 30 12 84', true, false),
  ('de360000-0000-4000-8000-000000000205', 'de360000-0000-4000-8000-000000000105', 'de360000-0000-4000-8000-000000000010', 'Sophie', 'Morel', 'Chirurgienne-dentiste', 'sophie@morel.example', '06 64 21 05 47', true, false),
  ('de360000-0000-4000-8000-000000000206', 'de360000-0000-4000-8000-000000000106', 'de360000-0000-4000-8000-000000000010', 'Karim', 'Haddad', 'Responsable maintenance', 'karim@novaprint.example', '06 09 88 41 23', true, false);

insert into public.sites (
  id, customer_id, organization_id, name, code, address_line1, postal_code,
  city, country, latitude, longitude, access_notes, contact_id
) values
  ('de360000-0000-4000-8000-000000000211', 'de360000-0000-4000-8000-000000000101', 'de360000-0000-4000-8000-000000000010', 'Boulangerie et fournil', 'BEL', '48 rue de Belleville', '75020', 'Paris', 'FR', 48.872100, 2.380500, 'Entrée par la cour. Sonner « Fournil ». Coupure générale validée à 8 h.', 'de360000-0000-4000-8000-000000000201'),
  ('de360000-0000-4000-8000-000000000212', 'de360000-0000-4000-8000-000000000102', 'de360000-0000-4000-8000-000000000010', 'Bâtiment A', 'LILAS-A', '12 rue des Lilas', '75019', 'Paris', 'FR', 48.877600, 2.389800, 'Code 4521B. Clé du local technique chez le gardien.', 'de360000-0000-4000-8000-000000000202'),
  ('de360000-0000-4000-8000-000000000213', 'de360000-0000-4000-8000-000000000103', 'de360000-0000-4000-8000-000000000010', 'Parking Hôtel de Ville', 'MTR-PKG', '1 place Jean Jaurès', '93100', 'Montreuil', 'FR', 48.862000, 2.441600, 'Se présenter aux services techniques.', 'de360000-0000-4000-8000-000000000203'),
  ('de360000-0000-4000-8000-000000000214', 'de360000-0000-4000-8000-000000000104', 'de360000-0000-4000-8000-000000000010', 'Restaurant', 'ALE', '96 rue d’Alésia', '75014', 'Paris', 'FR', 48.828300, 2.322000, 'Livraisons par la rue Bardinet.', 'de360000-0000-4000-8000-000000000204'),
  ('de360000-0000-4000-8000-000000000215', 'de360000-0000-4000-8000-000000000105', 'de360000-0000-4000-8000-000000000010', 'Cabinet — RDC', 'MOZ', '23 avenue Mozart', '75016', 'Paris', 'FR', 48.854500, 2.269700, 'Accueil ouvert à partir de 8 h 30.', 'de360000-0000-4000-8000-000000000205'),
  ('de360000-0000-4000-8000-000000000216', 'de360000-0000-4000-8000-000000000106', 'de360000-0000-4000-8000-000000000010', 'Atelier d’impression', 'IVRY-1', '14 rue Molière', '94200', 'Ivry-sur-Seine', 'FR', 48.811500, 2.387800, 'Badge visiteur et EPI obligatoires.', 'de360000-0000-4000-8000-000000000206');

insert into public.missions (
  id, organization_id, reference, title, description, priority, status,
  assigned_team_id, assigned_user_id, scheduled_start, scheduled_end,
  actual_start, actual_end, location_label, address_line1, postal_code, city,
  country, latitude, longitude, customer_id, site_id, customer_name,
  customer_contact, customer_phone, customer_email, notes, created_by
) values
  ('de360000-0000-4000-8000-000000000301', 'de360000-0000-4000-8000-000000000010', 'DEMO-360-001', 'Modernisation électrique du Fournil', 'Remplacement du tableau principal, protections différentielles 30 mA, repérage complet des circuits et essais de sécurité.', 'normal', 'closed', 'de360000-0000-4000-8000-000000000021', 'de360000-0000-4000-8000-000000000012', date_trunc('day', now()) - interval '2 days' + interval '8 hours', date_trunc('day', now()) - interval '2 days' + interval '17 hours', date_trunc('day', now()) - interval '2 days' + interval '8 hours 10 minutes', date_trunc('day', now()) - interval '2 days' + interval '16 hours 20 minutes', 'Boulangerie et fournil', '48 rue de Belleville', '75020', 'Paris', 'FR', 48.872100, 2.380500, 'de360000-0000-4000-8000-000000000101', 'de360000-0000-4000-8000-000000000211', 'Le Fournil de Belleville', 'Nadia Belkacem', '06 12 45 78 90', current_setting('rezo360.demo.portal_email'), 'Coupure générale autorisée à partir de 8 h.', 'de360000-0000-4000-8000-000000000001'),
  ('de360000-0000-4000-8000-000000000302', 'de360000-0000-4000-8000-000000000010', 'DEMO-360-002', 'Mise en conformité des parties communes', 'Remplacement des blocs de secours et ajout de détecteurs de présence.', 'normal', 'submitted', 'de360000-0000-4000-8000-000000000022', 'de360000-0000-4000-8000-000000000013', date_trunc('day', now()) - interval '1 day' + interval '8 hours 30 minutes', date_trunc('day', now()) - interval '1 day' + interval '16 hours', date_trunc('day', now()) - interval '1 day' + interval '8 hours 42 minutes', date_trunc('day', now()) - interval '1 day' + interval '15 hours 35 minutes', 'Bâtiment A', '12 rue des Lilas', '75019', 'Paris', 'FR', 48.877600, 2.389800, 'de360000-0000-4000-8000-000000000102', 'de360000-0000-4000-8000-000000000212', 'Résidence Les Lilas', 'Marc Lefebvre', '01 42 40 77 31', 'marc.lefebvre@les-lilas.example', null, 'de360000-0000-4000-8000-000000000001'),
  ('de360000-0000-4000-8000-000000000303', 'de360000-0000-4000-8000-000000000010', 'DEMO-360-003', 'Dépannage coupure en cuisine', 'Recherche du défaut d’isolement sur le circuit cuisson.', 'urgent', 'in_progress', 'de360000-0000-4000-8000-000000000023', 'de360000-0000-4000-8000-000000000012', date_trunc('day', now()) + interval '9 hours', date_trunc('day', now()) + interval '11 hours', date_trunc('day', now()) + interval '9 hours 8 minutes', null, 'Restaurant', '96 rue d’Alésia', '75014', 'Paris', 'FR', 48.828300, 2.322000, 'de360000-0000-4000-8000-000000000104', 'de360000-0000-4000-8000-000000000214', 'La Table d’Alésia', 'Julien Moreau', '06 77 30 12 84', 'julien@table-alesia.example', 'Priorité au maintien de la chambre froide.', 'de360000-0000-4000-8000-000000000001'),
  ('de360000-0000-4000-8000-000000000304', 'de360000-0000-4000-8000-000000000010', 'DEMO-360-004', 'Installation électrique du cabinet', 'Création des circuits spécialisés et réseau RJ45.', 'high', 'accepted', 'de360000-0000-4000-8000-000000000022', 'de360000-0000-4000-8000-000000000013', date_trunc('day', now()) + interval '1 day 8 hours', date_trunc('day', now()) + interval '1 day 17 hours', null, null, 'Cabinet — RDC', '23 avenue Mozart', '75016', 'Paris', 'FR', 48.854500, 2.269700, 'de360000-0000-4000-8000-000000000105', 'de360000-0000-4000-8000-000000000215', 'Cabinet dentaire Morel', 'Sophie Morel', '06 64 21 05 47', 'sophie@morel.example', null, 'de360000-0000-4000-8000-000000000001'),
  ('de360000-0000-4000-8000-000000000305', 'de360000-0000-4000-8000-000000000010', 'DEMO-360-005', 'Maintenance annuelle du TGBT', 'Thermographie, resserrage et test des différentiels.', 'normal', 'assigned', 'de360000-0000-4000-8000-000000000021', 'de360000-0000-4000-8000-000000000012', date_trunc('day', now()) + interval '2 days 7 hours', date_trunc('day', now()) + interval '2 days 12 hours', null, null, 'Atelier d’impression', '14 rue Molière', '94200', 'Ivry-sur-Seine', 'FR', 48.811500, 2.387800, 'de360000-0000-4000-8000-000000000106', 'de360000-0000-4000-8000-000000000216', 'Novaprint', 'Karim Haddad', '06 09 88 41 23', 'karim@novaprint.example', 'Coupure production validée de 7 h à 9 h.', 'de360000-0000-4000-8000-000000000001'),
  ('de360000-0000-4000-8000-000000000306', 'de360000-0000-4000-8000-000000000010', 'DEMO-360-006', 'Éclairage extérieur du parking', 'Remplacement de douze candélabres par des têtes LED.', 'normal', 'draft', null, null, date_trunc('day', now()) + interval '3 days 8 hours', date_trunc('day', now()) + interval '3 days 17 hours', null, null, 'Parking Hôtel de Ville', '1 place Jean Jaurès', '93100', 'Montreuil', 'FR', 48.862000, 2.441600, 'de360000-0000-4000-8000-000000000103', 'de360000-0000-4000-8000-000000000213', 'Mairie de Montreuil', 'Thomas Nguyen', '01 48 70 61 22', 'thomas.nguyen@montreuil.example', 'En attente du bon de commande fictif.', 'de360000-0000-4000-8000-000000000001'),
  ('de360000-0000-4000-8000-000000000307', 'de360000-0000-4000-8000-000000000010', 'DEMO-360-007', 'Visite technique extension du fournil', 'Étude de puissance pour un second four de 18 kW.', 'low', 'assigned', 'de360000-0000-4000-8000-000000000021', 'de360000-0000-4000-8000-000000000013', date_trunc('day', now()) + interval '4 days 14 hours', date_trunc('day', now()) + interval '4 days 15 hours 30 minutes', null, null, 'Boulangerie et fournil', '48 rue de Belleville', '75020', 'Paris', 'FR', 48.872100, 2.380500, 'de360000-0000-4000-8000-000000000101', 'de360000-0000-4000-8000-000000000211', 'Le Fournil de Belleville', 'Nadia Belkacem', '06 12 45 78 90', current_setting('rezo360.demo.portal_email'), null, 'de360000-0000-4000-8000-000000000001'),
  ('de360000-0000-4000-8000-000000000308', 'de360000-0000-4000-8000-000000000010', 'DEMO-360-008', 'Vidéophonie bâtiment A', 'Pose de la platine de rue et de 28 moniteurs.', 'normal', 'assigned', 'de360000-0000-4000-8000-000000000022', 'de360000-0000-4000-8000-000000000012', date_trunc('day', now()) + interval '6 days 8 hours', date_trunc('day', now()) + interval '7 days 17 hours', null, null, 'Bâtiment A', '12 rue des Lilas', '75019', 'Paris', 'FR', 48.877600, 2.389800, 'de360000-0000-4000-8000-000000000102', 'de360000-0000-4000-8000-000000000212', 'Résidence Les Lilas', 'Marc Lefebvre', '01 42 40 77 31', 'marc.lefebvre@les-lilas.example', null, 'de360000-0000-4000-8000-000000000001'),
  ('de360000-0000-4000-8000-000000000309', 'de360000-0000-4000-8000-000000000010', 'DEMO-360-009', 'Contrôle du tableau divisionnaire', 'Mesures, contrôle visuel et rapport de conformité.', 'normal', 'completed', 'de360000-0000-4000-8000-000000000021', 'de360000-0000-4000-8000-000000000013', date_trunc('day', now()) - interval '5 days' + interval '9 hours', date_trunc('day', now()) - interval '5 days' + interval '12 hours', date_trunc('day', now()) - interval '5 days' + interval '9 hours 5 minutes', date_trunc('day', now()) - interval '5 days' + interval '11 hours 45 minutes', 'Cabinet — RDC', '23 avenue Mozart', '75016', 'Paris', 'FR', 48.854500, 2.269700, 'de360000-0000-4000-8000-000000000105', 'de360000-0000-4000-8000-000000000215', 'Cabinet dentaire Morel', 'Sophie Morel', '06 64 21 05 47', 'sophie@morel.example', null, 'de360000-0000-4000-8000-000000000001'),
  ('de360000-0000-4000-8000-000000000310', 'de360000-0000-4000-8000-000000000010', 'DEMO-360-010', 'Ajout d’une borne de recharge', 'Ligne dédiée 32 A et borne murale 7,4 kW.', 'normal', 'accepted', 'de360000-0000-4000-8000-000000000021', 'de360000-0000-4000-8000-000000000012', date_trunc('day', now()) + interval '8 days 9 hours', date_trunc('day', now()) + interval '8 days 13 hours', null, null, 'Boulangerie et fournil', '48 rue de Belleville', '75020', 'Paris', 'FR', 48.872100, 2.380500, 'de360000-0000-4000-8000-000000000101', 'de360000-0000-4000-8000-000000000211', 'Le Fournil de Belleville', 'Nadia Belkacem', '06 12 45 78 90', current_setting('rezo360.demo.portal_email'), null, 'de360000-0000-4000-8000-000000000001');

insert into public.mission_assignments (
  mission_id, team_id, member_id, assigned_by, assigned_at, accepted_at
)
select
  m.id,
  m.assigned_team_id,
  m.assigned_user_id,
  'de360000-0000-4000-8000-000000000001',
  coalesce(m.scheduled_start, now()) - interval '2 days',
  case when m.status in ('accepted', 'in_progress', 'completed', 'submitted', 'approved', 'closed')
    then coalesce(m.scheduled_start, now()) - interval '1 day'
    else null end
from public.missions m
where m.organization_id = 'de360000-0000-4000-8000-000000000010'
  and (m.assigned_team_id is not null or m.assigned_user_id is not null);

insert into public.interventions (
  id, mission_id, organization_id, technician_id, status, start_time, end_time, notes
) values
  ('de360000-0000-4000-8000-000000000601', 'de360000-0000-4000-8000-000000000301', 'de360000-0000-4000-8000-000000000010', 'de360000-0000-4000-8000-000000000012', 'completed', date_trunc('day', now()) - interval '2 days' + interval '8 hours 10 minutes', date_trunc('day', now()) - interval '2 days' + interval '16 hours 20 minutes', 'Installation testée, tableau étiqueté et zone remise en service.'),
  ('de360000-0000-4000-8000-000000000602', 'de360000-0000-4000-8000-000000000302', 'de360000-0000-4000-8000-000000000010', 'de360000-0000-4000-8000-000000000013', 'completed', date_trunc('day', now()) - interval '1 day' + interval '8 hours 42 minutes', date_trunc('day', now()) - interval '1 day' + interval '15 hours 35 minutes', 'Compte rendu transmis au responsable.');

-- Le trigger de pointage interdit à juste titre tout antidatage par le client.
-- Le préparateur staging, connecté directement à PostgreSQL, désactive donc les
-- triggers uniquement autour de ces six lignes fictives et dans la transaction.
set local session_replication_role = replica;
insert into public.intervention_time_entries (
  id, intervention_id, organization_id, technician_id, technician_user_id,
  kind, started_at, ended_at, reason
) values
  ('de360000-0000-4000-8000-000000000631', 'de360000-0000-4000-8000-000000000601', 'de360000-0000-4000-8000-000000000010', 'de360000-0000-4000-8000-000000000012', 'de360000-0000-4000-8000-000000000003', 'work', date_trunc('day', now()) - interval '2 days' + interval '8 hours 10 minutes', date_trunc('day', now()) - interval '2 days' + interval '11 hours 55 minutes', null),
  ('de360000-0000-4000-8000-000000000632', 'de360000-0000-4000-8000-000000000601', 'de360000-0000-4000-8000-000000000010', 'de360000-0000-4000-8000-000000000012', 'de360000-0000-4000-8000-000000000003', 'pause', date_trunc('day', now()) - interval '2 days' + interval '11 hours 55 minutes', date_trunc('day', now()) - interval '2 days' + interval '12 hours 35 minutes', 'Pause déjeuner'),
  ('de360000-0000-4000-8000-000000000633', 'de360000-0000-4000-8000-000000000601', 'de360000-0000-4000-8000-000000000010', 'de360000-0000-4000-8000-000000000012', 'de360000-0000-4000-8000-000000000003', 'work', date_trunc('day', now()) - interval '2 days' + interval '12 hours 35 minutes', date_trunc('day', now()) - interval '2 days' + interval '16 hours 20 minutes', null),
  ('de360000-0000-4000-8000-000000000634', 'de360000-0000-4000-8000-000000000602', 'de360000-0000-4000-8000-000000000010', 'de360000-0000-4000-8000-000000000013', 'de360000-0000-4000-8000-000000000004', 'work', date_trunc('day', now()) - interval '1 day' + interval '8 hours 42 minutes', date_trunc('day', now()) - interval '1 day' + interval '12 hours', null),
  ('de360000-0000-4000-8000-000000000635', 'de360000-0000-4000-8000-000000000602', 'de360000-0000-4000-8000-000000000010', 'de360000-0000-4000-8000-000000000013', 'de360000-0000-4000-8000-000000000004', 'pause', date_trunc('day', now()) - interval '1 day' + interval '12 hours', date_trunc('day', now()) - interval '1 day' + interval '12 hours 35 minutes', 'Pause'),
  ('de360000-0000-4000-8000-000000000636', 'de360000-0000-4000-8000-000000000602', 'de360000-0000-4000-8000-000000000010', 'de360000-0000-4000-8000-000000000013', 'de360000-0000-4000-8000-000000000004', 'work', date_trunc('day', now()) - interval '1 day' + interval '12 hours 35 minutes', date_trunc('day', now()) - interval '1 day' + interval '15 hours 35 minutes', null);
set local session_replication_role = origin;

insert into public.intervention_reports (
  id, intervention_id, organization_id, technician_id, work_description,
  observations, materials_used, tools_used, customer_signature_path,
  customer_signature_name, technician_signature_path, status, submitted_at,
  reviewed_at, reviewed_by
) values
  ('de360000-0000-4000-8000-000000000611', 'de360000-0000-4000-8000-000000000601', 'de360000-0000-4000-8000-000000000010', 'de360000-0000-4000-8000-000000000012', 'Dépose de l’ancien tableau, pose d’un coffret quatre rangées, raccordement de trois différentiels 30 mA et de dix-huit départs. Repérage des circuits, mesure de terre et essais fonctionnels réalisés.', 'Installation conforme. Valeur de terre mesurée à 18 Ω. Prévoir une vérification annuelle du serrage des borniers.', '[{"name":"Tableau 4 rangées","quantity":1,"unit":"unité"},{"name":"Disjoncteurs modulaires","quantity":18,"unit":"unités"}]'::jsonb, '["VAT", "Multimètre TRMS", "Testeur différentiel"]'::jsonb, current_setting('rezo360.demo.signature_client'), 'Nadia Belkacem', current_setting('rezo360.demo.signature_technician'), 'approved', now() - interval '2 days' + interval '16 hours 35 minutes', now() - interval '1 day 18 hours', (select id from public.organization_members where organization_id = 'de360000-0000-4000-8000-000000000010' and user_id = 'de360000-0000-4000-8000-000000000001')),
  ('de360000-0000-4000-8000-000000000612', 'de360000-0000-4000-8000-000000000602', 'de360000-0000-4000-8000-000000000010', 'de360000-0000-4000-8000-000000000013', 'Remplacement des blocs de secours défaillants et ajout de détecteurs de présence dans les circulations.', 'Essais d’autonomie réalisés. Dossier prêt pour contrôle.', '[]'::jsonb, '["Multimètre", "Escabeau isolé"]'::jsonb, null, null, null, 'submitted', now() - interval '20 hours', null, null);

insert into public.intervention_attachments (
  id, intervention_id, organization_id, kind, storage_path, file_name,
  caption, uploaded_by, shared_with_client, shared_at, shared_by
) values
  ('de360000-0000-4000-8000-000000000621', 'de360000-0000-4000-8000-000000000601', 'de360000-0000-4000-8000-000000000010', 'before', 'de360000-0000-4000-8000-000000000010/de360000-0000-4000-8000-000000000301/de360000-0000-4000-8000-000000000601/photo-before.png', 'photo-before.png', 'État initial du tableau', 'de360000-0000-4000-8000-000000000003', true, now() - interval '1 day', 'de360000-0000-4000-8000-000000000001'),
  ('de360000-0000-4000-8000-000000000622', 'de360000-0000-4000-8000-000000000601', 'de360000-0000-4000-8000-000000000010', 'document', 'de360000-0000-4000-8000-000000000010/de360000-0000-4000-8000-000000000301/de360000-0000-4000-8000-000000000601/photo-progress.png', 'photo-progress.png', 'Raccordement en cours', 'de360000-0000-4000-8000-000000000003', true, now() - interval '1 day', 'de360000-0000-4000-8000-000000000001'),
  ('de360000-0000-4000-8000-000000000623', 'de360000-0000-4000-8000-000000000601', 'de360000-0000-4000-8000-000000000010', 'after', 'de360000-0000-4000-8000-000000000010/de360000-0000-4000-8000-000000000301/de360000-0000-4000-8000-000000000601/photo-after.png', 'photo-after.png', 'Installation terminée et repérée', 'de360000-0000-4000-8000-000000000003', true, now() - interval '1 day', 'de360000-0000-4000-8000-000000000001'),
  ('de360000-0000-4000-8000-000000000624', 'de360000-0000-4000-8000-000000000601', 'de360000-0000-4000-8000-000000000010', 'proof', 'de360000-0000-4000-8000-000000000010/de360000-0000-4000-8000-000000000301/de360000-0000-4000-8000-000000000601/test-report.png', 'test-report.png', 'Résultats des contrôles', 'de360000-0000-4000-8000-000000000003', true, now() - interval '1 day', 'de360000-0000-4000-8000-000000000001');

insert into public.quotes (
  id, organization_id, reference, title, customer_id, site_id, customer_name,
  site_name, vat_rate, status, notes, valid_until, client_responded_at,
  created_by, created_at
) values
  ('de360000-0000-4000-8000-000000000401', 'de360000-0000-4000-8000-000000000010', 'DEV-DEMO-001', 'Modernisation électrique du Fournil', 'de360000-0000-4000-8000-000000000101', 'de360000-0000-4000-8000-000000000211', 'Le Fournil de Belleville', 'Boulangerie et fournil', 20, 'accepted', 'Intervention planifiée pendant le jour de fermeture.', current_date + 30, now() - interval '6 days', 'de360000-0000-4000-8000-000000000001', now() - interval '12 days'),
  ('de360000-0000-4000-8000-000000000402', 'de360000-0000-4000-8000-000000000010', 'DEV-DEMO-002', 'Vidéophonie bâtiment A', 'de360000-0000-4000-8000-000000000102', 'de360000-0000-4000-8000-000000000212', 'Résidence Les Lilas', 'Bâtiment A', 10, 'sent', 'Présentation lors de la prochaine assemblée.', current_date + 45, null, 'de360000-0000-4000-8000-000000000001', now() - interval '4 days');

insert into public.quote_items (
  quote_id, organization_id, description, unit, quantity, unit_price_cents, position
) values
  ('de360000-0000-4000-8000-000000000401', 'de360000-0000-4000-8000-000000000010', 'Tableau quatre rangées pré-équipé', 'Unité', 1, 38900, 0),
  ('de360000-0000-4000-8000-000000000401', 'de360000-0000-4000-8000-000000000010', 'Protections différentielles et disjoncteurs', 'Forfait', 1, 45520, 1),
  ('de360000-0000-4000-8000-000000000401', 'de360000-0000-4000-8000-000000000010', 'Main-d’œuvre, repérage et essais', 'Heure', 8, 6800, 2),
  ('de360000-0000-4000-8000-000000000402', 'de360000-0000-4000-8000-000000000010', 'Platine vidéo et alimentation', 'Unité', 1, 124000, 0),
  ('de360000-0000-4000-8000-000000000402', 'de360000-0000-4000-8000-000000000010', 'Moniteurs intérieurs couleur', 'Unité', 28, 18900, 1);

insert into public.stock_consumables (
  id, organization_id, reference, name, category, unit, quantity_in_stock,
  min_threshold, unit_price_eur, selling_price_eur, location, supplier, notes
) values
  ('de360000-0000-4000-8000-000000000801', 'de360000-0000-4000-8000-000000000010', 'DJ-16A', 'Disjoncteur 16 A courbe C', 'Protection', 'pièce', 42, 12, 8.90, 14.90, 'Dépôt A · Bac 12', 'Rexel', null),
  ('de360000-0000-4000-8000-000000000802', 'de360000-0000-4000-8000-000000000010', 'ID-40A-A', 'Interrupteur différentiel 40 A type A', 'Protection', 'pièce', 9, 4, 62.50, 89.00, 'Dépôt A · Bac 08', 'Sonepar', null),
  ('de360000-0000-4000-8000-000000000803', 'de360000-0000-4000-8000-000000000010', 'CABLE-3G25', 'Câble R2V 3G2,5 mm²', 'Câblage', 'mètre', 185, 80, 1.85, 3.20, 'Dépôt B · Touret 03', 'Rexel', null),
  ('de360000-0000-4000-8000-000000000804', 'de360000-0000-4000-8000-000000000010', 'BAES-LED', 'Bloc autonome de sécurité LED', 'Éclairage', 'pièce', 3, 6, 48.00, 72.00, 'Dépôt A · Étagère 4', 'Legrand', 'Sous le seuil — réassort prévu.'),
  ('de360000-0000-4000-8000-000000000805', 'de360000-0000-4000-8000-000000000010', 'DALLE-LED', 'Dalle LED 600×600 UGR<19', 'Éclairage', 'pièce', 28, 10, 54.00, 79.00, 'Dépôt C · Rack 02', 'Sylvania', null),
  ('de360000-0000-4000-8000-000000000806', 'de360000-0000-4000-8000-000000000010', 'PRISE-RJ45', 'Prise RJ45 catégorie 6', 'Réseau', 'pièce', 36, 15, 12.50, 24.00, 'Dépôt A · Bac 22', 'Schneider', null),
  ('de360000-0000-4000-8000-000000000807', 'de360000-0000-4000-8000-000000000010', 'BORNE-74', 'Borne de recharge 7,4 kW', 'Mobilité', 'pièce', 2, 2, 690.00, 990.00, 'Dépôt C · Zone sécurisée', 'Hager', 'Réservation chantier requise.'),
  ('de360000-0000-4000-8000-000000000808', 'de360000-0000-4000-8000-000000000010', 'CONTACT-25A', 'Contacteur triphasé 25 A', 'Commande', 'pièce', 7, 3, 42.00, 68.00, 'Véhicule 12 · Bac 4', 'Rexel', null),
  ('de360000-0000-4000-8000-000000000809', 'de360000-0000-4000-8000-000000000010', 'WAGO-221', 'Bornes de connexion 3 entrées', 'Connexion', 'boîte', 14, 5, 18.90, 29.00, 'Dépôt A · Bac 01', 'Wago', null),
  ('de360000-0000-4000-8000-000000000810', 'de360000-0000-4000-8000-000000000010', 'GAINE-20', 'Gaine ICTA diamètre 20', 'Câblage', 'mètre', 240, 100, 0.52, 1.20, 'Dépôt B · Couronne 07', 'Courant', null);

insert into public.stock_movements (
  id, organization_id, consumable_id, consumable_name, consumable_reference,
  type, quantity, reason, technician_id, technician_name, intervention_ref,
  location_from, location_to, occurred_at
) values
  ('de360000-0000-4000-8000-000000000821', 'de360000-0000-4000-8000-000000000010', 'de360000-0000-4000-8000-000000000801', 'Disjoncteur 16 A courbe C', 'DJ-16A', 'out', 8, 'Modernisation du Fournil', 'de360000-0000-4000-8000-000000000012', 'Alex Martin', 'DEMO-360-001', 'Dépôt A', 'Chantier Belleville', now() - interval '2 days'),
  ('de360000-0000-4000-8000-000000000822', 'de360000-0000-4000-8000-000000000010', 'de360000-0000-4000-8000-000000000804', 'Bloc autonome de sécurité LED', 'BAES-LED', 'out', 6, 'Résidence Les Lilas', 'de360000-0000-4000-8000-000000000013', 'Léa Robert', 'DEMO-360-002', 'Dépôt A', 'Chantier Les Lilas', now() - interval '1 day'),
  ('de360000-0000-4000-8000-000000000823', 'de360000-0000-4000-8000-000000000010', 'de360000-0000-4000-8000-000000000803', 'Câble R2V 3G2,5 mm²', 'CABLE-3G25', 'in', 100, 'Réception fournisseur', null, null, null, 'Rexel', 'Dépôt B', now() - interval '4 days');

insert into public.client_portal_settings (
  organization_id, enabled, allow_client_initiated, display_name,
  visible_document_categories, updated_by
) values (
  'de360000-0000-4000-8000-000000000010',
  true,
  true,
  'HBG Labs — Suivi client',
  array['Contrats'],
  'de360000-0000-4000-8000-000000000001'
);

insert into public.invoices (
  id, organization_id, title, customer_id, site_id, quote_id, customer_name,
  customer_legal_name, customer_registration_number, customer_vat_number,
  customer_address_line1, customer_postal_code, customer_city, customer_country,
  customer_type, site_name, service_date, operation_type, due_date,
  payment_terms, payment_method, early_payment_terms, late_payment_terms,
  vat_on_debits, notes, created_by
) values (
  'de360000-0000-4000-8000-000000000701',
  'de360000-0000-4000-8000-000000000010',
  'Modernisation électrique du Fournil',
  'de360000-0000-4000-8000-000000000101',
  'de360000-0000-4000-8000-000000000211',
  'de360000-0000-4000-8000-000000000401',
  'Le Fournil de Belleville',
  'SARL Le Fournil de Belleville',
  '81234567800016',
  'FR44812345678',
  '48 rue de Belleville',
  '75020',
  'Paris',
  'FR',
  'company',
  'Boulangerie et fournil',
  current_date - 2,
  'mixed',
  current_date + 30,
  'Paiement à 30 jours date de facture.',
  'Virement bancaire',
  'Pas d’escompte pour paiement anticipé.',
  'Pénalités au taux légal et indemnité forfaitaire de 40 €.',
  true,
  'Merci pour votre confiance.',
  'de360000-0000-4000-8000-000000000001'
);

insert into public.invoice_items (
  id, invoice_id, organization_id, description, unit, quantity,
  unit_price_cents, vat_rate, vat_category, position
) values
  ('de360000-0000-4000-8000-000000000711', 'de360000-0000-4000-8000-000000000701', 'de360000-0000-4000-8000-000000000010', 'Tableau quatre rangées pré-équipé', 'Unité', 1, 38900, 20, 'S', 0),
  ('de360000-0000-4000-8000-000000000712', 'de360000-0000-4000-8000-000000000701', 'de360000-0000-4000-8000-000000000010', 'Protections différentielles et disjoncteurs', 'Forfait', 1, 45520, 20, 'S', 1),
  ('de360000-0000-4000-8000-000000000713', 'de360000-0000-4000-8000-000000000701', 'de360000-0000-4000-8000-000000000010', 'Main-d’œuvre, repérage et essais', 'Heure', 8, 6800, 20, 'S', 2);

update public.invoices
set status = 'issued'
where id = 'de360000-0000-4000-8000-000000000701';
update public.invoices
set status = 'paid'
where id = 'de360000-0000-4000-8000-000000000701';

insert into public.organization_documents (
  id, organization_id, name, original_filename, storage_path, description,
  category, shared_with_client, uploaded_by
) values (
  'de360000-0000-4000-8000-000000000951',
  'de360000-0000-4000-8000-000000000010',
  'Contrat de maintenance électrique',
  'contrat-maintenance.png',
  'de360000-0000-4000-8000-000000000010/portal/contrat-maintenance.png',
  'Contrat fictif partagé avec le client pour la démonstration.',
  'Contrats',
  true,
  'de360000-0000-4000-8000-000000000001'
);

insert into public.client_conversations (
  id, organization_id, customer_id, contact_id, subject, status,
  initiated_by, mission_id, quote_id, invoice_id, last_message_at, created_by
) values
  ('de360000-0000-4000-8000-000000000901', 'de360000-0000-4000-8000-000000000010', 'de360000-0000-4000-8000-000000000101', 'de360000-0000-4000-8000-000000000201', 'Préparation de l’intervention', 'open', 'organization', 'de360000-0000-4000-8000-000000000301', 'de360000-0000-4000-8000-000000000401', null, now() - interval '3 days', 'de360000-0000-4000-8000-000000000001'),
  ('de360000-0000-4000-8000-000000000902', 'de360000-0000-4000-8000-000000000010', 'de360000-0000-4000-8000-000000000101', 'de360000-0000-4000-8000-000000000201', 'Facture et procès-verbal', 'open', 'organization', 'de360000-0000-4000-8000-000000000301', null, 'de360000-0000-4000-8000-000000000701', now() - interval '12 hours', 'de360000-0000-4000-8000-000000000001');

-- Les messages historiques sont normalement écrits par le service d'envoi ou
-- son webhook. La transaction de préparation prend ce même contexte explicite
-- afin de conserver les triggers métier et d'audit.
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

insert into public.client_messages (
  id, organization_id, conversation_id, direction, channel, author_user_id,
  sender_email, recipient_email, subject, body_text, status, sent_at,
  received_at, read_by_client_at, read_by_staff_at, created_at
) values
  ('de360000-0000-4000-8000-000000000911', 'de360000-0000-4000-8000-000000000010', 'de360000-0000-4000-8000-000000000901', 'outbound', 'portal', 'de360000-0000-4000-8000-000000000001', 'contact@hbg-labs.fr', current_setting('rezo360.demo.portal_email'), 'Préparation de l’intervention', 'Bonjour Nadia, l’équipe interviendra mardi à partir de 8 h. La coupure générale est prévue pendant la dépose du tableau.', 'sent', now() - interval '5 days', null, now() - interval '4 days', null, now() - interval '5 days'),
  ('de360000-0000-4000-8000-000000000912', 'de360000-0000-4000-8000-000000000010', 'de360000-0000-4000-8000-000000000901', 'inbound', 'portal', null, current_setting('rezo360.demo.portal_email'), 'contact@hbg-labs.fr', 'Préparation de l’intervention', 'Merci, l’accès par la cour sera ouvert. Le fournil sera disponible toute la journée.', 'received', null, now() - interval '4 days', null, now() - interval '4 days', now() - interval '4 days'),
  ('de360000-0000-4000-8000-000000000913', 'de360000-0000-4000-8000-000000000010', 'de360000-0000-4000-8000-000000000902', 'outbound', 'portal', 'de360000-0000-4000-8000-000000000001', 'contact@hbg-labs.fr', current_setting('rezo360.demo.portal_email'), 'Facture et procès-verbal', 'Les travaux sont terminés. Le compte rendu validé et la facture sont disponibles dans votre espace client.', 'sent', now() - interval '12 hours', null, null, null, now() - interval '12 hours'),
  ('de360000-0000-4000-8000-000000000914', 'de360000-0000-4000-8000-000000000010', 'de360000-0000-4000-8000-000000000902', 'inbound', 'portal', null, current_setting('rezo360.demo.portal_email'), 'contact@hbg-labs.fr', 'Facture et procès-verbal', 'Parfait, merci à toute l’équipe.', 'received', null, now() - interval '8 hours', null, now() - interval '8 hours', now() - interval '8 hours');

do $$
declare
  v_owner_count integer;
begin
  select count(*) into v_owner_count
  from public.organization_members
  where organization_id = 'de360000-0000-4000-8000-000000000010'
    and role = 'owner' and status = 'active';
  if v_owner_count <> 1 then
    raise exception 'Vérification finale : propriétaire actif absent ou ambigu.';
  end if;
  if (select count(*) from public.missions where organization_id = 'de360000-0000-4000-8000-000000000010') <> 10 then
    raise exception 'Vérification finale : dix missions attendues.';
  end if;
  if (select count(*) from public.intervention_time_entries where intervention_id = 'de360000-0000-4000-8000-000000000601' and ended_at is not null) <> 3 then
    raise exception 'Vérification finale : relevé du temps incomplet.';
  end if;
  if (select status from public.invoices where id = 'de360000-0000-4000-8000-000000000701') <> 'paid' then
    raise exception 'Vérification finale : facture non payée.';
  end if;
end
$$;
