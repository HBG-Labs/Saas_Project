-- =============================================================================
-- Personnalisation des conditions de paiement affichées sur les devis
-- =============================================================================
--
-- Jusqu'ici « Conditions de règlement » et « Mode de paiement » étaient un
-- texte en dur dans QuotesPage.tsx et QuoteDetailPage.tsx, identique pour
-- toutes les organisations quel que soit leur délai de paiement réel ou leurs
-- moyens de règlement acceptés. Les deux colonnes sont nullables : une
-- organisation qui ne les renseigne pas continue de voir le texte par défaut
-- actuel, géré côté client — pas de migration de données nécessaire.
-- =============================================================================

alter table public.organizations
  add column if not exists quote_payment_terms text,
  add column if not exists quote_payment_method text;

comment on column public.organizations.quote_payment_terms is
  'Conditions de règlement affichées sur les devis (ex. délai de paiement). NULL = texte par défaut côté client.';
comment on column public.organizations.quote_payment_method is
  'Moyens de paiement acceptés, affichés sur les devis. NULL = texte par défaut côté client.';
