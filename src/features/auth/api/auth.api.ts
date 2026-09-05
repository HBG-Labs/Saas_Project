import type { Session, Subscription } from '@supabase/supabase-js';

import { mapAuthError } from '@/lib/errors';
import { supabase } from '@/services/supabase';

/**
 * Couche d'accès à l'authentification.
 *
 * Seul endroit de la feature `auth` autorisé à parler à Supabase. Les
 * composants et hooks passent par ces fonctions, ce qui garde le provider
 * testable et découplé du SDK.
 *
 * Phase 1 : la plomberie est en place, l'interface utilisateur (formulaires)
 * viendra en Phase 2.
 */

export async function getCurrentSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw mapAuthError(error);
  return data.session;
}

/**
 * S'abonne aux changements d'authentification.
 *
 * Couvre la connexion, la déconnexion, le rafraîchissement de jeton
 * (`TOKEN_REFRESHED`) et la restauration de session au chargement
 * (`INITIAL_SESSION`). Renvoie l'abonnement : l'appelant DOIT appeler
 * `.unsubscribe()`.
 */
export function subscribeToAuthChanges(onChange: (session: Session | null) => void): Subscription {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    onChange(session);
  });

  return subscription;
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw mapAuthError(error);
}

/**
 * Ouvre le flux OAuth Google géré par Supabase.
 *
 * Le client est configuré en PKCE : le secret Google ne transite jamais dans
 * le navigateur et le code à usage unique est consommé au retour par
 * `detectSessionInUrl`.
 */
export async function signInWithGoogle(): Promise<void> {
  const redirectTo = new URL('/auth/callback', window.location.origin).toString();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  });

  if (error) throw mapAuthError(error);
}

export async function signUpWithPassword(
  email: string,
  password: string,
  options?: { displayName?: string },
): Promise<void> {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
      ...(options?.displayName
        ? {
            data: {
              display_name: options.displayName,
              name: options.displayName,
              full_name: options.displayName,
            },
          }
        : {}),
    },
  });
  if (error) throw mapAuthError(error);
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw mapAuthError(error);
}

/**
 * Déconnecte tous les AUTRES appareils, sans toucher à la session courante.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUE `scope: 'others'` FAIT VRAIMENT
 *
 * Supabase révoque côté serveur tous les jetons de rafraîchissement de
 * l'utilisateur, sauf celui de la session appelante. Les autres appareils
 * restent utilisables jusqu'à l'expiration de leur jeton d'accès — une heure au
 * plus — puis échouent à se renouveler et sont déconnectés.
 *
 * C'est une révocation RÉELLE, ce qui la distingue du dispositif qu'elle
 * remplace : une liste d'appareils tenue dans `localStorage`, dont le bouton
 * « Déconnecter » n'effaçait qu'une ligne de ce navigateur.
 *
 * Le SDK client ne sait pas révoquer UNE session précise — il faudrait l'API
 * d'administration, donc une Edge Function et une table de sessions. Tant que
 * cela n'existe pas, l'interface ne doit pas le proposer.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function signOutOtherDevices(): Promise<void> {
  const { error } = await supabase.auth.signOut({ scope: 'others' });
  if (error) throw mapAuthError(error);
}

export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/callback`,
  });
  if (error) throw mapAuthError(error);
}

export async function updatePassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw mapAuthError(error);
}
