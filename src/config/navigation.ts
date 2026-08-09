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

/**
 * Regroupement d'entrées sous un intitulé commun.
 *
 * La barre latérale n'affiche un groupe que si au moins une de ses entrées
 * survit au filtrage (voir `useVisibleNavGroups`) : un intitulé surmontant le
 * vide pose plus de questions qu'il n'en résout.
 */
export interface NavGroup {
  /** Clé de rendu, jamais affichée. */
  id: string;
  label: string;
  items: readonly NavItem[];
}

/** Le point de départ, hors de tout groupe : il n'a pas de pair. */
export const ROOT_NAV: readonly NavItem[] = [
  { to: ROUTES.dashboard, label: 'Tableau de bord', icon: 'dashboard', primary: true },
];

/** Le catalogue technique — accessible à tout utilisateur, organisation ou non. */
export const TOOLS_NAV: readonly NavItem[] = [
  { to: ROUTES.tools, label: 'Catalogue', icon: 'tools', primary: true },
  { to: ROUTES.favorites, label: 'Favoris', icon: 'star', primary: true },
  { to: ROUTES.history, label: 'Historique', icon: 'history', primary: true },
  { to: ROUTES.references, label: 'Références', icon: 'book' },
];

/**
 * Liste plate du domaine personnel.
 *
 * La navigation basse en dérive : sur mobile, une barre de cinq icônes n'a pas
 * la place d'intitulés de section.
 */
export const APP_NAV: readonly NavItem[] = [...ROOT_NAV, ...TOOLS_NAV];

/**
 * Ce qui se fait au quotidien : le travail lui-même, et son contrôle.
 *
 * `permission` filtre à l'affichage (voir `useVisibleNavItems`) et ne protège
 * rien : la route reste atteignable, mais la RLS n'y renverra aucune ligne.
 */
const OPERATIONS_NAV: readonly NavItem[] = [
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
];

/** Ce sur quoi le travail s'appuie : chez qui l'on va, et avec qui. */
const RESOURCES_NAV: readonly NavItem[] = [
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
];

/** L'administration de l'entreprise — consultée rarement, par peu de monde. */
const COMPANY_NAV: readonly NavItem[] = [
  {
    to: ROUTES.organization,
    // Nommée « Paramètres » et non « Entreprise » : l'entrée portait
    // auparavant le nom de la section qui la contient, et l'on ne pouvait pas
    // deviner qu'elle menait à la fiche de la société plutôt qu'à l'ensemble.
    label: 'Paramètres',
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
  {
    to: ROUTES.auditLog,
    label: 'Journal',
    icon: 'scroll',
    permission: 'audit.view',
    feature: 'audit_log',
  },
];

/**
 * Sections de la barre latérale, dans l'ordre où l'on s'en sert.
 *
 * Les trois premières s'adressent aux membres d'une organisation et
 * disparaissent entièrement pour qui n'en fait pas partie — aucune de leurs
 * entrées ne passe alors le filtrage. « Outils » reste, puisqu'il ne dépend ni
 * d'un rôle ni d'une formule.
 *
 * L'ordre n'est pas décoratif : les missions sont ce qu'un technicien ouvre
 * dix fois par jour, la facturation ce qu'un dirigeant ouvre une fois par mois.
 */
export const SIDEBAR_GROUPS: readonly NavGroup[] = [
  { id: 'operations', label: 'Opérations', items: OPERATIONS_NAV },
  { id: 'resources', label: 'Ressources', items: RESOURCES_NAV },
  { id: 'company', label: 'Entreprise', items: COMPANY_NAV },
  { id: 'tools', label: 'Outils', items: TOOLS_NAV },
];

/**
 * Liste plate des entrées d'organisation.
 *
 * Dérivée des groupes, jamais saisie deux fois : une entrée ajoutée à un groupe
 * sans l'être ici sortirait silencieusement du champ des tests de validité.
 */
export const ORGANIZATION_NAV: readonly NavItem[] = [
  ...OPERATIONS_NAV,
  ...RESOURCES_NAV,
  ...COMPANY_NAV,
];

export const ACCOUNT_NAV: readonly NavItem[] = [
  { to: ROUTES.profile, label: 'Profil', icon: 'user' },
  { to: ROUTES.settings, label: 'Paramètres', icon: 'settings' },
];

/** Les 4 premières entrées principales + « Plus » complètent la barre basse. */
export const MOBILE_NAV = APP_NAV.filter((item) => item.primary).slice(0, 4);
