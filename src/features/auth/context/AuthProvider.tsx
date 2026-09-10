import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { clearPrivateSessionStorage } from '@/lib/private-session-storage';

import {
  getCurrentSession,
  requestPasswordReset,
  signInWithGoogle as signInWithGoogleRequest,
  signInWithPassword,
  signOut as signOutRequest,
  signUpWithPassword,
  subscribeToAuthChanges,
} from '../api/auth.api';
import { AuthContext, type AuthContextValue, type AuthStatus } from './auth-context';

interface AuthState {
  status: AuthStatus;
  session: Session | null;
}

const INITIAL_STATE: AuthState = { status: 'loading', session: null };

/**
 * Réduit une session en état, en évitant les mises à jour inutiles.
 *
 * React court-circuite le rendu si l'état renvoyé est identique (Object.is).
 * Renvoyer `previous` quand rien n'a réellement changé évite donc une cascade
 * de rendus lorsque Supabase rediffuse la même session — ce qui arrive par
 * exemple au retour de focus sur l'onglet.
 */
function reduceSession(previous: AuthState, session: Session | null): AuthState {
  const status: AuthStatus = session === null ? 'unauthenticated' : 'authenticated';

  if (previous.status === status && previous.session === session) return previous;

  return { status, session };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>(INITIAL_STATE);
  const previousUserIdRef = useRef<string | null | undefined>(undefined);

  const applySession = useCallback(
    (session: Session | null) => {
      const nextUserId = session?.user.id ?? null;
      const previousUserId = previousUserIdRef.current;

      // Un cache ne traverse jamais une frontière d'identité. `clear()`
      // annule également les requêtes actives avant que le nouvel utilisateur
      // puisse monter ses écrans.
      if (previousUserId !== undefined && previousUserId !== nextUserId) {
        queryClient.clear();
        clearPrivateSessionStorage();
      }

      previousUserIdRef.current = nextUserId;
      setState((previous) => reduceSession(previous, session));
    },
    [queryClient],
  );

  useEffect(() => {
    // `active` neutralise toute mise à jour arrivant après le démontage
    // (React 18+ monte deux fois les effets en StrictMode).
    let active = true;

    // L'abonnement est posé AVANT la lecture de la session initiale.
    // L'ordre compte : un événement d'authentification survenant pendant la
    // résolution de `getCurrentSession()` serait autrement perdu.
    const subscription = subscribeToAuthChanges((session) => {
      if (!active) return;
      applySession(session);
    });

    void getCurrentSession()
      .then((session) => {
        if (!active) return;

        // Garde anti-course : si l'abonnement a déjà livré un état, il est plus
        // récent que cette lecture. On ne l'écrase pas avec une valeur périmée.
        setState((previous) => {
          if (previous.status !== 'loading') return previous;
          previousUserIdRef.current = session?.user.id ?? null;
          return reduceSession(previous, session);
        });
      })
      .catch(() => {
        if (!active) return;
        // Session illisible (stockage corrompu, jeton révoqué) : on considère
        // l'utilisateur déconnecté plutôt que de rester bloqué en `loading`.
        setState((previous) => {
          if (previous.status !== 'loading') return previous;
          previousUserIdRef.current = null;
          return reduceSession(previous, null);
        });
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [applySession]);

  const signIn = useCallback(async (email: string, password: string) => {
    // Pas de setState ici : l'abonnement reçoit SIGNED_IN et met à jour l'état.
    // Une seule source de vérité évite les états divergents.
    await signInWithPassword(email, password);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    await signInWithGoogleRequest();
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName?: string) => {
    // Le resultat est PROPAGE, pas absorbe : l'ecran d'inscription doit savoir
    // si une session s'est ouverte pour choisir entre entrer dans le produit et
    // renvoyer vers la boite mail. Voir `signUpWithPassword`.
    return signUpWithPassword(email, password, displayName ? { displayName } : undefined);
  }, []);

  const signOut = useCallback(async () => {
    await signOutRequest();
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    await requestPasswordReset(email);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status: state.status,
      session: state.session,
      user: state.session?.user ?? null,
      signIn,
      signInWithGoogle,
      signUp,
      signOut,
      resetPassword,
    }),
    [state, signIn, signInWithGoogle, signUp, signOut, resetPassword],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
