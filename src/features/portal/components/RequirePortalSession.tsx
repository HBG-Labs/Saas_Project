import { ShieldOff } from 'lucide-react';
import { Link, Navigate, useLocation } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingScreen } from '@/components/feedback/LoadingScreen';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/features/auth';

import { usePortalContext } from '../hooks/usePortal';
import { PortalLayout } from './PortalLayout';

/**
 * Garde de la branche `/portail`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE COMPOSANT NE SÉCURISE RIEN — c'est `portal_my_context()` qui décide.
 *
 * Sans session : la page de connexion. Avec une session qui n'est le contact
 * d'aucun portail actif (accès révoqué, portail désactivé, formule sans le
 * module) : un écran qui le dit, sans détailler pourquoi — la raison précise
 * appartient à l'entreprise, pas au visiteur.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function RequirePortalSession() {
  const { status, signOut } = useAuth();
  const location = useLocation();
  const context = usePortalContext();

  if (status === 'loading') return <LoadingScreen label="Vérification de votre accès…" />;
  if (status === 'unauthenticated') {
    return <Navigate to={ROUTES.portalLogin} state={{ from: location.pathname }} replace />;
  }
  if (context.isPending) return <LoadingScreen appearance="workspace" />;
  if (context.isError) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <ErrorState
          error={context.error}
          onRetry={() => {
            void context.refetch();
          }}
        />
      </div>
    );
  }

  if (context.data === null) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg items-center p-6">
        <EmptyState
          icon={ShieldOff}
          title="Aucun espace client pour ce compte"
          description="Cette adresse n’a pas accès à un espace client actif. Si vous pensez qu’il s’agit d’une erreur, contactez l’entreprise qui vous a invité."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void signOut();
                }}
              >
                Changer de compte
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link to={ROUTES.dashboard}>Aller à REZO360</Link>
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  return <PortalLayout context={context.data} />;
}
