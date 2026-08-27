import { ROUTES } from './routes';
import { METIERS_TOOLS_NAV, type NavGroup, type NavItem } from './navigation';

export const TECHNICIAN_PRINCIPAL_NAV: readonly NavItem[] = [
  { to: ROUTES.dashboard, label: 'Tableau de bord', icon: 'dashboard', primary: true },
  { to: ROUTES.missions, label: 'Mes Interventions & Missions', icon: 'clipboard-check', primary: true },
  { to: ROUTES.planning, label: 'Mon Planning & Congés', icon: 'calendar', primary: true },
  { to: ROUTES.map, label: 'Cartographie & Itinéraire', icon: 'map', primary: true },
  { to: ROUTES.reports, label: 'Rédiger un compte-rendu', icon: 'scroll', primary: true },
];

export const TECHNICIAN_TOOLS_NAV: readonly NavItem[] = [
  { to: ROUTES.tools, label: 'Catalogue Universel', icon: 'wrench', primary: true },
  { to: ROUTES.notes, label: 'Bloc-notes', icon: 'file-text' },
  { to: `${ROUTES.tools}?tab=favorites`, label: 'Outils Favoris', icon: 'star' },
];

export const TECHNICIAN_SIDEBAR_GROUPS: readonly NavGroup[] = [
  { id: 'principal', label: 'Espace Technicien', items: TECHNICIAN_PRINCIPAL_NAV },
  { id: 'outils', label: 'Boîte à outils', icon: 'wrench', items: TECHNICIAN_TOOLS_NAV },
  { id: 'outils-metiers', label: 'Outils Métiers', icon: 'briefcase', items: METIERS_TOOLS_NAV },
];
