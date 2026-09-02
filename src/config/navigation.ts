import { ROUTES } from './routes';

export interface NavItem {
  to: string;
  label: string;
  icon: string;
  primary?: boolean;
  /** Rôle requis dans l'organisation. */
  permission?: string;
  /** Clé d'entitlement : ce que la formule débloque. */
  feature?: string;
  /**
   * Métier requis. Absent = destination transverse, visible partout.
   */
  industry?: string | readonly string[];
  /**
   * Terme du vocabulaire métier qui remplace `label`.
   */
  vocabulary?: { term: 'worker' | 'job' | 'visit'; plural?: boolean };
}

export interface NavGroup {
  id: string;
  label: string;
  icon?: string;
  items: readonly NavItem[];
}

/**
 * Une entrée de menu une fois confrontée à l'abonnement de l'organisation.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI UN TYPE À PART PLUTÔT QU'UN CHAMP OPTIONNEL SUR `NavItem`
 *
 * `locked` n'est pas une donnée de configuration : personne ne l'écrit à la
 * main, elle se CALCULE au rendu, pour une organisation donnée, à un instant
 * donné. La poser dans `NavItem` inviterait à la déclarer en dur — et une
 * entrée verrouillée en dur le resterait pour les abonnés qui l'ont payée.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export interface ResolvedNavItem extends NavItem {
  /** La formule de l'organisation n'inclut pas cette destination. */
  locked: boolean;
}

export interface ResolvedNavGroup extends NavGroup {
  items: readonly ResolvedNavItem[];
}

export const ROOT_NAV: readonly NavItem[] = [
  { to: ROUTES.dashboard, label: 'Dashboard', icon: 'dashboard', primary: true },
];

export const INTERVENTIONS_NAV: readonly NavItem[] = [
  { to: ROUTES.dashboard, label: 'Tableau de bord', icon: 'dashboard', primary: true },
  { to: ROUTES.aiAssistant, label: 'Assistant IA', icon: 'sparkles' },
  {
    to: ROUTES.missions,
    label: 'Missions',
    icon: 'clipboard',
    feature: 'missions',
    vocabulary: { term: 'job', plural: true },
    primary: true,
  },
  {
    to: ROUTES.planning,
    label: 'Planning',
    icon: 'calendar',
    feature: 'planning',
    permission: 'planning.view',
    primary: true,
  },
  {
    to: ROUTES.map,
    label: 'Carte & Chantiers',
    icon: 'map',
    feature: 'missions',
    primary: true,
  },
  { to: ROUTES.customers, label: 'Clients', icon: 'contact', feature: 'customers' },
  { to: ROUTES.analytics, label: 'Statistiques', icon: 'chart', feature: 'missions' },
  { to: ROUTES.review, label: 'Rapports & Contrôle', icon: 'clipboard-check', feature: 'interventions' },
  { to: ROUTES.archives, label: 'Archives', icon: 'archive', feature: 'missions' },
];

export const TOOLS_NAV: readonly NavItem[] = [
  { to: ROUTES.tools, label: 'Catalogue Universel', icon: 'wrench', primary: true },
  { to: ROUTES.notes, label: 'Bloc-notes', icon: 'file-text' },
  { to: `${ROUTES.tools}?tab=favorites`, label: 'Outils Favoris', icon: 'star' },
];

export const METIERS_TOOLS_NAV: readonly NavItem[] = [
  { to: ROUTES.metiers, label: 'Accueil Métiers', icon: 'briefcase', primary: true },
  { to: `${ROUTES.metiers}/btp`, label: 'BTP & Maçonnerie', icon: 'hammer' },
  { to: `${ROUTES.metiers}/plomberie`, label: 'Plomberie & Fluides', icon: 'droplet' },
  { to: `${ROUTES.metiers}/electricite`, label: 'Électricité & Câblage', icon: 'zap' },
  { to: `${ROUTES.metiers}/espaces-verts`, label: 'Espaces Verts', icon: 'flower' },
  { to: `${ROUTES.metiers}/fibre-optique`, label: 'Fibre Optique', icon: 'cable' },
  { to: `${ROUTES.metiers}/reseaux`, label: 'Réseaux & Télécoms', icon: 'network' },
];

