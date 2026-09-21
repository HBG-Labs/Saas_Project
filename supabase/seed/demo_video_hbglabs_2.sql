-- Données fictives (2e volet) — organisation HBG Labs (hbtech)
-- Collaborateurs, équipes, véhicules, équipements, fournisseurs, stock, commandes,
-- clients supplémentaires, congés, tâches récurrentes.
-- UUID fixes préfixés a11ce000- : rejouable, et retirable via le bloc NETTOYAGE.
--   06xx = auth.users   07xx = organization_members   08xx = teams
--   0axx = vehicles     0bxx = equipment              0cxx = suppliers
--   0dxx = stock        0exx = stock_movements        0fxx = purchase_orders
--   011x/021x/051x = clients / sites / contacts supplémentaires
begin;

-- ---------------------------------------------------------------- NETTOYAGE
delete from recurring_tasks where id::text like 'a11ce000-0000-4000-8000-00000000c1%';
delete from leave_requests where id::text like 'a11ce000-0000-4000-8000-00000000c2%';
delete from leave_balances where member_id::text like 'a11ce000-0000-4000-8000-0000000007%';
delete from purchase_order_items where purchase_order_id::text like 'a11ce000-0000-4000-8000-000000000f%';
delete from purchase_orders where id::text like 'a11ce000-0000-4000-8000-000000000f%';
delete from stock_movements where id::text like 'a11ce000-0000-4000-8000-000000000e%';
delete from stock_consumables where id::text like 'a11ce000-0000-4000-8000-000000000d%';
delete from suppliers where id::text like 'a11ce000-0000-4000-8000-000000000c%';
delete from equipment where id::text like 'a11ce000-0000-4000-8000-000000000b%';
delete from vehicle_maintenance_records where vehicle_id::text like 'a11ce000-0000-4000-8000-000000000a%';
delete from vehicles where id::text like 'a11ce000-0000-4000-8000-000000000a%';
delete from team_members where team_id::text like 'a11ce000-0000-4000-8000-0000000008%';
update missions set assigned_team_id = null where assigned_team_id::text like 'a11ce000-0000-4000-8000-0000000008%';
delete from teams where id::text like 'a11ce000-0000-4000-8000-0000000008%';
-- Les missions confiées aux collaborateurs fictifs reviennent au propriétaire.
update missions set assigned_user_id = '62c91864-ac4b-4d52-80d9-1e1601141577'
  where assigned_user_id::text like 'a11ce000-0000-4000-8000-0000000007%';
update mission_assignments set member_id = '62c91864-ac4b-4d52-80d9-1e1601141577'
  where member_id::text like 'a11ce000-0000-4000-8000-0000000007%';
delete from organization_members where id::text like 'a11ce000-0000-4000-8000-0000000007%';
delete from auth.users where id::text like 'a11ce000-0000-4000-8000-0000000006%';
delete from sites where id::text like 'a11ce000-0000-4000-8000-00000000021%';
delete from customer_contacts where id::text like 'a11ce000-0000-4000-8000-00000000051%';
delete from customers where id::text like 'a11ce000-0000-4000-8000-00000000011%';

-- ---------------------------------------------------------------- COMPTES
-- Même fabrique que supabase/seed/demo_accounts.sql, avec un identifiant imposé.
create or replace function pg_temp.demo_user(p_id uuid, p_email text, p_name text)
returns void language plpgsql as $fn$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated',
    p_email, extensions.crypt('Rezo360!2026', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('display_name', p_name, 'email_verified', true),
    now(), now(), '', '', '', ''
  );
  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (p_id::text, p_id,
    jsonb_build_object('sub', p_id::text, 'email', p_email, 'email_verified', true, 'phone_verified', false),
    'email', now(), now(), now());
end;
$fn$;

select pg_temp.demo_user('a11ce000-0000-4000-8000-000000000601','lucas.martin@rezo360.test','Lucas MARTIN');
select pg_temp.demo_user('a11ce000-0000-4000-8000-000000000602','amine.benali@rezo360.test','Amine BENALI');
select pg_temp.demo_user('a11ce000-0000-4000-8000-000000000603','thomas.girard@rezo360.test','Thomas GIRARD');
select pg_temp.demo_user('a11ce000-0000-4000-8000-000000000604','sarah.dupont@rezo360.test','Sarah DUPONT');
select pg_temp.demo_user('a11ce000-0000-4000-8000-000000000605','mehdi.kaci@rezo360.test','Mehdi KACI');
select pg_temp.demo_user('a11ce000-0000-4000-8000-000000000606','elodie.renard@rezo360.test','Élodie RENARD');
select pg_temp.demo_user('a11ce000-0000-4000-8000-000000000607','hugo.lemaire@rezo360.test','Hugo LEMAIRE');

insert into organization_members (id, organization_id, user_id, role, status, job_title, phone, invited_by, joined_at) values
('a11ce000-0000-4000-8000-000000000701','05462413-8379-4094-a803-a18d90eaf5e2','a11ce000-0000-4000-8000-000000000601','team_leader','active','Chef d''équipe électricien','06 11 22 33 01','cf7e7290-deec-4d4b-b526-c105451e6f97','2024-03-04'),
('a11ce000-0000-4000-8000-000000000702','05462413-8379-4094-a803-a18d90eaf5e2','a11ce000-0000-4000-8000-000000000602','technician','active','Électricien N3','06 11 22 33 02','cf7e7290-deec-4d4b-b526-c105451e6f97','2024-09-16'),
('a11ce000-0000-4000-8000-000000000703','05462413-8379-4094-a803-a18d90eaf5e2','a11ce000-0000-4000-8000-000000000603','technician','active','Électricien N2','06 11 22 33 03','cf7e7290-deec-4d4b-b526-c105451e6f97','2025-02-03'),
('a11ce000-0000-4000-8000-000000000704','05462413-8379-4094-a803-a18d90eaf5e2','a11ce000-0000-4000-8000-000000000604','team_leader','active','Cheffe d''équipe — tertiaire','06 11 22 33 04','cf7e7290-deec-4d4b-b526-c105451e6f97','2023-06-12'),
('a11ce000-0000-4000-8000-000000000705','05462413-8379-4094-a803-a18d90eaf5e2','a11ce000-0000-4000-8000-000000000605','technician','active','Électricien dépanneur','06 11 22 33 05','cf7e7290-deec-4d4b-b526-c105451e6f97','2025-11-03'),
('a11ce000-0000-4000-8000-000000000706','05462413-8379-4094-a803-a18d90eaf5e2','a11ce000-0000-4000-8000-000000000606','manager','active','Responsable planification','01 44 55 66 06','cf7e7290-deec-4d4b-b526-c105451e6f97','2024-01-08'),
('a11ce000-0000-4000-8000-000000000707','05462413-8379-4094-a803-a18d90eaf5e2','a11ce000-0000-4000-8000-000000000607','employee','active','Magasinier','01 44 55 66 07','cf7e7290-deec-4d4b-b526-c105451e6f97','2026-04-01');

