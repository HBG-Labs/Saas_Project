/**
 * Catalogue explicite des connaissances métier accessibles à l'Assistant IA.
 *
 * Cette liste sert à la fois au chargement ciblé du contexte, au filtrage des
 * actions et à l'audit de couverture. Ajouter une table au produit sans la
 * déclarer ici fait échouer le test de couverture associé.
 */

export type AiDomainKey =
  | 'organization'
  | 'profile'
  | 'subscription'
  | 'members'
  | 'teams'
  | 'customers'
  | 'missions'
  | 'interventions'
  | 'planning'
  | 'stock'
  | 'equipment'
  | 'vehicles'
  | 'purchases'
  | 'quotes'
  | 'invoices'
  | 'einvoicing'
  | 'general_documents'
  | 'ai_documents'
  | 'notes'
  | 'analytics'
  | 'audit'
  | 'notifications'
  | 'catalog'
  | 'personal_history'
  | 'training'
  | 'support'
  | 'conversations'
  | 'industry_forms';

export interface AiKnowledgeDomain {
  key: AiDomainKey;
  label: string;
  keywords: readonly string[];
  tables: readonly string[];
  permission?: string;
  feature?: string;
  route?: string;
  actionType?: string;
  /** Données limitées au compte connecté, même quand la clé de service est utilisée. */
  userScoped?: boolean;
  /** Domaine volontairement décrit mais non injecté dans le prompt métier. */
  informationalOnly?: boolean;
}

