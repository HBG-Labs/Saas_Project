-- =============================================================================
-- Les pièces jointes rejoignent la formule Pro
-- =============================================================================
--
-- Décision explicite de l'éditeur, le 02/09/2026 : l'ajout de photos et
-- documents aux interventions ne reste plus réservé à Business et
-- Enterprise, il doit être disponible dès Pro.
--
-- Ce qui a motivé la mesure qui précède cette décision : `AttachmentGallery`
-- affichait les cinq boutons d'ajout à toute organisation ayant accès à une
-- intervention, sans jamais vérifier `app.org_has_feature(org_id,
-- 'attachments')` — la policy `intervention_attachments_upload` l'exige
-- pourtant. Un compte Pro cliquait, choisissait une photo, et recevait un
-- rejet RLS brut. Le correctif applicatif (`hasAttachmentsFeature`, dans
-- `AttachmentGallery.tsx`) ferme ce malentendu quelle que soit la formule ;
-- cette migration change la formule elle-même, sur demande.
-- =============================================================================

insert into public.plan_features (plan_code, feature_key, limit_value)
values ('pro', 'attachments', null)
on conflict (plan_code, feature_key) do update set limit_value = excluded.limit_value;
