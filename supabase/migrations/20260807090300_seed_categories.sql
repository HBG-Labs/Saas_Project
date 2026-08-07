-- =============================================================================
-- Amorçage des catégories
-- =============================================================================
-- Les quatre catégories correspondent exactement à TOOL_CATEGORIES dans
-- src/features/tools/registry/types.ts. Toute divergence casserait la
-- réconciliation entre le catalogue et le registry.
--
-- Aucun outil n'est amorcé : aucun n'est encore implémenté.
-- =============================================================================

insert into public.categories (slug, name, description, icon, sort_order) values
  ('fiber-optics', 'Fibre optique', 'Codes couleur, bilans de liaison, atténuation, conversions dBm/mW.', 'cable',       10),
  ('networking',   'Réseaux',       'IPv4, CIDR, sous-réseaux, masques, plages d''adresses.',                'network',     20),
  ('electrical',   'Électricité',   'Loi d''Ohm, puissance, tension, courant, résistance.',                  'zap',         30),
  ('general',      'Calculs généraux', 'Pourcentages, conversions d''unités, temps, distances, dB.',         'calculator',  40)
on conflict (slug) do nothing;
