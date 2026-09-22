-- Retour arrière manuel de 20261013090000.
-- Le bucket peut déjà contenir des logos : on retire seulement les policies
-- ajoutées par la migration, sans supprimer les fichiers de l'entreprise.
drop policy if exists organization_branding_upload on storage.objects;
drop policy if exists organization_branding_delete on storage.objects;
