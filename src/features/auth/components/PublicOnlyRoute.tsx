import { Navigate, Outlet } from 'react-router';

import { LoadingScreen } from '@/components/feedback/LoadingScreen';
import { ROUTES } from '@/config/routes';

import { useAuth } from '../hooks/useAuth';

/**
 * Réservé aux visiteurs non connectés (connexion, inscription, mot de passe
 * oublié). Un utilisateur déjà authentifié est renvoyé vers son tableau de bord
 * plutôt que de se voir proposer de se reconnecter.
 */
export function PublicOnlyRoute() {
  const { status } = useAuth();

  if (status === 'loading') {
    return <LoadingScreen label="Vérification de votre session…" />;
  }

  if (status === 'authenticated') {
    return <Navigate to={ROUTES.dashboard} replace />;
  }

  return <Outlet />;
}