-- ---------------------------------------------------------------- ÉQUIPES
insert into teams (id, organization_id, name, slug, description, color, manager_id, created_by) values
('a11ce000-0000-4000-8000-000000000801','05462413-8379-4094-a803-a18d90eaf5e2','Équipe Nord-Est','nord-est','Paris 10e-20e, Pantin, Montreuil, Saint-Ouen. Installation et rénovation.','#2563eb','a11ce000-0000-4000-8000-000000000701','cf7e7290-deec-4d4b-b526-c105451e6f97'),
('a11ce000-0000-4000-8000-000000000802','05462413-8379-4094-a803-a18d90eaf5e2','Équipe Ouest & Sud','ouest-sud','Paris 13e-16e, Boulogne, Ivry. Tertiaire et maintenance.','#16a34a','a11ce000-0000-4000-8000-000000000704','cf7e7290-deec-4d4b-b526-c105451e6f97'),
('a11ce000-0000-4000-8000-000000000803','05462413-8379-4094-a803-a18d90eaf5e2','Astreinte dépannage','astreinte','Roulement hebdomadaire, intervention sous 4 h.','#dc2626','a11ce000-0000-4000-8000-000000000701','cf7e7290-deec-4d4b-b526-c105451e6f97');

insert into team_members (team_id, member_id, role, joined_at) values
('a11ce000-0000-4000-8000-000000000801','a11ce000-0000-4000-8000-000000000701','lead','2024-03-04'),
('a11ce000-0000-4000-8000-000000000801','a11ce000-0000-4000-8000-000000000702','member','2024-09-16'),
('a11ce000-0000-4000-8000-000000000801','a11ce000-0000-4000-8000-000000000703','member','2025-02-03'),
('a11ce000-0000-4000-8000-000000000802','a11ce000-0000-4000-8000-000000000704','lead','2023-06-12'),
('a11ce000-0000-4000-8000-000000000802','a11ce000-0000-4000-8000-000000000705','member','2025-11-03'),
('a11ce000-0000-4000-8000-000000000802','4cb3d417-50fa-4fab-a94a-113d7835fd8b','member','2026-09-14'),
('a11ce000-0000-4000-8000-000000000803','a11ce000-0000-4000-8000-000000000701','lead','2024-03-04'),
('a11ce000-0000-4000-8000-000000000803','a11ce000-0000-4000-8000-000000000705','member','2025-11-03'),
('a11ce000-0000-4000-8000-000000000803','a11ce000-0000-4000-8000-000000000702','member','2025-01-06');

-- Répartition des missions existantes sur les nouveaux collaborateurs.
update missions set assigned_user_id = 'a11ce000-0000-4000-8000-000000000701', assigned_team_id = 'a11ce000-0000-4000-8000-000000000801' where id = 'a11ce000-0000-4000-8000-000000000305'; -- LED école Pantin
update missions set assigned_user_id = 'a11ce000-0000-4000-8000-000000000702', assigned_team_id = 'a11ce000-0000-4000-8000-000000000801' where id = 'a11ce000-0000-4000-8000-000000000302'; -- blocs de secours Lilas
update missions set assigned_user_id = 'a11ce000-0000-4000-8000-000000000705', assigned_team_id = 'a11ce000-0000-4000-8000-000000000803' where id in ('a11ce000-0000-4000-8000-000000000304','a11ce000-0000-4000-8000-000000000308'); -- dépannages
update missions set assigned_user_id = 'a11ce000-0000-4000-8000-000000000703', assigned_team_id = 'a11ce000-0000-4000-8000-000000000802' where id = 'a11ce000-0000-4000-8000-000000000307'; -- cabinet dentaire
update missions set assigned_user_id = 'a11ce000-0000-4000-8000-000000000704', assigned_team_id = 'a11ce000-0000-4000-8000-000000000802' where id = 'a11ce000-0000-4000-8000-000000000309'; -- TGBT Novaprint
update missions set assigned_user_id = 'a11ce000-0000-4000-8000-000000000703', assigned_team_id = 'a11ce000-0000-4000-8000-000000000802' where id = 'a11ce000-0000-4000-8000-000000000303'; -- borne VE
update missions set assigned_user_id = 'a11ce000-0000-4000-8000-000000000702', assigned_team_id = 'a11ce000-0000-4000-8000-000000000801' where id = 'a11ce000-0000-4000-8000-000000000306'; -- diagnostic Fontaine
update mission_assignments ma set member_id = m.assigned_user_id
  from missions m where m.id = ma.mission_id and m.id::text like 'a11ce000-0000-4000-8000-0000000003%' and m.assigned_user_id is not null;

