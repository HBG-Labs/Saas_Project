import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton';
import { ManagerDashboard } from '@/components/dashboard/ManagerDashboard';
import { OwnerDashboard } from '@/components/dashboard/OwnerDashboard';
import { TechnicianDashboard } from '@/components/dashboard/TechnicianDashboard';
import { usePermission, useCurrentOrganization } from '@/features/organizations';

/**
 * Le tableau de bord dépend du rôle — donc il attend de le connaître.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * « INCONNU » N'EST PAS « TECHNICIEN »
 *
 * `TechnicianDashboard` était le cas par défaut : tout rôle non reconnu y
 * tombait, y compris `null` pendant le chargement de l'organisation. Un
 * dirigeant ouvrant l'application voyait donc d'abord SA vue de technicien —
 * « Bonjour, [nom] », « Mes missions », « Mon planning » — avant qu'elle ne
 * soit remplacée par son vrai tableau de bord.
 *
 * Mesuré au démarrage à froid : la mauvaise vue reste environ une demi-seconde.
 * Assez pour la voir, trop peu pour la lire — d'où l'impression d'une page
 * fantôme qui s'affiche puis disparaît.
 *
 * Le contexte distingue pourtant `loading`, `none` et `ready`. Il suffisait de
 * le lire : tant que le rôle n'est pas connu, on n'en affiche AUCUN.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export default function DashboardPage() {
  const { status } = useCurrentOrganization();
  const { role } = usePermission();

  if (status === 'loading') {
    // Un squelette plutot qu'un spinner : la mise en page est deja a sa place,
    // donc rien ne saute quand le vrai contenu arrive. Voir `DashboardSkeleton`
    // pour ce qu'il peut dessiner — et ce qu'il ne peut pas.
    return <DashboardSkeleton />;
  }

  if (role === 'owner' || role === 'admin') {
    return <OwnerDashboard />;
  }

  if (role === 'manager' || role === 'team_leader') {
    return <ManagerDashboard />;
  }

  return <TechnicianDashboard />;
}
