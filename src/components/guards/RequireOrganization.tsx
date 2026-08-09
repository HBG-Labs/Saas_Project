import { Navigate, Outlet, useLocation } from 'react-router';

import { LoadingScreen } from '@/components/feedback/LoadingScreen';
import { ROUTES } from '@/config/routes';
import { useCurrentOrganization } from '@/features/organizations';

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
  const location = useLocation();

  if (status === 'loading') {
    return <LoadingScreen label="Chargement de votre espace de travail…" />;
  }

  if (status === 'none') {
    // L'origine est conservée pour revenir là où l'utilisateur allait une fois
    // l'entreprise créée — même convention que `ProtectedRoute`.
    return (
      <Navigate to={ROUTES.organizationNew} state={{ from: location.pathname }} replace />
    );
  }

  return <Outlet />;
}