-- ---------------------------------------------------------------- VÉHICULES
insert into vehicles (id, organization_id, plate, brand, model, type, fuel, status, mileage, assigned_member_id, next_ct_date, next_revision_date, next_revision_mileage, insurance_expiry_date, notes, created_by) values
('a11ce000-0000-4000-8000-000000000a01','05462413-8379-4094-a803-a18d90eaf5e2','GH-482-KL','Renault','Trafic L2H1','van','diesel','in_service',87420,'a11ce000-0000-4000-8000-000000000701','2027-03-15','2026-11-20',95000,'2027-01-31','Aménagement Sortimo, galerie de toit.','cf7e7290-deec-4d4b-b526-c105451e6f97'),
('a11ce000-0000-4000-8000-000000000a02','05462413-8379-4094-a803-a18d90eaf5e2','GK-117-RS','Peugeot','Expert Standard','van','diesel','in_service',64210,'a11ce000-0000-4000-8000-000000000704','2027-08-02','2026-09-25',65000,'2027-01-31','Révision à planifier — 800 km avant l''échéance.','cf7e7290-deec-4d4b-b526-c105451e6f97'),
('a11ce000-0000-4000-8000-000000000a03','05462413-8379-4094-a803-a18d90eaf5e2','FX-903-MB','Citroën','Berlingo Van','utility','diesel','in_service',131850,'a11ce000-0000-4000-8000-000000000702','2026-10-04','2027-02-10',140000,'2027-01-31','Contrôle technique dans 3 semaines.','cf7e7290-deec-4d4b-b526-c105451e6f97'),
('a11ce000-0000-4000-8000-000000000a04','05462413-8379-4094-a803-a18d90eaf5e2','GT-256-AE','Renault','Kangoo E-Tech','utility','electric','in_service',18930,'a11ce000-0000-4000-8000-000000000703','2029-05-12','2027-05-12',40000,'2027-01-31','Recharge au dépôt d''Ivry chaque soir.','cf7e7290-deec-4d4b-b526-c105451e6f97'),
('a11ce000-0000-4000-8000-000000000a05','05462413-8379-4094-a803-a18d90eaf5e2','GC-778-ZT','Renault','Master L3H2','van','diesel','maintenance',156700,null,'2026-12-18','2026-09-14',155000,'2027-01-31','Au garage : embrayage. Retour prévu jeudi 17/09.','cf7e7290-deec-4d4b-b526-c105451e6f97'),
('a11ce000-0000-4000-8000-000000000a06','05462413-8379-4094-a803-a18d90eaf5e2','FP-341-QN','Ford','Transit Custom','van','diesel','in_service',98115,'a11ce000-0000-4000-8000-000000000705','2027-01-22','2027-01-05',105000,'2027-01-31','Véhicule d''astreinte : gyrophare, stock de dépannage.','cf7e7290-deec-4d4b-b526-c105451e6f97');

insert into vehicle_maintenance_records (vehicle_id, performed_on, type, description, mileage, cost_cents, performed_by, created_by) values
('a11ce000-0000-4000-8000-000000000a01','2026-05-14','revision','Révision 80 000 km, filtres et vidange',80120,42900,'Renault Minute Paris Nation','cf7e7290-deec-4d4b-b526-c105451e6f97'),
('a11ce000-0000-4000-8000-000000000a01','2026-08-03','pneus','4 pneus Michelin Agilis',85900,68400,'Euromaster Pantin','cf7e7290-deec-4d4b-b526-c105451e6f97'),
('a11ce000-0000-4000-8000-000000000a03','2026-02-10','revision','Révision 130 000 km, courroie de distribution',129800,89000,'Garage Auto Rousseau','cf7e7290-deec-4d4b-b526-c105451e6f97'),
('a11ce000-0000-4000-8000-000000000a03','2026-07-21','freins','Plaquettes et disques avant',131000,31500,'Garage Auto Rousseau','cf7e7290-deec-4d4b-b526-c105451e6f97'),
('a11ce000-0000-4000-8000-000000000a05','2026-09-14','reparation','Remplacement embrayage + volant moteur',156700,142000,'Garage Auto Rousseau','cf7e7290-deec-4d4b-b526-c105451e6f97'),
('a11ce000-0000-4000-8000-000000000a06','2026-01-05','controle_technique','Contrôle technique — sans contre-visite',92400,7900,'Autosur Saint-Ouen','cf7e7290-deec-4d4b-b526-c105451e6f97');

-- ---------------------------------------------------------------- ÉQUIPEMENTS
-- Catégories : f7ab01d1 = Contrôle électrique, 0b02992c = Mesure & contrôle,
-- dadf8e1e = Électroportatif, 0c37c34a = Sécurité & EPI, f644a9f2 = Accès & hauteur
insert into equipment (id, organization_id, name, brand, serial_number, category_id, status, condition, assigned_member_id, last_calibration, next_calibration, notes, created_by) values
('a11ce000-0000-4000-8000-000000000b01','05462413-8379-4094-a803-a18d90eaf5e2','Contrôleur d''installation C.A 6116N','Chauvin Arnoux','CA6116-24-08813','f7ab01d1-22ec-4487-b386-65959fe8289f','assigned','bon_etat','a11ce000-0000-4000-8000-000000000701','2026-01-20','2027-01-20','Étalonnage annuel obligatoire (rapports Consuel).','cf7e7290-deec-4d4b-b526-c105451e6f97'),
('a11ce000-0000-4000-8000-000000000b02','05462413-8379-4094-a803-a18d90eaf5e2','Multimètre Fluke 117','Fluke','F117-51230987','0b02992c-fcde-4853-b4a0-de0bdb0aa859','assigned','bon_etat','a11ce000-0000-4000-8000-000000000702','2025-11-05','2026-11-05',null,'cf7e7290-deec-4d4b-b526-c105451e6f97'),
('a11ce000-0000-4000-8000-000000000b03','05462413-8379-4094-a803-a18d90eaf5e2','Pince ampèremétrique Fluke 376 FC','Fluke','F376-44098211','0b02992c-fcde-4853-b4a0-de0bdb0aa859','assigned','neuf','a11ce000-0000-4000-8000-000000000704','2026-06-01','2027-06-01',null,'cf7e7290-deec-4d4b-b526-c105451e6f97'),
('a11ce000-0000-4000-8000-000000000b04','05462413-8379-4094-a803-a18d90eaf5e2','Caméra thermique FLIR E8 Pro','FLIR','E8P-2023-77120','0b02992c-fcde-4853-b4a0-de0bdb0aa859','available','bon_etat',null,'2026-03-12','2027-03-12','Réservée aux maintenances TGBT (thermographie).','cf7e7290-deec-4d4b-b526-c105451e6f97'),
('a11ce000-0000-4000-8000-000000000b05','05462413-8379-4094-a803-a18d90eaf5e2','Perforateur TE 6-A36','Hilti','TE6-A36-0092841','dadf8e1e-a6ce-4c21-83cf-20719f6de491','assigned','bon_etat','a11ce000-0000-4000-8000-000000000703',null,null,'2 batteries 36 V.','cf7e7290-deec-4d4b-b526-c105451e6f97'),
('a11ce000-0000-4000-8000-000000000b06','05462413-8379-4094-a803-a18d90eaf5e2','Harnais antichute + longe','Petzl','PZ-AVAO-2024-118','0c37c34a-dda4-453e-ac3d-c86981378dfd','assigned','a_reviser','a11ce000-0000-4000-8000-000000000705','2025-09-01','2026-09-01','Vérification annuelle dépassée — à faire contrôler avant le chantier parking.','cf7e7290-deec-4d4b-b526-c105451e6f97'),
('a11ce000-0000-4000-8000-000000000b07','05462413-8379-4094-a803-a18d90eaf5e2','Plateforme individuelle roulante 3 m','Tubesca','PIRL-3M-00456','f644a9f2-6c8d-41ef-b607-6f8491c3d472','available','bon_etat',null,null,null,'Au dépôt d''Ivry.','cf7e7290-deec-4d4b-b526-c105451e6f97'),
('a11ce000-0000-4000-8000-000000000b08','05462413-8379-4094-a803-a18d90eaf5e2','VAT Catu CX-30','Catu','CX30-0781233','f7ab01d1-22ec-4487-b386-65959fe8289f','maintenance','a_reviser',null,'2025-04-10','2026-04-10','Renvoyé chez Catu pour vérification.','cf7e7290-deec-4d4b-b526-c105451e6f97');