/*
  LA `feature` DÉCLARÉE ICI EST CELLE QUE LA RLS EXIGE.

  Ces six entrées n'en déclaraient aucune. Elles s'affichaient donc pour tout le
  monde, sans indication — et une organisation Gratuite qui cliquait « Articles
  & Fournitures » tombait sur un mur « Mettre à niveau » qu'aucun signe ne
  laissait prévoir.

  La source de vérité est la POLICY, pas le nom de l'écran ni même le garde de
  route : c'est elle qui décide ce que le serveur renverra. `stock_consumables`
  et `stock_movements` exigent `stock` ; `equipment`, `vehicles` et leurs
  entretiens exigent `equipment`. `router.tsx` a été aligné sur cette même
  découpe — les trois écrans partageaient auparavant un garde `equipment` unique.
*/
export const STOCK_NAV: readonly NavItem[] = [
  { to: ROUTES.stock, label: 'Articles & Fournitures', icon: 'package', feature: 'stock', primary: true },
  { to: ROUTES.stockMovements, label: 'Mouvements', icon: 'arrow-left-right', feature: 'stock' },
  { to: ROUTES.equipment, label: 'Matériel & Flotte', icon: 'wrench', feature: 'equipment' },
];

export const ACHATS_NAV: readonly NavItem[] = [
  { to: ROUTES.purchaseOrders, label: 'Commandes', icon: 'shopping-cart', feature: 'purchases', primary: true },
  { to: ROUTES.suppliers, label: 'Fournisseurs', icon: 'store', feature: 'purchases' },
  { to: ROUTES.quotes, label: 'Devis & Chiffrage', icon: 'calculator', feature: 'quotes' },
];

export const ADMINISTRATION_NAV: readonly NavItem[] = [
  { to: ROUTES.teams, label: 'Équipes', icon: 'users-round', feature: 'teams' },
  {
    // PAS de `feature: 'members'`. Ces deux écrans ne sont gardés que par la
    // permission `member.view` — aucun `RequirePlan` ne les protège. Déclarer
    // une formule ici posait un cadenas MENSONGER sur les organisations
    // Gratuites : la page s'ouvre, et c'est le quota de sièges
    // (`plans.max_users`) qui refuse la seconde invitation, avec son propre
    // message. Un cadenas doit annoncer un mur qui existe.
    to: ROUTES.organizationMembers,
    label: 'Techniciens',
    icon: 'users',
    vocabulary: { term: 'worker', plural: true },
  },
  {
    // `equipment`, comme le stock — et non `members`, comme déclaré autrefois.
    // Les six policies RLS de `vehicles` passent par
    // `can_use_pro_module(..., 'equipment')` : sans cette formule, le serveur
    // renvoie une flotte vide et refuse toute écriture. Mesuré sur une
    // organisation Gratuite : la page s'ouvrait sur « Aucun véhicule trouvé »
    // et un bouton « Ajouter un véhicule » voué à l'échec.
    to: ROUTES.vehicles,
    label: 'Véhicules',
    icon: 'truck',
    feature: 'equipment',
  },
  {
    to: ROUTES.organization,
    label: 'Entreprise',
    icon: 'building',
    permission: 'organization.update',
  },
  {
    // `billing.view` et non `billing.manage` : un administrateur consulte la
    // formule et la consommation sans pouvoir changer le moyen de paiement.
    to: ROUTES.organizationBilling,
    label: 'Facturation',
    icon: 'credit-card',
    permission: 'billing.view',
  },
  {
    // `RequirePlan feature={FEATURES.auditLog}` garde cette route, et NI Starter
    // NI Pro n'incluent `audit_log`. Sans cette déclaration, l'entrée
    // s'affichait ouverte à leurs propriétaires — qui ont bien la permission —
    // et le clic butait sur un mur que rien n'annonçait.
    to: ROUTES.auditLog,
    label: 'Journal d’activité',
    icon: 'scroll',
    feature: 'audit_log',
    permission: 'audit.view',
  },
];

