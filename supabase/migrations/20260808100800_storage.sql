-- =============================================================================
-- Storage — pièces jointes des interventions
-- =============================================================================
-- Le §11 demande que le backend soit PRÊT pour les photos avant/après, les
-- documents et les preuves d'intervention, sans exiger l'interface dès
-- maintenant. C'est ce que fait cette migration : le bucket et ses règles
-- existent, le frontend s'y branchera quand il sera écrit.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- LA CONVENTION DE CHEMIN EST LA SÉCURITÉ
--
--     {organization_id}/{mission_id}/{intervention_id}/{uuid}-{nom}
--     └────────┬───────┘
--        seul segment que les policies inspectent
--
-- `storage.objects` ne connaît ni les missions ni les organisations : il n'a
-- que le nom de l'objet. Placer l'organisation en PREMIER segment permet de
-- décider l'accès sans jointure. C'est aussi pourquoi le trigger
-- `enforce_attachment_org` refuse tout enregistrement dont le chemin ne
-- commence pas par la bonne organisation : un fichier mal préfixé serait
-- soit orphelin, soit rattaché au mauvais tenant.
-- ─────────────────────────────────────────────────────────────────────────────
-- =============================================================================

-- Bucket PRIVÉ. Un bucket public rendrait chaque photo accessible à qui
-- connaît l'URL — y compris les photos de sites clients et les signatures.
-- L'accès se fera par URL signée, à durée limitée.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'intervention-attachments',
  'intervention-attachments',
  false,
  20971520,  -- 20 Mio : une photo de chantier haute définition passe, une vidéo non
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic',
    'application/pdf',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- -----------------------------------------------------------------------------
-- Policies
-- -----------------------------------------------------------------------------
-- `storage.foldername(name)` découpe le chemin ; `[1]` est le premier segment,
-- donc l'organisation. Le cast en uuid échoue proprement sur un chemin malformé,
-- ce qui refuse l'accès plutôt que de l'accorder par défaut.

drop policy if exists "intervention_attachments_read" on storage.objects;
create policy "intervention_attachments_read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'intervention-attachments'
    and (storage.foldername(name))[1] in (
      select org_id::text from app.my_organization_ids() as org_id
    )
  );

drop policy if exists "intervention_attachments_upload" on storage.objects;
create policy "intervention_attachments_upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'intervention-attachments'
    and (storage.foldername(name))[1] in (
      select org_id::text from app.my_organization_ids() as org_id
    )
    -- L'abonnement conditionne le dépôt : sans la fonctionnalité `attachments`,
    -- le stockage n'est pas ouvert. Sans ce contrôle, une entreprise en plan
    -- gratuit pourrait déposer sans limite.
    and (select app.org_has_feature(((storage.foldername(name))[1])::uuid, 'attachments'))
  );

-- Pas de policy UPDATE : un fichier de preuve ne se remplace pas en place.
-- Une correction passe par un nouveau dépôt, ce qui conserve l'original.

drop policy if exists "intervention_attachments_delete" on storage.objects;
create policy "intervention_attachments_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'intervention-attachments'
    and (
      owner_id = (select auth.uid())::text
      or (select app.has_org_permission(((storage.foldername(name))[1])::uuid, 'intervention.review'))
    )
  );
