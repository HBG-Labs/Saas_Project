import { ROUTES } from './routes';
import type { NavGroup, NavItem } from './navigation';

export const TECHNICIAN_PRINCIPAL_NAV: readonly NavItem[] = [
  { to: ROUTES.dashboard, label: 'Tableau de bord', icon: 'dashboard', primary: true },
  { to: ROUTES.missions, label: 'Mes Interventions & Missions', icon: 'clipboard-check', primary: true },
  { to: ROUTES.planning, label: 'Mon Planning & Congés', icon: 'calendar', primary: true },
  { to: ROUTES.map, label: 'Cartographie & Itinéraire', icon: 'map', primary: true },
  { to: ROUTES.reports, label: 'Rédiger un compte-rendu', icon: 'scroll', primary: true },
  { to: ROUTES.notes, label: 'Bloc-notes', icon: 'file-text' },
];

export const TECHNICIAN_TOOLS_NAV: readonly NavItem[] = [
  { to: `${ROUTES.tools}?cat=reseaux`, label: 'Réseaux & IT', icon: 'cpu' },
  { to: `${ROUTES.tools}?cat=telecoms`, label: 'Télécoms', icon: 'network' },
  { to: `${ROUTES.tools}?cat=fibre`, label: 'Fibre optique', icon: 'cable' },
  { to: `${ROUTES.tools}?cat=electricite`, label: 'Électricité BT', icon: 'zap' },
];

export const TECHNICIAN_SIDEBAR_GROUPS: readonly NavGroup[] = [
  { id: 'principal', label: 'Espace Technicien', items: TECHNICIAN_PRINCIPAL_NAV },
];
