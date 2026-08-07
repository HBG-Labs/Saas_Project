import { PagePlaceholder } from '@/components/feedback/PagePlaceholder';

/**
 * Point de retour des liens e-mail (confirmation d'inscription, réinitialisation
 * de mot de passe). Le client Supabase est configuré avec `detectSessionInUrl`,
 * il consomme donc automatiquement le jeton présent dans l'URL ; cette page
 * n'aura qu'à orienter l'utilisateur selon le résultat.
 */
export default function AuthCallbackPage() {
  return (
    <PagePlaceholder
      title="Validation en cours"
      description="Cette page finalise les liens d'authentification reçus par e-mail."
      plannedFor="Phase 2"
    />
  );
}