export const SIDEBAR_GROUPS: readonly NavGroup[] = [
  { id: 'interventions', label: 'Interventions', icon: 'clipboard', items: INTERVENTIONS_NAV },
  { id: 'stock', label: 'Stock', icon: 'package', items: STOCK_NAV },
  { id: 'achats', label: 'Achats & Devis', icon: 'calculator', items: ACHATS_NAV },
  { id: 'administration', label: 'Administration', icon: 'settings', items: ADMINISTRATION_NAV },
  { id: 'outils', label: 'Boîte à outils', icon: 'wrench', items: TOOLS_NAV },
  { id: 'outils-metiers', label: 'Outils Métiers', icon: 'briefcase', items: METIERS_TOOLS_NAV },
];

export const PRINCIPAL_NAV: readonly NavItem[] = [
  ...INTERVENTIONS_NAV,
  ...ADMINISTRATION_NAV,
  ...TOOLS_NAV,
  ...METIERS_TOOLS_NAV,
];

export const GESTION_NAV: readonly NavItem[] = [
  ...STOCK_NAV,
  ...ACHATS_NAV,
];

export const TOOLS_CATEGORIES_NAV: readonly NavItem[] = [
  { to: ROUTES.tools, label: 'Boîte à outils universelle', icon: 'wrench', primary: true },
  { to: ROUTES.metiers, label: 'Outils Métiers spécialisés', icon: 'briefcase', primary: true },
];

export const APP_NAV: readonly NavItem[] = [...ROOT_NAV, ...TOOLS_CATEGORIES_NAV];
export const ORGANIZATION_NAV: readonly NavItem[] = [
  ...INTERVENTIONS_NAV,
  ...STOCK_NAV,
  ...ACHATS_NAV,
  ...ADMINISTRATION_NAV,
  ...TOOLS_NAV,
  ...METIERS_TOOLS_NAV,
];
export const ACCOUNT_NAV: readonly NavItem[] = [
  { to: ROUTES.profile, label: 'Profil', icon: 'user' },
  { to: ROUTES.settings, label: 'Paramètres', icon: 'settings' },
];
/**
 * Candidats de la navigation basse, du plus quotidien au plus occasionnel.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI UNE LISTE EXPLICITE PLUTÔT QU'UN FILTRE
 *
 * Cette constante valait `PRINCIPAL_NAV.filter(primary).slice(0, 4)`. La coupe
 * à quatre intervenait AVANT le filtrage par abonnement et permissions : une
 * entrée réservée à une formule supérieure consommait sa place puis
 * disparaissait à l'affichage. Mesuré sur un compte Pro, la barre ne portait
 * plus que TROIS destinations — « Planning » occupait le quatrième rang et
 * était retiré ensuite, sans être remplacé.
 *
 * `MobileNav` filtre donc d'abord, puis prend les cinq premières survivantes.
 * La liste compte plus de cinq entrées : c'est délibéré, ce sont les
 * remplaçantes.
 *
 * L'ORDRE EST UN CHOIX MÉTIER
 *
 * Il suit ce qu'une personne sur le terrain ouvre dans sa journée, pas
 * l'architecture du produit : ce qu'elle doit faire aujourd'hui, puis pour qui,
 * puis avec quoi. « Carte & Chantiers » recule — on la consulte en se
 * déplaçant, pas à chaque prise en main.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const MOBILE_NAV_CANDIDATES: readonly NavItem[] = [
  { to: ROUTES.dashboard, label: 'Accueil', icon: 'dashboard', primary: true },
  {
    to: ROUTES.missions,
    label: 'Missions',
    icon: 'clipboard',
    feature: 'missions',
    vocabulary: { term: 'job', plural: true },
  },
  {
    to: ROUTES.planning,
    label: 'Planning',
    icon: 'calendar',
    feature: 'planning',
    permission: 'planning.view',
  },
  { to: ROUTES.tools, label: 'Outils', icon: 'wrench' },
  { to: ROUTES.customers, label: 'Clients', icon: 'contact', feature: 'customers' },
  {
    to: ROUTES.review,
    label: 'Rapports',
    icon: 'clipboard-check',
    feature: 'interventions',
  },
  { to: ROUTES.map, label: 'Carte', icon: 'map', feature: 'missions' },
  { to: ROUTES.metiers, label: 'Métiers', icon: 'briefcase' },
];

/** Nombre de destinations affichées en barre basse. */
export const MOBILE_NAV_SIZE = 5;