-- ---------------------------------------------------------------- FOURNISSEURS
insert into suppliers (id, organization_id, name, code, contact_name, email, phone, address, city, postal_code, siret, vat_number, website, default_payment_terms, notes) values
('a11ce000-0000-4000-8000-000000000c01','05462413-8379-4094-a803-a18d90eaf5e2','Rexel — agence Paris Est','REXEL','Damien Roux','paris-est@rexel.fr','01 43 48 90 12','18 rue de la Voûte','Paris','75012','30 913 041 200 018','FR12309130412','https://www.rexel.fr','30 jours fin de mois','Compte pro n° 448120. Livraison J+1 avant 16h.'),
('a11ce000-0000-4000-8000-000000000c02','05462413-8379-4094-a803-a18d90eaf5e2','Sonepar — Ivry','SONEPAR','Nathalie Barbier','ivry@sonepar.fr','01 46 71 22 80','52 avenue de Verdun','Ivry-sur-Seine','94200','585 580 216 000 45','FR58558058021','https://www.sonepar.fr','45 jours','Bon tarif sur le câble et les bornes de recharge.'),
('a11ce000-0000-4000-8000-000000000c03','05462413-8379-4094-a803-a18d90eaf5e2','CGED — Saint-Denis','CGED','Olivier Perrin','saint-denis@cged.fr','01 48 20 17 33','9 rue Ambroise Croizat','Saint-Denis','93200','552 018 300 001 12','FR20552018300','https://www.cged.fr','30 jours','Éclairage LED, appareillage Legrand / Schneider.'),
('a11ce000-0000-4000-8000-000000000c04','05462413-8379-4094-a803-a18d90eaf5e2','Yesss Électrique — Montreuil','YESSS','Sabrina Aouni','montreuil@yesss.fr','01 48 57 41 10','128 rue de Paris','Montreuil','93100','421 776 902 000 87','FR64421776902','https://www.yesss.fr','Comptant','Dépannage : ouvert le samedi matin.'),
('a11ce000-0000-4000-8000-000000000c05','05462413-8379-4094-a803-a18d90eaf5e2','Manutan','MANUTAN','Service pro','pro@manutan.fr','02 51 91 50 00','ZAC du Chemin Vert','Gonesse','95500','662 049 476 000 47','FR07662049476','https://www.manutan.fr','30 jours','EPI, consommables atelier, rayonnages.');

-- ---------------------------------------------------------------- STOCK
insert into stock_consumables (id, organization_id, reference, name, category, unit, quantity_in_stock, min_threshold, unit_price_eur, selling_price_eur, location, supplier, notes) values
('a11ce000-0000-4000-8000-000000000d01','05462413-8379-4094-a803-a18d90eaf5e2','CAB-3G25','Câble U-1000 R2V 3G2,5 mm²','Câbles','m',420,200,1.18,2.40,'Dépôt Ivry — touret A1','Sonepar — Ivry',null),
('a11ce000-0000-4000-8000-000000000d02','05462413-8379-4094-a803-a18d90eaf5e2','CAB-3G15','Câble U-1000 R2V 3G1,5 mm²','Câbles','m',150,200,0.82,1.70,'Dépôt Ivry — touret A2','Sonepar — Ivry','Sous le seuil — à recommander.'),
('a11ce000-0000-4000-8000-000000000d03','05462413-8379-4094-a803-a18d90eaf5e2','CAB-5G6','Câble U-1000 R2V 5G6 mm²','Câbles','m',85,50,4.35,8.20,'Dépôt Ivry — touret B1','Rexel — agence Paris Est',null),
('a11ce000-0000-4000-8000-000000000d04','05462413-8379-4094-a803-a18d90eaf5e2','DISJ-16','Disjoncteur 1P+N 16 A courbe C','Protection','pièce',38,20,8.90,18.00,'Dépôt Ivry — étagère C2','Rexel — agence Paris Est',null),
('a11ce000-0000-4000-8000-000000000d05','05462413-8379-4094-a803-a18d90eaf5e2','DISJ-20','Disjoncteur 1P+N 20 A courbe C','Protection','pièce',12,20,9.40,19.00,'Dépôt Ivry — étagère C2','Rexel — agence Paris Est','Sous le seuil.'),
('a11ce000-0000-4000-8000-000000000d06','05462413-8379-4094-a803-a18d90eaf5e2','ID-40A','Interrupteur différentiel 40 A 30 mA type A','Protection','pièce',9,6,52.00,89.00,'Dépôt Ivry — étagère C3','Rexel — agence Paris Est',null),
('a11ce000-0000-4000-8000-000000000d07','05462413-8379-4094-a803-a18d90eaf5e2','PRISE-16','Prise 2P+T 16 A encastrée, blanc','Appareillage','pièce',96,40,4.10,9.50,'Dépôt Ivry — étagère D1','CGED — Saint-Denis','Gamme Legrand Céliane.'),
('a11ce000-0000-4000-8000-000000000d08','05462413-8379-4094-a803-a18d90eaf5e2','INTER-VV','Interrupteur va-et-vient, blanc','Appareillage','pièce',54,30,3.60,8.50,'Dépôt Ivry — étagère D1','CGED — Saint-Denis',null),
('a11ce000-0000-4000-8000-000000000d09','05462413-8379-4094-a803-a18d90eaf5e2','LED-600','Dalle LED 600×600 36 W 4000 K UGR<19','Éclairage','pièce',22,12,31.50,79.00,'Dépôt Ivry — rayonnage E','CGED — Saint-Denis','48 dalles réservées pour l''école Jules Ferry (livraison partielle).'),
('a11ce000-0000-4000-8000-000000000d10','05462413-8379-4094-a803-a18d90eaf5e2','BAES-45','Bloc autonome d''éclairage de sécurité 45 lm','Éclairage','pièce',6,4,24.00,55.00,'Dépôt Ivry — rayonnage E','Yesss Électrique — Montreuil',null),
('a11ce000-0000-4000-8000-000000000d11','05462413-8379-4094-a803-a18d90eaf5e2','GAINE-20','Gaine ICTA Ø20 (couronne 100 m)','Cheminement','couronne',7,4,28.00,45.00,'Dépôt Ivry — sol zone F','Yesss Électrique — Montreuil',null),
('a11ce000-0000-4000-8000-000000000d12','05462413-8379-4094-a803-a18d90eaf5e2','GOUL-40','Goulotte PVC 40×25 (barre 2 m)','Cheminement','barre',30,20,3.20,7.00,'Dépôt Ivry — sol zone F','Yesss Électrique — Montreuil',null),
('a11ce000-0000-4000-8000-000000000d13','05462413-8379-4094-a803-a18d90eaf5e2','WAGO-221','Bornes Wago 221 — 3 conducteurs (boîte de 50)','Connexion','boîte',11,5,14.50,0,'Camions + étagère D2','Rexel — agence Paris Est','Une boîte par véhicule.'),
('a11ce000-0000-4000-8000-000000000d14','05462413-8379-4094-a803-a18d90eaf5e2','EPI-GANTS','Gants isolants classe 00 (paire)','EPI','paire',3,4,38.00,0,'Armoire EPI','Manutan','Sous le seuil — commande Manutan en cours.');

