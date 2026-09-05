import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Link, Navigate } from 'react-router';

import { LoadingScreen } from '@/components/feedback/LoadingScreen';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/features/auth';
import { AuthCard } from '@/features/auth/components/AuthCard';
import { useDocumentTitle } from '@/lib/use-document-title';

/**
 * Retour des liens envoyés par e-mail — confirmation d'inscription,
 * réinitialisation de mot de passe.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CETTE PAGE NE CONSOMME PAS LE JETON ELLE-MÊME
 *
 * Le client Supabase est configuré avec `detectSessionInUrl`, et il l'a déjà
 * fait avant même le premier rendu. Le tenter ici une seconde fois échouerait :
 * un jeton d'échange ne vaut qu'une fois.
 *
 * Le rôle de cet écran est donc d'ORIENTER selon le résultat, en distinguant
 * trois issues qu'un simple « erreur » confondrait :
 *   • la session est ouverte      → on entre ;
 *   • le lien porte une erreur    → on l'explique, elle est dans l'URL ;
 *   • rien ne s'est passé         → le lien a probablement déjà servi.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export default function AuthCallbackPage() {
  useDocumentTitle('Validation');

  const { status } = useAuth();

  /**
   * Les liens par e-mail renvoient encore certaines erreurs dans le fragment,
   * tandis qu'un fournisseur OAuth peut les placer dans la chaîne de requête.
   * Lire les deux garde un écran d'erreur utile quel que soit le parcours.
   */
  const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const query = new URLSearchParams(window.location.search);
  const errorCode =
    query.get('error_code') ??
    query.get('error') ??
    fragment.get('error_code') ??
    fragment.get('error');
  const errorDescription = query.get('error_description') ?? fragment.get('error_description');

  if (errorCode !== null) {
    const isExpired = errorCode.includes('expired') || errorDescription?.includes('expired');

    return (
      <AuthCard
        title={isExpired ? 'Ce lien a expiré' : 'Lien invalide'}
        description={
          isExpired
            ? 'Les liens de confirmation sont valables un temps limité.'
            : 'Ce lien ne peut pas être utilisé.'
        }
      >
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <AlertCircle className="text-error size-10" aria-hidden="true" />
          <p className="text-muted-foreground text-sm">
            {isExpired
              ? 'Demandez un nouveau lien depuis l’écran de connexion — il vous sera envoyé immédiatement.'
              : 'Il a peut-être déjà été utilisé, ou été tronqué par votre messagerie.'}
          </p>
          <Button asChild variant="primary" className="w-full">
            <Link to={ROUTES.login}>Retour à la connexion</Link>
          </Button>
        </div>
      </AuthCard>
    );
  }

  if (status === 'loading') {
    return <LoadingScreen label="Validation de votre lien…" />;
  }

  if (status === 'authenticated') {
    // `replace` : le lien porte un jeton à usage unique. Le laisser dans
    // l'historique permettrait un retour arrière sur une URL désormais morte.
    return <Navigate to={ROUTES.dashboard} replace />;
  }

  /**
   * Ni erreur explicite, ni session. Le cas le plus fréquent est un lien déjà
   * utilisé : Supabase consomme le jeton et redirige sans rien signaler.
   *
   * Un message qui l'admet vaut mieux qu'un écran de chargement perpétuel — et
   * mieux qu'un « erreur inconnue », qui ferait chercher une panne là où il n'y
   * a qu'un lien ouvert deux fois.
   */
  return (
    <AuthCard
      title="Lien déjà utilisé"
      description="Aucune session n’a pu être ouverte depuis ce lien."
    >
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <CheckCircle2 className="text-muted-foreground size-10" aria-hidden="true" />
        <p className="text-muted-foreground text-sm">
          Si vous veniez de confirmer votre adresse, votre compte est actif : connectez-vous
          normalement.
        </p>
        <Button asChild variant="primary" className="w-full">
          <Link to={ROUTES.login}>Se connecter</Link>
        </Button>
      </div>
    </AuthCard>
  );
}
