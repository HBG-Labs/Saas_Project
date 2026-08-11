import { ROUTES } from './routes';

export interface NavItem {
  to: string;
  label: string;
  icon: string;
  primary?: boolean;
  permission?: string;
  feature?: string;
}

export interface NavGroup {
  id: string;
  label: string;
  items: readonly NavItem[];
}

export const ROOT_NAV: readonly NavItem[] = [
  { to: ROUTES.dashboard, label: 'Dashboard', icon: 'dashboard', primary: true },
];

export const PRINCIPAL_NAV: readonly NavItem[] = [
  { to: ROUTES.dashboard, label: 'Dashboard', icon: 'dashboard', primary: true },
  { to: ROUTES.missions, label: 'Missions', icon: 'clipboard', feature: 'missions' },
  { to: ROUTES.review, label: 'Contrôle & Rapports', icon: 'clipboard-check', feature: 'interventions' },
  { to: ROUTES.customers, label: 'Clients', icon: 'contact', feature: 'customers' },
  { to: ROUTES.teams, label: 'Équipes', icon: 'users-round', feature: 'teams' },
  { to: ROUTES.organizationMembers, label: 'Membres', icon: 'users', feature: 'members' },
];

export const TOOLS_CATEGORIES_NAV: readonly NavItem[] = [
  { to: `${ROUTES.tools}?cat=reseaux`, label: 'Réseaux & IT', icon: 'cpu' },
  { to: `${ROUTES.tools}?cat=telecoms`, label: 'Télécoms', icon: 'network' },
  { to: `${ROUTES.tools}?cat=fibre`, label: 'Fibre optique', icon: 'cable' },
  { to: `${ROUTES.tools}?cat=electricite`, label: 'Électricité', icon: 'zap' },
  { to: ROUTES.tools, label: 'Outils généraux', icon: 'tools', primary: true },
];

export const GESTION_NAV: readonly NavItem[] = [
  { to: ROUTES.analytics, label: 'Statistiques & Performance', icon: 'chart', feature: 'missions' },
  { to: ROUTES.equipment, label: 'Parc Matériel & Outillage', icon: 'wrench' },
  { to: ROUTES.quotes, label: 'Devis & Chiffrage Express', icon: 'calculator' },
];

export const SIDEBAR_GROUPS: readonly NavGroup[] = [
  { id: 'tools', label: 'Outils', items: TOOLS_CATEGORIES_NAV },
  { id: 'principal', label: 'Pilotage', items: PRINCIPAL_NAV },
  { id: 'gestion', label: 'Gestion', items: GESTION_NAV },
];

export const APP_NAV: readonly NavItem[] = [...ROOT_NAV, ...TOOLS_CATEGORIES_NAV];
export const ORGANIZATION_NAV: readonly NavItem[] = [...PRINCIPAL_NAV, ...GESTION_NAV];
export const ACCOUNT_NAV: readonly NavItem[] = [
  { to: ROUTES.profile, label: 'Profil', icon: 'user' },
  { to: ROUTES.settings, label: 'Paramètres', icon: 'settings' },
];
export const MOBILE_NAV = APP_NAV.filter((item) => item.primary).slice(0, 4);