insert into stock_movements (id, organization_id, consumable_id, consumable_name, consumable_reference, type, quantity, reason, technician_id, technician_name, intervention_ref, location_from, location_to, occurred_at) values
('a11ce000-0000-4000-8000-000000000e01','05462413-8379-4094-a803-a18d90eaf5e2','a11ce000-0000-4000-8000-000000000d06','Interrupteur différentiel 40 A 30 mA type A','ID-40A','in',10,'Réception CMD-2026-001 (Rexel)',null,'Hugo LEMAIRE',null,'Rexel — agence Paris Est','Dépôt Ivry — étagère C3','2026-09-04 09:30+02'),
('a11ce000-0000-4000-8000-000000000e02','05462413-8379-4094-a803-a18d90eaf5e2','a11ce000-0000-4000-8000-000000000d04','Disjoncteur 1P+N 16 A courbe C','DISJ-16','in',30,'Réception CMD-2026-001 (Rexel)',null,'Hugo LEMAIRE',null,'Rexel — agence Paris Est','Dépôt Ivry — étagère C2','2026-09-04 09:30+02'),
('a11ce000-0000-4000-8000-000000000e03','05462413-8379-4094-a803-a18d90eaf5e2','a11ce000-0000-4000-8000-000000000d06','Interrupteur différentiel 40 A 30 mA type A','ID-40A','out',3,'Tableau boulangerie','a11ce000-0000-4000-8000-000000000701','Lucas MARTIN','2026-0002','Dépôt Ivry','GH-482-KL','2026-09-07 07:20+02'),
('a11ce000-0000-4000-8000-000000000e04','05462413-8379-4094-a803-a18d90eaf5e2','a11ce000-0000-4000-8000-000000000d04','Disjoncteur 1P+N 16 A courbe C','DISJ-16','out',12,'Tableau boulangerie','a11ce000-0000-4000-8000-000000000701','Lucas MARTIN','2026-0002','Dépôt Ivry','GH-482-KL','2026-09-07 07:20+02'),
('a11ce000-0000-4000-8000-000000000e05','05462413-8379-4094-a803-a18d90eaf5e2','a11ce000-0000-4000-8000-000000000d10','Bloc autonome d''éclairage de sécurité 45 lm','BAES-45','out',8,'Mise en conformité Résidence Les Lilas','a11ce000-0000-4000-8000-000000000702','Amine BENALI','2026-0003','Dépôt Ivry','FX-903-MB','2026-09-09 07:45+02'),
('a11ce000-0000-4000-8000-000000000e06','05462413-8379-4094-a803-a18d90eaf5e2','a11ce000-0000-4000-8000-000000000d03','Câble U-1000 R2V 5G6 mm²','CAB-5G6','out',18,'Ligne borne de recharge','a11ce000-0000-4000-8000-000000000703','Thomas GIRARD','2026-0004','Dépôt Ivry','GT-256-AE','2026-09-11 08:10+02'),
('a11ce000-0000-4000-8000-000000000e07','05462413-8379-4094-a803-a18d90eaf5e2','a11ce000-0000-4000-8000-000000000d09','Dalle LED 600×600 36 W 4000 K UGR<19','LED-600','in',24,'Réception partielle CMD-2026-003 (CGED) — 24/48',null,'Hugo LEMAIRE',null,'CGED — Saint-Denis','Dépôt Ivry — rayonnage E','2026-09-11 14:00+02'),
('a11ce000-0000-4000-8000-000000000e08','05462413-8379-4094-a803-a18d90eaf5e2','a11ce000-0000-4000-8000-000000000d09','Dalle LED 600×600 36 W 4000 K UGR<19','LED-600','out',24,'Salles 1 à 3 — école Jules Ferry','a11ce000-0000-4000-8000-000000000701','Lucas MARTIN','2026-0006','Dépôt Ivry','GH-482-KL','2026-09-14 07:15+02'),
('a11ce000-0000-4000-8000-000000000e09','05462413-8379-4094-a803-a18d90eaf5e2','a11ce000-0000-4000-8000-000000000d13','Bornes Wago 221 — 3 conducteurs (boîte de 50)','WAGO-221','transfer',1,'Réassort camion astreinte','a11ce000-0000-4000-8000-000000000705','Mehdi KACI',null,'Dépôt Ivry — étagère D2','FP-341-QN','2026-09-12 17:30+02'),
('a11ce000-0000-4000-8000-000000000e10','05462413-8379-4094-a803-a18d90eaf5e2','a11ce000-0000-4000-8000-000000000d02','Câble U-1000 R2V 3G1,5 mm²','CAB-3G15','adjustment',30,'Inventaire : −30 m, touret entamé mal compté',null,'Hugo LEMAIRE',null,null,null,'2026-09-13 11:00+02'),
('a11ce000-0000-4000-8000-000000000e11','05462413-8379-4094-a803-a18d90eaf5e2','a11ce000-0000-4000-8000-000000000d14','Gants isolants classe 00 (paire)','EPI-GANTS','out',1,'Remplacement paire percée','a11ce000-0000-4000-8000-000000000705','Mehdi KACI','2026-0005','Armoire EPI',null,'2026-09-12 08:40+02');

