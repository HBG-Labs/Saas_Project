import { Navigate, Outlet, useLocation } from 'react-router';

import { LoadingScreen } from '@/components/feedback/LoadingScreen';
import { ROUTES } from '@/config/routes';

import { useAuth } from '../hooks/useAuth';

/**
 * Protège un groupe de routes.
 *
 * L'état `loading` est traité explicitement : rediriger pendant la restauration
 * de session éjecterait vers /login un utilisateur pourtant connecté, à chaque
 * rechargement de page.
 *
 * L'emplacement demandé est conservé dans `state.from` pour pouvoir y revenir
 * après connexion (le formulaire arrive en Phase 2).
 */
export function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <LoadingScreen label="Vérification de votre session…" />;
  }

  if (status === 'unauthenticated') {
    return <Navigate to={ROUTES.login} state={{ from: location.pathname }} replace />;
  }

  return <Outlet />;
}
