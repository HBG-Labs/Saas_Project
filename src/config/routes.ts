/**
 * Chemins de l'application.
 *
 * Placé dans `config/` (couche la plus basse) plutôt que dans `app/` : les
 * features et les composants en ont besoin, et une feature ne doit pas dépendre
 * de la racine de composition.
 *
 * Aucune URL ne doit être écrite en dur ailleurs — un renommage de route se
 * répercute ici et nulle part ailleurs.
 */
export const ROUTES = {
  home: '/',

  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  /** Retour des liens e-mail : confirmation d'inscription, réinitialisation. */
  authCallback: '/auth/callback',

  features: '/features',
  pricing: '/pricing',
  faq: '/faq',

  /**
   * Module professionnel. Chemins en français : ils sont lus par des
   * techniciens sur le terrain, pas par des développeurs.
   */
  organizationNew: '/organisation/nouvelle',
  organization: '/organisation',
  organizationMembers: '/organisation/membres',
  organizationBilling: '/organisation/facturation',
  /** Flotte & Véhicules d'intervention. */
  vehicles: '/vehicules',
  /** Journal d'audit — réservé à `audit.view`. */
  auditLog: '/journal',
  /** Acceptation d'une invitation — le jeton est dans l'URL. */
  invitation: (token: string) => `/invitations/${token}`,

  /** Pages légales — publiques, indexables, liées depuis le pied de page. */
  legalNotice: '/mentions-legales',
  privacy: '/confidentialite',
  terms: '/conditions-generales',
  /** CGV des prestations HBG Labs sur devis — distinctes de l'abonnement REZO360 ci-dessus. */
  servicesTerms: '/cgv-prestations',
  cookies: '/cookies',

  customers: '/clients',
  customer: (customerId: string) => `/clients/${customerId}`,

  teams: '/equipes',
  team: (teamId: string) => `/equipes/${teamId}`,

  missions: '/missions',
  missionNew: '/missions/nouvelle',
  mission: (missionId: string) => `/missions/${missionId}`,

  intervention: (interventionId: string) => `/interventions/${interventionId}`,
  interventionReport: (interventionId: string) => `/interventions/${interventionId}/rapport`,
  /** File de contrôle des comptes rendus. */
  review: '/controle',
  /** Répertoire des dossiers terminés — clos et annulés. */
  archives: '/dossiers-clos',

  dashboard: '/dashboard',
  analytics: '/analytics',
  aiAssistant: '/assistant-ia',
  planning: '/planning',
  map: '/carte',
  tools: '/tools',
  favorites: '/favorites',
  history: '/history',
  references: '/references',
  stock: '/stock',
  stockMovements: '/stock/mouvements',
  equipment: '/equipements',
  purchases: '/achats',
  purchaseOrders: '/achats/commandes',
  suppliers: '/achats/fournisseurs',
  quotes: '/devis',
  notes: '/bloc-notes',
  reports: '/comptes-rendus',
  profile: '/profile',
  settings: '/settings',

  /**
   * Les outils et catégories sont adressés par `slug`, pas par `id` : c'est le
   * slug qui fait le lien entre la table `tools` et le registry côté code, et
   * il produit des URL lisibles.
   */
  tool: (slug: string) => `/tools/${slug}`,
  category: (slug: string) => `/categories/${slug}`,

  /**
   * Nouveau volet indépendant « Outils Métiers » (6 métiers, 36 outils)
   */
  metiers: '/metiers',
  metierTrade: (tradeSlug: string) => `/metiers/${tradeSlug}`,
  metierTool: (tradeSlug: string, toolSlug: string) => `/metiers/${tradeSlug}/${toolSlug}`,
} as const;

/** Patrons utilisés par la déclaration des routes (paramètres non résolus). */
export const ROUTE_PATTERNS = {
  tool: '/tools/:toolSlug',
  category: '/categories/:categorySlug',
  metierTrade: '/metiers/:tradeSlug',
  metierTool: '/metiers/:tradeSlug/:toolSlug',
  invitation: '/invitations/:token',
  customer: '/clients/:customerId',
  team: '/equipes/:teamId',
  mission: '/missions/:missionId',
  intervention: '/interventions/:interventionId',
  interventionReport: '/interventions/:interventionId/rapport',
} as const;