-- ---------------------------------------------------------------- COMMANDES
insert into purchase_orders (id, organization_id, reference, supplier_id, supplier_name, supplier_email, supplier_phone, supplier_address, status, order_date, expected_delivery_date, received_date, mission_id, mission_ref, tax_rate, notes, delivery_notes) values
('a11ce000-0000-4000-8000-000000000f01','05462413-8379-4094-a803-a18d90eaf5e2','CMD-2026-001','a11ce000-0000-4000-8000-000000000c01','Rexel — agence Paris Est','paris-est@rexel.fr','01 43 48 90 12','18 rue de la Voûte, 75012 Paris','received','2026-09-02','2026-09-04','2026-09-04','a11ce000-0000-4000-8000-000000000301','2026-0002',0.2,'Matériel tableau Fournil de Belleville + réassort protections.','Reçu complet, BL 448120-7731.'),
('a11ce000-0000-4000-8000-000000000f02','05462413-8379-4094-a803-a18d90eaf5e2','CMD-2026-002','a11ce000-0000-4000-8000-000000000c02','Sonepar — Ivry','ivry@sonepar.fr','01 46 71 22 80','52 avenue de Verdun, 94200 Ivry-sur-Seine','received','2026-09-05','2026-09-09','2026-09-09','a11ce000-0000-4000-8000-000000000303','2026-0004',0.2,'Borne de recharge Da Silva.',null),
('a11ce000-0000-4000-8000-000000000f03','05462413-8379-4094-a803-a18d90eaf5e2','CMD-2026-003','a11ce000-0000-4000-8000-000000000c03','CGED — Saint-Denis','saint-denis@cged.fr','01 48 20 17 33','9 rue Ambroise Croizat, 93200 Saint-Denis','partially_received','2026-09-08','2026-09-11',null,'a11ce000-0000-4000-8000-000000000305','2026-0006',0.2,'48 dalles LED école Jules Ferry.','24 dalles reçues le 11/09, solde annoncé le 15/09.'),
('a11ce000-0000-4000-8000-000000000f04','05462413-8379-4094-a803-a18d90eaf5e2','CMD-2026-004','a11ce000-0000-4000-8000-000000000c01','Rexel — agence Paris Est','paris-est@rexel.fr','01 43 48 90 12','18 rue de la Voûte, 75012 Paris','sent','2026-09-12','2026-09-15',null,'a11ce000-0000-4000-8000-000000000307','2026-0008',0.2,'Cabinet dentaire Dr Morel — livraison sur chantier.',null),
('a11ce000-0000-4000-8000-000000000f05','05462413-8379-4094-a803-a18d90eaf5e2','CMD-2026-005','a11ce000-0000-4000-8000-000000000c05','Manutan','pro@manutan.fr','02 51 91 50 00','ZAC du Chemin Vert, 95500 Gonesse','sent','2026-09-13','2026-09-18',null,null,null,0.2,'Réassort EPI.',null),
('a11ce000-0000-4000-8000-000000000f06','05462413-8379-4094-a803-a18d90eaf5e2','CMD-2026-006','a11ce000-0000-4000-8000-000000000c04','Yesss Électrique — Montreuil','montreuil@yesss.fr','01 48 57 41 10','128 rue de Paris, 93100 Montreuil','draft','2026-09-14','2026-09-22',null,'a11ce000-0000-4000-8000-000000000310','2026-0011',0.2,'Candélabres parking mairie — en attente du bon de commande client.',null);

insert into purchase_order_items (purchase_order_id, consumable_id, reference, description, unit, quantity_ordered, quantity_received, unit_price_eur, position) values
('a11ce000-0000-4000-8000-000000000f01',null,'TAB-4R','Coffret 4 rangées 13 modules, pré-équipé','pièce',1,1,189.00,0),
('a11ce000-0000-4000-8000-000000000f01','a11ce000-0000-4000-8000-000000000d06','ID-40A','Interrupteur différentiel 40 A 30 mA type A','pièce',10,10,52.00,1),
('a11ce000-0000-4000-8000-000000000f01','a11ce000-0000-4000-8000-000000000d04','DISJ-16','Disjoncteur 1P+N 16 A courbe C','pièce',30,30,8.90,2),
('a11ce000-0000-4000-8000-000000000f02',null,'WB-74','Borne murale 7,4 kW monophasée, prise T2','pièce',1,1,612.00,0),
('a11ce000-0000-4000-8000-000000000f02','a11ce000-0000-4000-8000-000000000d03','CAB-5G6','Câble U-1000 R2V 5G6 mm²','m',50,50,4.35,1),
('a11ce000-0000-4000-8000-000000000f03','a11ce000-0000-4000-8000-000000000d09','LED-600','Dalle LED 600×600 36 W 4000 K UGR<19','pièce',48,24,31.50,0),
('a11ce000-0000-4000-8000-000000000f03',null,'KIT-SUSP','Kit de suspension pour dalle 600×600','pièce',48,24,4.20,1),
('a11ce000-0000-4000-8000-000000000f04',null,'TAB-3R','Coffret 3 rangées 13 modules','pièce',1,0,142.00,0),
('a11ce000-0000-4000-8000-000000000f04','a11ce000-0000-4000-8000-000000000d07','PRISE-16','Prise 2P+T 16 A encastrée, blanc','pièce',30,0,4.10,1),
('a11ce000-0000-4000-8000-000000000f04','a11ce000-0000-4000-8000-000000000d01','CAB-3G25','Câble U-1000 R2V 3G2,5 mm²','m',300,0,1.18,2),
('a11ce000-0000-4000-8000-000000000f04',null,'RJ45-C6','Prise RJ45 cat. 6 + connecteur','pièce',8,0,11.80,3),
('a11ce000-0000-4000-8000-000000000f05','a11ce000-0000-4000-8000-000000000d14','EPI-GANTS','Gants isolants classe 00 (paire)','paire',6,0,38.00,0),
('a11ce000-0000-4000-8000-000000000f05',null,'EPI-LUN','Lunettes de protection incolores','pièce',10,0,4.90,1),
('a11ce000-0000-4000-8000-000000000f06',null,'CAND-LED60','Tête de candélabre LED 60 W, abaissement nocturne','pièce',12,0,318.00,0),
('a11ce000-0000-4000-8000-000000000f06',null,'HORL-ASTRO','Horloge astronomique 2 canaux','pièce',1,0,96.00,1);

