-- =============================================================================
-- Prospect Radar — Phase 13 (audit) : index manquants sur clés étrangères
-- =============================================================================
--
-- Relevé par `mcp__supabase__get_advisors` (performance, « Unindexed Foreign
-- Keys ») : aucune de ces FK n'a d'index couvrant. Sans conséquence mesurable
-- au volume actuel, mais chaque jointure/CASCADE dessus fera un scan complet
-- de la table référencée à mesure que le volume grandit — corrigé
-- maintenant plutôt que d'attendre un ralentissement réel.
-- =============================================================================

create index if not exists prospect_activities_actor_id_idx
  on public.prospect_activities (actor_id);

create index if not exists prospect_followups_created_by_idx
  on public.prospect_followups (created_by);

create index if not exists prospect_notes_author_id_idx
  on public.prospect_notes (author_id);

create index if not exists prospect_suppressions_created_by_idx
  on public.prospect_suppressions (created_by);

create index if not exists prospecting_message_templates_sector_id_idx
  on public.prospecting_message_templates (sector_id);

create index if not exists prospecting_sectors_industry_code_idx
  on public.prospecting_sectors (industry_code);

create index if not exists prospecting_sync_cursors_sector_id_idx
  on public.prospecting_sync_cursors (sector_id);