export const AI_KNOWLEDGE_DOMAINS: readonly AiKnowledgeDomain[] = [
  {
    key: 'organization',
    label: 'Organisation, identité légale et paramètres',
    keywords: ['organisation', 'entreprise', 'siret', 'tva', 'iban', 'adresse', 'secteur', 'métier'],
    tables: ['organizations', 'industries'],
    permission: 'organization.view',
    route: '/organisation',
  },
  {
    key: 'profile',
    label: 'Profil personnel',
    keywords: ['profil', 'mon téléphone', 'mes certifications', 'ma zone'],
    tables: ['profiles', 'profile_details'],
    route: '/profile',
    userScoped: true,
  },
  {
    key: 'subscription',
    label: 'Abonnement, fonctionnalités et quotas',
    keywords: ['abonnement', 'formule', 'quota', 'facturation abonnement', 'starter', 'business', 'enterprise'],
    tables: ['subscriptions', 'plans', 'plan_features'],
    permission: 'billing.view',
    route: '/organisation/facturation',
    actionType: 'view_billing',
  },
  {
    key: 'members',
    label: 'Membres, rôles, permissions et invitations',
    keywords: ['membre', 'technicien', 'collaborateur', 'salarié', 'rôle', 'permission', 'invitation'],
    tables: ['organization_members', 'organization_invitations', 'profiles', 'role_permissions'],
    permission: 'member.view',
    route: '/organisation/membres',
    actionType: 'view_members',
  },
  {
    key: 'teams',
    label: 'Équipes et affectations',
    keywords: ['équipe', 'equipe', 'chef équipe', 'team'],
    tables: ['teams', 'team_members'],
    permission: 'team.view',
    feature: 'teams',
    route: '/equipes',
    actionType: 'view_teams',
  },
  {
    key: 'customers',
    label: 'Clients, contacts, sites et consignes d’accès',
    keywords: ['client', 'contact', 'site', 'adresse client', 'consigne', 'donneur ordre'],
    tables: ['customers', 'customer_contacts', 'sites'],
    permission: 'customer.view',
    feature: 'customers',
    route: '/clients',
    actionType: 'view_customers',
  },
  {
    key: 'missions',
    label: 'Missions, affectations et historique des statuts',
    keywords: ['mission', 'chantier', 'priorité', 'urgent', 'affectation', 'statut mission'],
    tables: ['missions', 'mission_assignments', 'mission_status_events', 'mission_status_transitions'],
    permission: 'mission.view_all',
    feature: 'missions',
    route: '/missions',
    actionType: 'view_missions',
  },
  {
    key: 'interventions',
    label: 'Interventions, temps, pauses, rapports, photos et signatures',
    keywords: ['intervention', 'temps', 'chronométrage', 'pause', 'rapport', 'compte rendu', 'photo', 'signature', 'contrôle'],
    tables: [
      'interventions',
      'intervention_time_entries',
      'intervention_reports',
      'intervention_attachments',
      'intervention_form_responses',
      'intervention_checklist_responses',
    ],
    permission: 'intervention.view_all',
    feature: 'interventions',
    route: '/controle',
    actionType: 'view_late_interventions',
  },
  {
    key: 'planning',
    label: 'Planning, congés, disponibilités, récurrences et localisation',
    keywords: ['planning', 'congé', 'absence', 'disponible', 'calendrier', 'carte', 'localisation', 'récurrent'],
    tables: [
      'leave_requests',
      'leave_balances',
      'recurring_tasks',
      'technician_locations',
      'technician_location_pings',
    ],
    permission: 'planning.view',
    feature: 'planning',
    route: '/planning',
    actionType: 'view_planning',
  },
  {
    key: 'stock',
    label: 'Articles, consommables, seuils et mouvements',
    keywords: ['stock', 'article', 'consommable', 'seuil', 'rupture', 'mouvement', 'quantité'],
    tables: ['stock_consumables', 'stock_movements'],
    permission: 'stock.view',
    feature: 'stock',
    route: '/stock',
    actionType: 'view_stock',
  },
  {
    key: 'equipment',
    label: 'Équipements, état, série, contrôles et étalonnages',
    keywords: ['équipement', 'matériel', 'outillage', 'série', 'étalonnage', 'calibration', 'otdr'],
    tables: ['equipment', 'equipment_categories'],
    permission: 'equipment.view',
    feature: 'equipment',
    route: '/equipements',
    actionType: 'view_equipment',
  },
  {
    key: 'vehicles',
    label: 'Véhicules, kilométrage et entretien',
    keywords: ['véhicule', 'voiture', 'camion', 'fourgon', 'flotte', 'kilométrage', 'révision', 'contrôle technique'],
    tables: ['vehicles', 'vehicle_maintenance_records'],
    permission: 'equipment.view',
    feature: 'equipment',
    route: '/vehicules',
    actionType: 'view_vehicles',
  },
  {
    key: 'purchases',
    label: 'Fournisseurs, achats, commandes et réceptions',
    keywords: ['achat', 'fournisseur', 'commande', 'livraison', 'réception'],
    tables: ['suppliers', 'purchase_orders', 'purchase_order_items'],
    permission: 'purchase.view',
    feature: 'purchases',
    route: '/achats/commandes',
    actionType: 'view_purchases',
  },
  {
    key: 'quotes',
    label: 'Devis, lignes, taxes, validité et conversion',
    keywords: ['devis', 'chiffrage', 'proposition', 'validité', 'converti'],
    tables: ['quotes', 'quote_items', 'quote_totals', 'quote_templates'],
    permission: 'quote.view',
    feature: 'quotes',
    route: '/devis',
    actionType: 'view_quotes',
  },
  {
    key: 'invoices',
    label: 'Factures, avoirs, lignes, taxes et paiements',
    keywords: ['facture', 'facture', 'avoir', 'payé', 'impayé', 'échéance', 'chiffre affaires'],
    tables: ['invoices', 'invoice_items', 'invoice_totals', 'invoice_vat_breakdown'],
    permission: 'invoice.view',
    feature: 'invoicing',
    route: '/factures',
    actionType: 'view_invoices',
  },
  {
    key: 'einvoicing',
    label: 'Factur-X et transmission électronique',
    keywords: ['factur-x', 'facturx', 'transmission', 'super pdp', 'pdp', 'facturation électronique'],
    tables: [
      'invoice_electronic_documents',
      'invoice_transmissions',
      'invoice_transmission_events',
      'einvoicing_provider_connections',
    ],
    permission: 'invoice.view',
    feature: 'invoicing',
    route: '/organisation/facturation-electronique',
    actionType: 'view_einvoicing',
  },
  {
    key: 'general_documents',
    label: 'Bibliothèque documentaire générale',
    keywords: ['bibliothèque générale', 'document entreprise', 'dossier document', 'fichier entreprise'],
    tables: ['document_folders', 'organization_documents'],
    permission: 'document.view',
    feature: 'documents',
    route: '/documents',
    actionType: 'view_documents',
  },
  {
    key: 'ai_documents',
    label: 'Documents indexés pour l’Assistant IA',
    keywords: ['document ia', 'documents assistant', 'pdf indexé', 'indexation', 'fragment', 'citation'],
    tables: ['ai_documents', 'ai_document_chunks'],
    feature: 'ai_assistant',
    route: '/assistant-ia/documents',
    actionType: 'view_ai_documents',
  },
  {
    key: 'notes',
    label: 'Bloc-notes personnel',
    keywords: ['note', 'bloc-notes', 'mémo', 'pense-bête'],
    tables: ['notes'],
    route: '/notes',
    userScoped: true,
    actionType: 'view_notes',
  },
  {
    key: 'analytics',
    label: 'Tableau de bord, statistiques et indicateurs',
    keywords: ['statistique', 'indicateur', 'tableau de bord', 'performance', 'moyenne', 'total', 'classement'],
    tables: ['organization_activity_stats', 'invoice_totals', 'quote_totals'],
    permission: 'statistics.view',
    feature: 'statistics',
    route: '/analytics',
    actionType: 'view_analytics',
  },
  {
    key: 'audit',
    label: 'Journal d’activité',
    keywords: ['journal', 'activité', 'audit', 'qui a', 'historique action'],
    tables: ['audit_logs'],
    permission: 'audit.view',
    feature: 'audit_log',
    route: '/journal',
    actionType: 'view_audit_log',
  },
  {
    key: 'notifications',
    label: 'Préférences de notifications',
    keywords: ['notification', 'alerte sms', 'préférence notification'],
    tables: ['user_preferences'],
    route: '/settings',
    userScoped: true,
    actionType: 'view_settings',
  },
  {
    key: 'catalog',
    label: 'Catalogue universel, outils et références',
    keywords: ['outil', 'calculatrice', 'catalogue', 'référence', 'formule technique'],
    tables: ['categories', 'tools'],
    route: '/tools',
    actionType: 'view_tools',
  },
  {
    key: 'personal_history',
    label: 'Favoris et historique des outils',
    keywords: ['favori', 'historique outil', 'dernier calcul'],
    tables: ['favorites', 'tool_history'],
    route: '/history',
    userScoped: true,
    actionType: 'view_history',
  },
  {
    key: 'training',
    label: 'Tutoriels, formation et progression',
    keywords: ['tutoriel', 'formation', 'cours', 'académie', 'progression'],
    tables: ['training_progress'],
    route: '/tutoriels',
    userScoped: true,
    actionType: 'view_tutorials',
  },
  {
    key: 'support',
    label: 'Support et pages d’aide',
    keywords: ['support', 'aide', 'faq', 'assistance'],
    tables: ['support_requests'],
    route: '/faq',
    // La boîte support n'est pas lisible par les utilisateurs. L'assistant ne
    // doit connaître que les pages d'aide publiques et ne jamais prétendre
    // consulter les demandes envoyées.
    informationalOnly: true,
  },
  {
    key: 'conversations',
    label: 'Historique conversationnel de l’utilisateur',
    keywords: ['conversation', 'discussion précédente', 'historique assistant'],
    tables: ['ai_conversations', 'ai_messages', 'ai_usage'],
    userScoped: true,
  },
  {
    key: 'industry_forms',
    label: 'Métier, formulaires et check-lists',
    keywords: ['formulaire', 'check-list', 'checklist', 'type intervention', 'champ métier'],
    tables: [
      'industries',
      'intervention_types',
      'form_templates',
      'form_fields',
      'checklist_templates',
      'checklist_items',
    ],
    route: '/references',
  },
] as const;

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’']/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Sélectionne uniquement les domaines utiles à la question courante. */
export function selectKnowledgeDomains(query: string): AiKnowledgeDomain[] {
  const normalized = normalize(query);
  const selected = AI_KNOWLEDGE_DOMAINS.filter((domain) =>
    domain.keywords.some((keyword) => normalized.includes(normalize(keyword))),
  );

  // Les demandes globales ont besoin de la vue transverse. Le catalogue reste
  // borné à des résumés et totaux, jamais au contenu intégral de chaque table.
  if (
    /\b(bilan|global|toute l entreprise|tout savoir|resume activite|synthese activite)\b/.test(
      normalized,
    )
  ) {
    return AI_KNOWLEDGE_DOMAINS.filter((domain) => !domain.informationalOnly);
  }

  return selected.length > 0
    ? selected
    : AI_KNOWLEDGE_DOMAINS.filter((domain) =>
        ['organization', 'customers', 'missions', 'invoices'].includes(domain.key),
      );
}