-- ---------------------------------------------------------------- CLIENTS SUPPLÉMENTAIRES
insert into customers (id, organization_id, reference, name, legal_name, customer_type, email, phone, address_line1, postal_code, city, notes, created_by) values
('a11ce000-0000-4000-8000-000000000111','05462413-8379-4094-a803-a18d90eaf5e2','CLI-0012','Pharmacie de la Gare','SELARL Pharmacie de la Gare','company','pharmacie.gare.vincennes@gmail.com','01 43 28 04 61','2 avenue de Paris','94300','Vincennes','Enseigne lumineuse et chambre froide médicaments.','cf7e7290-deec-4d4b-b526-c105451e6f97'),
('a11ce000-0000-4000-8000-000000000112','05462413-8379-4094-a803-a18d90eaf5e2','CLI-0013','Hôtel Le Marais','SAS Hôtellerie du Marais','company','direction@hotel-lemarais.fr','01 42 72 31 90','15 rue des Archives','75003','Paris','36 chambres. Interventions de nuit possibles (22h-6h).','cf7e7290-deec-4d4b-b526-c105451e6f97'),
('a11ce000-0000-4000-8000-000000000113','05462413-8379-4094-a803-a18d90eaf5e2','CLI-0014','SCI Les Tilleuls','SCI Les Tilleuls','company','sci.lestilleuls@free.fr','06 14 72 90 33','28 avenue du Bac','94210','Saint-Maur-des-Fossés','Bailleur : 6 logements. Compteurs individuels.','cf7e7290-deec-4d4b-b526-c105451e6f97'),
('a11ce000-0000-4000-8000-000000000114','05462413-8379-4094-a803-a18d90eaf5e2','CLI-0015','Bernard Lopez',null,'individual','bernard.lopez@laposte.net','06 33 81 47 26','19 rue du Général Leclerc','94000','Créteil','Maison des années 70, installation d''origine.','cf7e7290-deec-4d4b-b526-c105451e6f97'),
('a11ce000-0000-4000-8000-000000000115','05462413-8379-4094-a803-a18d90eaf5e2','CLI-0016','Crèche Les Petits Pas — Ville de Bagnolet','Commune de Bagnolet','public_body','petite-enfance@ville-bagnolet.fr','01 49 93 60 00','5 rue Sadi Carnot','93170','Bagnolet','Établissement recevant du public : vérification périodique obligatoire.','cf7e7290-deec-4d4b-b526-c105451e6f97');

insert into customer_contacts (id, customer_id, organization_id, first_name, last_name, role_label, email, phone, is_primary) values
('a11ce000-0000-4000-8000-000000000511','a11ce000-0000-4000-8000-000000000111','05462413-8379-4094-a803-a18d90eaf5e2','Hélène','Vasseur','Pharmacienne titulaire','pharmacie.gare.vincennes@gmail.com','06 27 55 18 64',true),
('a11ce000-0000-4000-8000-000000000512','a11ce000-0000-4000-8000-000000000112','05462413-8379-4094-a803-a18d90eaf5e2','Antoine','Garnier','Directeur','a.garnier@hotel-lemarais.fr','06 45 90 27 13',true),
('a11ce000-0000-4000-8000-000000000513','a11ce000-0000-4000-8000-000000000113','05462413-8379-4094-a803-a18d90eaf5e2','Michel','Tissot','Gérant','sci.lestilleuls@free.fr','06 14 72 90 33',true),
('a11ce000-0000-4000-8000-000000000514','a11ce000-0000-4000-8000-000000000114','05462413-8379-4094-a803-a18d90eaf5e2','Bernard','Lopez','Propriétaire','bernard.lopez@laposte.net','06 33 81 47 26',true),
('a11ce000-0000-4000-8000-000000000515','a11ce000-0000-4000-8000-000000000115','05462413-8379-4094-a803-a18d90eaf5e2','Fatou','Diallo','Directrice de crèche','f.diallo@ville-bagnolet.fr','01 49 93 61 45',true);

insert into sites (id, customer_id, organization_id, name, code, address_line1, postal_code, city, latitude, longitude, access_notes, contact_id) values
('a11ce000-0000-4000-8000-000000000211','a11ce000-0000-4000-8000-000000000111','05462413-8379-4094-a803-a18d90eaf5e2','Officine','VIN','2 avenue de Paris','94300','Vincennes',48.8467,2.4322,'Local technique derrière le comptoir.','a11ce000-0000-4000-8000-000000000511'),
('a11ce000-0000-4000-8000-000000000212','a11ce000-0000-4000-8000-000000000112','05462413-8379-4094-a803-a18d90eaf5e2','Hôtel','MAR','15 rue des Archives','75003','Paris',48.8586,2.3555,'Se présenter à la réception. TGBT au sous-sol -1.','a11ce000-0000-4000-8000-000000000512'),
('a11ce000-0000-4000-8000-000000000213','a11ce000-0000-4000-8000-000000000113','05462413-8379-4094-a803-a18d90eaf5e2','Immeuble 28 av. du Bac','TIL','28 avenue du Bac','94210','Saint-Maur-des-Fossés',48.8005,2.4790,'Clés chez le gérant, prévenir 48 h avant.','a11ce000-0000-4000-8000-000000000513'),
('a11ce000-0000-4000-8000-000000000214','a11ce000-0000-4000-8000-000000000114','05462413-8379-4094-a803-a18d90eaf5e2','Maison',null,'19 rue du Général Leclerc','94000','Créteil',48.7907,2.4553,null,'a11ce000-0000-4000-8000-000000000514'),
('a11ce000-0000-4000-8000-000000000215','a11ce000-0000-4000-8000-000000000115','05462413-8379-4094-a803-a18d90eaf5e2','Crèche','BAG','5 rue Sadi Carnot','93170','Bagnolet',48.8693,2.4180,'Intervention après 18h30 ou le samedi.','a11ce000-0000-4000-8000-000000000515');

