import {
  BookOpen,
  Building2,
  Clock,
  Contact,
  CreditCard,
  LayoutDashboard,
  Settings,
  Star,
  User,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

/**
 * Icônes de navigation, indexées par le nom déclaré dans `config/navigation`.
 *
 * Exposée comme table plutôt que via une fonction de résolution : un appel de
 * fonction renvoyant un composant est signalé par `react-hooks/static-components`
 * (le compilateur React ne peut pas garantir que le résultat est stable). Un
 * accès direct à une constante de module l'est manifestement.
 *
 * Table explicite plutôt qu'import dynamique : seules ces icônes entrent dans
 * le bundle, au lieu des plusieurs centaines de la bibliothèque.
 */
export const NAV_ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  tools: Wrench,
  star: Star,
  history: Clock,
  book: BookOpen,
  user: User,
  settings: Settings,
  building: Building2,
  users: Users,
  contact: Contact,
  'credit-card': CreditCard,
};

export const FALLBACK_NAV_ICON: LucideIcon = Wrench;
