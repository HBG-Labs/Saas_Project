-- =============================================================================
-- Assistant IA — usage réservé au propriétaire
-- =============================================================================
--
-- Décision produit du 02/09/2026 : contrairement au choix initial (ouvert à
-- tous les rôles, le frein étant le quota du plan), l'usage de l'Assistant IA
-- est réservé au propriétaire. `ai.manage_documents` (owner/admin/manager)
-- n'est PAS touchée : administrer la bibliothèque documentaire reste une
-- capacité distincte d'interroger l'assistant soi-même.
--
-- Retrait ciblé par rôle, pas par permission entière : contrairement au
-- retrait complet du suivi GPS (`20260817100000_retire_live_tracking.sql`,
-- `delete ... where permission = 'X'`, qui vide la permission pour TOUS les
-- rôles), ici `owner` doit conserver sa ligne. D'où la condition composite
-- `role <> 'owner'`.
delete from public.role_permissions
where permission = 'ai.use'
  and role <> 'owner';
