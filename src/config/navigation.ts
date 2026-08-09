import { ROUTES } from './routes';

/**
 * Destinations de navigation.
 *
 * Déclarées une seule fois et consommées par la barre latérale, la navigation
 * basse mobile et la palette de commandes. Sans cette source unique, ajouter une
 * page obligerait à penser à trois endroits — et l'un des trois serait oublié.
 */
export interface NavItem {
  to: string;
  label: string;
  /** Nom d'icône lucide (voir `resolveNavIcon`). */
  icon: string;
  /** Visible dans la navigation basse mobile (5 entrées maximum). */
  primary?: boolean;

  /**
   * Permission RBAC exigée pour voir l'entrée — `'mission.view_all'`,
   * `'audit.view'`… Absente : l'entrée est visible de tous.
   *
   * Typée `string` et non `Permission` à dessein : `config/` est la couche la
   * plus basse et ne doit dépendre d'aucune feature. La validité de la valeur
   * est vérifiée par `navigation.test.ts`, du côté qui connaît le type.
   *
   * Masquer une entrée ne protège RIEN — la route reste atteignable à la main,
   * et c'est bien la RLS qui refusera les données. On évite seulement de
   * proposer une impasse.
   */
  permission?: string;

  /**
   * Fonctionnalité que l'abonnement de l'organisation doit inclure —
   * `'missions'`, `'audit_log'`… Même raisonnement que ci-dessus.
   */
  feature?: string;
}

export const APP_NAV: readonly NavItem[] = [
  { to: ROUTES.dashboard, label: 'Tableau de bord', icon: 'dashboard', primary: true },
  { to: ROUTES.tools, label: 'Outils', icon: 'tools', primary: true },
  { to: ROUTES.favorites, label: 'Favoris', icon: 'star', primary: true },
  { to: ROUTES.history, label: 'Historique', icon: 'history', primary: true },
  { to: ROUTES.references, label: 'Références', icon: 'book' },
];

/**
 * Section « Entreprise ».
 *
 * Séparée d'`APP_NAV` : le catalogue d'outils s'adresse à tout utilisateur,
 * cette section aux seuls membres d'une organisation. Les mêler produirait un
 * menu dont la moitié disparaît selon le contexte, sans que rien n'explique
 * pourquoi.
 *
 * `permission` filtre à l'affichage (voir `useVisibleNavItems`) et ne protège
 * rien : la route reste atteignable, mais la RLS n'y renverra aucune ligne.
 */
export const ORGANIZATION_NAV: readonly NavItem[] = [
  {
    to: ROUTES.missions,
    label: 'Missions',
    icon: 'clipboard',
    // Volontairement SANS `permission` : un technicien n'a pas
    // `mission.view_all`, mais doit voir l'entrée pour atteindre SES missions —
    // que la policy lui sert par ses autres branches. Exiger la permission ici
    // lui cacherait son propre travail.
    feature: 'missions',
  },
  {
    to: ROUTES.review,
    label: 'Contrôle',
    icon: 'clipboard-check',
    permission: 'intervention.review',
    feature: 'intervention_review',
  },
  {
    to: ROUTES.customers,
    label: 'Clients',
    icon: 'contact',
    permission: 'customer.view',
    // Double condition : le rôle ET la formule. Un chef d'équipe d'une
    // entreprise restée en `free` ne verrait qu'une page vide.
    feature: 'customers',
  },
  {
    to: ROUTES.teams,
    label: 'Équipes',
    icon: 'users-round',
    permission: 'team.view',
    feature: 'teams',
  },
  {
    to: ROUTES.organization,
    label: 'Entreprise',
    icon: 'building',
    permission: 'organization.view',
  },
  {
    to: ROUTES.organizationMembers,
    label: 'Membres',
    icon: 'users',
    permission: 'member.view',
  },
  {
    to: ROUTES.organizationBilling,
    label: 'Facturation',
    icon: 'credit-card',
    permission: 'billing.view',
  },
];

export const ACCOUNT_NAV: readonly NavItem[] = [
  { to: ROUTES.profile, label: 'Profil', icon: 'user' },
  { to: ROUTES.settings, label: 'Paramètres', icon: 'settings' },
];

/** Les 4 premières entrées principales + « Plus » complètent la barre basse. */
export const MOBILE_NAV = APP_NAV.filter((item) => item.primary).slice(0, 4);