-- ---------------------------------------------------------------- CONGÉS
insert into leave_balances (organization_id, member_id, year, paid_leave_acquired, rtt_acquired, recovery_hours) values
('05462413-8379-4094-a803-a18d90eaf5e2','a11ce000-0000-4000-8000-000000000701',2026,25,10,6),
('05462413-8379-4094-a803-a18d90eaf5e2','a11ce000-0000-4000-8000-000000000702',2026,25,10,0),
('05462413-8379-4094-a803-a18d90eaf5e2','a11ce000-0000-4000-8000-000000000703',2026,25,10,3.5),
('05462413-8379-4094-a803-a18d90eaf5e2','a11ce000-0000-4000-8000-000000000704',2026,25,10,0),
('05462413-8379-4094-a803-a18d90eaf5e2','a11ce000-0000-4000-8000-000000000705',2026,20,8,12),
('05462413-8379-4094-a803-a18d90eaf5e2','a11ce000-0000-4000-8000-000000000706',2026,25,10,0),
('05462413-8379-4094-a803-a18d90eaf5e2','a11ce000-0000-4000-8000-000000000707',2026,12,4,0);

-- Le trigger de décision exige un acteur authentifié (auteur ou décideur) :
-- hors session utilisateur, on le coupe le temps de poser demandes et décisions.
alter table leave_requests disable trigger leave_requests_decision;
insert into leave_requests (id, organization_id, member_id, type, start_date, end_date, days_count, reason, status, requested_at) values
('a11ce000-0000-4000-8000-00000000c201','05462413-8379-4094-a803-a18d90eaf5e2','a11ce000-0000-4000-8000-000000000702','paid_leave','2026-09-21','2026-09-25',5,'Vacances','pending','2026-08-18 09:12+02'),
('a11ce000-0000-4000-8000-00000000c202','05462413-8379-4094-a803-a18d90eaf5e2','a11ce000-0000-4000-8000-000000000703','rtt','2026-09-18','2026-09-18',1,null,'pending','2026-09-13 18:05+02'),
('a11ce000-0000-4000-8000-00000000c203','05462413-8379-4094-a803-a18d90eaf5e2','a11ce000-0000-4000-8000-000000000705','recovery','2026-09-16','2026-09-16',0.5,'Récupération astreinte du 05/09','pending','2026-09-10 08:40+02'),
('a11ce000-0000-4000-8000-00000000c204','05462413-8379-4094-a803-a18d90eaf5e2','a11ce000-0000-4000-8000-000000000704','paid_leave','2026-10-26','2026-10-30',5,'Vacances de la Toussaint','pending','2026-09-14 07:55+02'),
('a11ce000-0000-4000-8000-00000000c205','05462413-8379-4094-a803-a18d90eaf5e2','a11ce000-0000-4000-8000-000000000701','sick_leave','2026-09-02','2026-09-03',2,'Arrêt maladie','pending','2026-09-02 07:30+02');

update leave_requests set status='approved', reviewed_by='cf7e7290-deec-4d4b-b526-c105451e6f97', reviewed_at='2026-08-18 14:30+02' where id='a11ce000-0000-4000-8000-00000000c201';
update leave_requests set status='approved', reviewed_by='cf7e7290-deec-4d4b-b526-c105451e6f97', reviewed_at='2026-09-10 11:00+02', review_note='OK, après-midi.' where id='a11ce000-0000-4000-8000-00000000c203';
update leave_requests set status='approved', reviewed_by='cf7e7290-deec-4d4b-b526-c105451e6f97', reviewed_at='2026-09-02 08:00+02' where id='a11ce000-0000-4000-8000-00000000c205';
alter table leave_requests enable trigger leave_requests_decision;

-- ---------------------------------------------------------------- TÂCHES RÉCURRENTES
-- intervention_type_id volontairement nul : app.enforce_recurring_task_refs
-- refuse les types « general » (contrairement aux missions).
insert into recurring_tasks (id, organization_id, title, frequency, next_date, customer_id, site_id, assigned_member_id, intervention_type_id, estimated_minutes, notes, is_active, created_by) values
('a11ce000-0000-4000-8000-00000000c101','05462413-8379-4094-a803-a18d90eaf5e2','Maintenance annuelle TGBT — Novaprint','yearly','2027-09-18','a11ce000-0000-4000-8000-000000000107','a11ce000-0000-4000-8000-000000000207','a11ce000-0000-4000-8000-000000000704',null,300,'Contrat n° NOVA-2024-07. Thermographie + rapport.',true,'cf7e7290-deec-4d4b-b526-c105451e6f97'),
('a11ce000-0000-4000-8000-00000000c102','05462413-8379-4094-a803-a18d90eaf5e2','Vérification blocs de secours — Résidence Les Lilas','bi_annual','2027-03-09','a11ce000-0000-4000-8000-000000000102','a11ce000-0000-4000-8000-000000000202','a11ce000-0000-4000-8000-000000000702',null,120,'Test d''autonomie 1 h, registre de sécurité à viser.',true,'cf7e7290-deec-4d4b-b526-c105451e6f97'),
('a11ce000-0000-4000-8000-00000000c103','05462413-8379-4094-a803-a18d90eaf5e2','Vérification périodique ERP — Crèche Les Petits Pas','yearly','2026-10-10','a11ce000-0000-4000-8000-000000000115','a11ce000-0000-4000-8000-000000000215','a11ce000-0000-4000-8000-000000000701',null,180,'Le samedi. Rapport à transmettre à la commission de sécurité.',true,'cf7e7290-deec-4d4b-b526-c105451e6f97'),
('a11ce000-0000-4000-8000-00000000c104','05462413-8379-4094-a803-a18d90eaf5e2','Contrôle mensuel groupe froid — Pharmacie de la Gare','monthly','2026-10-01','a11ce000-0000-4000-8000-000000000111','a11ce000-0000-4000-8000-000000000211','a11ce000-0000-4000-8000-000000000705',null,45,'Relevé des températures et test de l''alarme.',true,'cf7e7290-deec-4d4b-b526-c105451e6f97'),
('a11ce000-0000-4000-8000-00000000c105','05462413-8379-4094-a803-a18d90eaf5e2','Entretien éclairage de sécurité — Hôtel Le Marais','quarterly','2026-12-15','a11ce000-0000-4000-8000-000000000112','a11ce000-0000-4000-8000-000000000212','a11ce000-0000-4000-8000-000000000703',null,90,null,false,'cf7e7290-deec-4d4b-b526-c105451e6f97');

commit;
