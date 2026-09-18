-- Index manquants sur organization_id, relevés à la relecture de la migration
-- précédente (20260926090000) plutôt que par les advisors (MCP Supabase
-- déconnecté dans cette session) — même type d'anomalie déjà rencontrée et
-- corrigée en Phase 13 de Prospect Radar (20260925100000).

create index received_invoice_events_organization_idx
  on public.received_invoice_events (organization_id);

create index received_invoice_documents_organization_idx
  on public.received_invoice_documents (organization_id);
