/**
 * Clés de cache TanStack Query.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI UNE FABRIQUE PLUTÔT QUE DES TABLEAUX ÉCRITS SUR PLACE
 *
 * Une clé sert deux fois : à lire et à invalider. Écrite à la main aux deux
 * endroits, elle finit par diverger d'un caractère — et l'invalidation cesse
 * silencieusement de fonctionner. Personne ne voit d'erreur : l'écran affiche
 * simplement une donnée périmée, ce qui est le pire des défauts sur une
 * application de terrain où l'on décide d'après ce qui est affiché.
 *
 * Toutes les clés descendent donc d'une racine par domaine, ce qui rend possible
 * l'invalidation en cascade : invalider `qk.missions.all` purge listes ET
 * détails, sans avoir à les énumérer.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Convention : du plus général au plus précis, et l'identifiant d'organisation
 * apparaît AVANT les filtres. Deux organisations ne partagent jamais une entrée
 * de cache — changer d'organisation ne doit pas laisser voir les données de la
 * précédente le temps d'un rafraîchissement.
 */

export const qk = {
  // ---------------------------------------------------------------- catalogue
  catalog: {
    all: ['catalog'] as const,
    categories: () => [...qk.catalog.all, 'categories'] as const,
    tools: () => [...qk.catalog.all, 'tools'] as const,
    tool: (slug: string) => [...qk.catalog.all, 'tool', slug] as const,
  },

  // -------------------------------------------------------------- facturation
  billing: {
    all: ['billing'] as const,
    plans: () => [...qk.billing.all, 'plans'] as const,
    /**
     * `userId` fait partie de la clé : à la déconnexion, l'abonnement du compte
     * précédent ne doit pas rester servi au suivant depuis le cache.
     */
    mySubscription: (userId: string | null) =>
      [...qk.billing.all, 'subscription', 'user', userId] as const,
    organizationSubscription: (organizationId: string) =>
      [...qk.billing.all, 'subscription', 'organization', organizationId] as const,
  },

  // ------------------------------------------------------------ organisations
  organizations: {
    all: ['organizations'] as const,
    mine: () => [...qk.organizations.all, 'mine'] as const,
    detail: (organizationId: string) =>
      [...qk.organizations.all, 'detail', organizationId] as const,
    members: (organizationId: string) =>
      [...qk.organizations.all, organizationId, 'members'] as const,
    membership: (organizationId: string, userId: string) =>
      [...qk.organizations.all, organizationId, 'membership', userId] as const,
    invitations: (organizationId: string) =>
      [...qk.organizations.all, organizationId, 'invitations'] as const,
    /**
     * Aperçu d'une invitation — indexé par jeton, hors de toute organisation :
     * celui qui consulte n'en est pas encore membre.
     */
    invitationPreview: (token: string) =>
      [...qk.organizations.all, 'invitation-preview', token] as const,
  },

  // ------------------------------------------------------------------ clients
  customers: {
    all: ['customers'] as const,
    list: (organizationId: string, filters?: unknown) =>
      [...qk.customers.all, organizationId, 'list', filters ?? null] as const,
    detail: (customerId: string) => [...qk.customers.all, 'detail', customerId] as const,
    contacts: (customerId: string) => [...qk.customers.all, customerId, 'contacts'] as const,
    sites: (customerId: string) => [...qk.customers.all, customerId, 'sites'] as const,
    history: (customerId: string) => [...qk.customers.all, customerId, 'history'] as const,
    /** Tous les sites de l'organisation — alimente le sélecteur de mission. */
    organizationSites: (organizationId: string) =>
      [...qk.customers.all, organizationId, 'all-sites'] as const,
  },

  // ------------------------------------------------------------------ équipes
  teams: {
    all: ['teams'] as const,
    list: (organizationId: string) => [...qk.teams.all, organizationId, 'list'] as const,
    detail: (teamId: string) => [...qk.teams.all, 'detail', teamId] as const,
    ofMember: (memberId: string) => [...qk.teams.all, 'member', memberId] as const,
    memberships: (organizationId: string) =>
      [...qk.teams.all, organizationId, 'memberships'] as const,
  },

  // ----------------------------------------------------------------- missions
  missions: {
    all: ['missions'] as const,
    list: (organizationId: string, filters?: unknown) =>
      [...qk.missions.all, organizationId, 'list', filters ?? null] as const,
    detail: (missionId: string) => [...qk.missions.all, 'detail', missionId] as const,
    history: (missionId: string) => [...qk.missions.all, missionId, 'history'] as const,
    assignments: (missionId: string) => [...qk.missions.all, missionId, 'assignments'] as const,
    /** Table de référence : sans identifiant, elle est commune à tous. */
    statusTransitions: () => [...qk.missions.all, 'status-transitions'] as const,
  },

  // ------------------------------------------------------------ interventions
  interventions: {
    all: ['interventions'] as const,
    detail: (interventionId: string) => [...qk.interventions.all, 'detail', interventionId] as const,
    ofMission: (missionId: string) => [...qk.interventions.all, 'mission', missionId] as const,
    timeEntries: (interventionId: string) =>
      [...qk.interventions.all, interventionId, 'time-entries'] as const,
    report: (interventionId: string) =>
      [...qk.interventions.all, interventionId, 'report'] as const,
    attachments: (interventionId: string) =>
      [...qk.interventions.all, interventionId, 'attachments'] as const,
    pendingReview: (organizationId: string) =>
      [...qk.interventions.all, organizationId, 'pending-review'] as const,
  },

  // ----------------------------------------------------------- parc matériel
  /**
   * Le parc ROULANT, distinct de l'outillage malgré des droits communs : les
   * deux écrans s'invalident séparément, et confondre leurs clés ferait
   * recharger l'un à chaque écriture sur l'autre.
   */
  vehicles: {
    all: ['vehicles'] as const,
    list: (organizationId: string) => [...qk.vehicles.all, organizationId] as const,
  },

  equipment: {
    all: ['equipment'] as const,
    list: (organizationId: string, filters?: unknown) =>
      [...qk.equipment.all, organizationId, 'list', filters ?? null] as const,
    detail: (equipmentId: string) => [...qk.equipment.all, 'detail', equipmentId] as const,
  },

  // -------------------------------------------------------------------- stock
  stock: {
    all: ['stock'] as const,
    consumables: (organizationId: string) =>
      [...qk.stock.all, organizationId, 'consumables'] as const,
    movements: (organizationId: string) =>
      [...qk.stock.all, organizationId, 'movements'] as const,
  },

  // -------------------------------------------------------------------- devis
  quotes: {
    all: ['quotes'] as const,
    list: (organizationId: string, filters?: unknown) =>
      [...qk.quotes.all, organizationId, 'list', filters ?? null] as const,
    detail: (quoteId: string) => [...qk.quotes.all, 'detail', quoteId] as const,
    templates: (organizationId: string) =>
      [...qk.quotes.all, organizationId, 'templates'] as const,
  },

  // ------------------------------------------------------------------- achats
  purchases: {
    all: ['purchases'] as const,
    suppliers: (organizationId: string) =>
      [...qk.purchases.all, organizationId, 'suppliers'] as const,
    orders: (organizationId: string, filters?: unknown) =>
      [...qk.purchases.all, organizationId, 'orders', filters ?? null] as const,
    order: (orderId: string) => [...qk.purchases.all, 'order', orderId] as const,
  },

  // --------------------------------------------------------------- bloc-notes
  notes: {
    all: ['notes'] as const,
    /**
     * Indexées par utilisateur : une note est personnelle, et le cache ne doit
     * pas la servir au compte suivant après une déconnexion.
     */
    list: (userId: string, organizationId: string | null) =>
      [...qk.notes.all, userId, organizationId] as const,
  },

  // --------------------------------------------------------------- industries
  //
  // Pas d'identifiant d'organisation ici, contrairement à la convention : le
  // référentiel des métiers est global et public. Le partager entre
  // organisations est correct, et c'est même le but — la liste ne change que
  // par migration.
  industries: {
    all: ['industries'] as const,
  },

  // ----------------------------------------------------------------- planning
  planning: {
    all: ['planning'] as const,
    leaves: (organizationId: string, filters?: unknown) =>
      [...qk.planning.all, organizationId, 'leaves', filters ?? null] as const,
    balances: (organizationId: string, year: number) =>
      [...qk.planning.all, organizationId, 'balances', year] as const,
    recurringTasks: (organizationId: string) =>
      [...qk.planning.all, organizationId, 'recurring-tasks'] as const,
    /**
     * Les événements du calendrier ne sont pas une table : ils composent
     * missions, congés et tâches récurrentes. La clé porte la fenêtre affichée,
     * puisque c'est elle qui détermine ce qui est chargé.
     */
    calendar: (organizationId: string, from: string, to: string) =>
      [...qk.planning.all, organizationId, 'calendar', from, to] as const,
  },

  // ----------------------------------------------------------- cartographie
  locations: {
    all: ['locations'] as const,
    live: (organizationId: string) => [...qk.locations.all, organizationId, 'live'] as const,
    /**
     * La piste d'un intervenant, bornée dans le temps. Séparée de la position
     * courante : on rafraîchit l'une toutes les minutes, l'autre à l'ouverture
     * du tiroir d'historique.
     */
    trail: (memberId: string, sinceIso: string) =>
      [...qk.locations.all, 'trail', memberId, sinceIso] as const,
  },

  // -------------------------------------------------------------------- audit
  audit: {
    all: ['audit'] as const,
    list: (organizationId: string, filters?: unknown) =>
      [...qk.audit.all, organizationId, 'list', filters ?? null] as const,
    entityTrail: (entityType: string, entityId: string) =>
      [...qk.audit.all, 'entity', entityType, entityId] as const,
  },
} as const;
