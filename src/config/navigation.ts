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
}

export const APP_NAV: readonly NavItem[] = [
  { to: ROUTES.dashboard, label: 'Tableau de bord', icon: 'dashboard', primary: true },
  { to: ROUTES.tools, label: 'Outils', icon: 'tools', primary: true },
  { to: ROUTES.favorites, label: 'Favoris', icon: 'star', primary: true },
  { to: ROUTES.history, label: 'Historique', icon: 'history', primary: true },
  { to: ROUTES.references, label: 'Références', icon: 'book' },
];

export const ACCOUNT_NAV: readonly NavItem[] = [
  { to: ROUTES.profile, label: 'Profil', icon: 'user' },
  { to: ROUTES.settings, label: 'Paramètres', icon: 'settings' },
];

/** Les 4 premières entrées principales + « Plus » complètent la barre basse. */
export const MOBILE_NAV = APP_NAV.filter((item) => item.primary).slice(0, 4);
