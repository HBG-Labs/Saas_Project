import { Navigate, Outlet, useLocation } from 'react-router';

import { LoadingScreen } from '@/components/feedback/LoadingScreen';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/features/auth';
import { useCurrentOrganization } from '@/features/organizations';
// Import feuille volontaire : le barrel du portail expose aussi ses écrans et
// ses requêtes. Ce garde n'a besoin que du marqueur de compte, au démarrage.
import { estUtilisateurPortail } from '@/features/portal/portal-user';

/**
 * Réserve une branche de routes aux membres d'une organisation.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE COMPOSANT NE SÉCURISE RIEN.
 *
 * Un utilisateur qui atteindrait la route sans appartenance ne verrait de toute
 * façon aucune donnée : chaque policy du module professionnel filtre par
 * `app.my_organization_ids()`. Ce garde évite simplement d'afficher une
 * succession d'écrans vides sans jamais dire pourquoi.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Redirige vers la création d'entreprise plutôt que d'afficher un message :
 * sans organisation, il n'existe littéralement rien à montrer dans cette
 * branche, et un écran d'explication suivi d'un bouton ne ferait qu'ajouter un
 * clic à un parcours à sens unique.
 */
export function RequireOrganization() {
  const { status } = useCurrentOrganization();
  const { user } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <LoadingScreen appearance="workspace" />;
  }

  if (status === 'none') {
    // Un client du portail n'a pas d'entreprise à créer : son espace est
    // ailleurs. Sans ce détour, il atterrissait sur « Créer votre entreprise ».
    if (estUtilisateurPortail(user)) {
      return <Navigate to={ROUTES.portal} replace />;
    }
    // L'origine est conservée pour revenir là où l'utilisateur allait une fois
    // l'entreprise créée — même convention que `ProtectedRoute`.
    return <Navigate to={ROUTES.organizationNew} state={{ from: location.pathname }} replace />;
  }

  return <Outlet />;
}
