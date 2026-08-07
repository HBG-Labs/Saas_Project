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

export async function signUpWithPassword(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
  });
  if (error) throw mapAuthError(error);
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
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
