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
    label: 'Planning & Congés',
    icon: 'calendar',
    feature: 'planning',
    permission: 'planning.view',
    primary: true,
  },
  {
    to: ROUTES.map,
    label: 'Cartographie & Chantiers',
    icon: 'map',
    feature: 'missions',
    primary: true,
  },
  { to: ROUTES.review, label: 'Contrôle & Rapports', icon: 'clipboard-check', feature: 'interventions' },
  { to: ROUTES.archives, label: 'Dossiers clôturés', icon: 'archive', feature: 'missions' },
];

export const STOCK_NAV: readonly NavItem[] = [
  { to: ROUTES.equipment, label: 'Parc Matériel & Outillage', icon: 'wrench' },
];

export const ACHATS_NAV: readonly NavItem[] = [
  { to: ROUTES.quotes, label: 'Devis & Chiffrage Express', icon: 'calculator' },
];

export const CLIENTS_NAV: readonly NavItem[] = [
  { to: ROUTES.customers, label: 'Clients', icon: 'contact', feature: 'customers' },
  { to: ROUTES.analytics, label: 'Statistiques & Performance', icon: 'chart', feature: 'missions' },
  { to: ROUTES.notes, label: 'Bloc-notes', icon: 'file-text' },
];

export const ADMINISTRATION_NAV: readonly NavItem[] = [
  { to: ROUTES.teams, label: 'Équipes', icon: 'users-round', feature: 'teams' },
  {
    to: ROUTES.organizationMembers,
    label: 'Techniciens',
    icon: 'users',
    feature: 'members',
    vocabulary: { term: 'worker', plural: true },
  },
  {
    to: ROUTES.vehicles,
    label: 'Véhicules',
    icon: 'truck',
    feature: 'members',
  },
  {
    to: ROUTES.organization,
    label: 'Paramètres Entreprise',
    icon: 'building',
    permission: 'organization.update',
  },
  {
    // `billing.view` et non `billing.manage` : un administrateur consulte la
    // formule et la consommation sans pouvoir changer le moyen de paiement.
    to: ROUTES.organizationBilling,
    label: 'Abonnement & Facturation',
    icon: 'credit-card',
    permission: 'billing.view',
  },
  {
    to: ROUTES.auditLog,
    label: 'Journal d’activité',
    icon: 'scroll',
    permission: 'audit.view',
  },
];

export const SIDEBAR_GROUPS: readonly NavGroup[] = [
  { id: 'interventions', label: 'Interventions', icon: 'clipboard', items: INTERVENTIONS_NAV },
  { id: 'stock', label: 'Stock', icon: 'wrench', items: STOCK_NAV },
  { id: 'achats', label: 'Achats', icon: 'calculator', items: ACHATS_NAV },
  { id: 'administration', label: 'Administration', icon: 'settings', items: ADMINISTRATION_NAV },
  { id: 'clients', label: 'Clients & Suivi', icon: 'contact', items: CLIENTS_NAV },
];

export const PRINCIPAL_NAV: readonly NavItem[] = [
  ...INTERVENTIONS_NAV,
  ...ADMINISTRATION_NAV,
  ...CLIENTS_NAV,
];

export const GESTION_NAV: readonly NavItem[] = [
  ...STOCK_NAV,
  ...ACHATS_NAV,
];

export const TOOLS_CATEGORIES_NAV: readonly NavItem[] = [
  { to: `${ROUTES.tools}?cat=reseaux`, label: 'Réseaux & IT', icon: 'cpu' },
  { to: `${ROUTES.tools}?cat=telecoms`, label: 'Télécoms', icon: 'network' },
  { to: `${ROUTES.tools}?cat=fibre`, label: 'Fibre optique', icon: 'cable' },
  { to: `${ROUTES.tools}?cat=electricite`, label: 'Électricité', icon: 'zap' },
  { to: ROUTES.tools, label: 'Outils généraux', icon: 'tools', primary: true },
];

export const APP_NAV: readonly NavItem[] = [...ROOT_NAV, ...TOOLS_CATEGORIES_NAV];
export const ORGANIZATION_NAV: readonly NavItem[] = [
  ...INTERVENTIONS_NAV,
  ...STOCK_NAV,
  ...ACHATS_NAV,
  ...ADMINISTRATION_NAV,
  ...CLIENTS_NAV,
];
export const ACCOUNT_NAV: readonly NavItem[] = [
  { to: ROUTES.profile, label: 'Profil', icon: 'user' },
  { to: ROUTES.settings, label: 'Paramètres', icon: 'settings' },
];
export const MOBILE_NAV = PRINCIPAL_NAV.filter((item) => item.primary).slice(0, 4);
