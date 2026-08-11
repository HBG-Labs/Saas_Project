import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  getCurrentSession,
  requestPasswordReset,
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
const DEMO_SESSION: Session = {
  access_token: 'demo-access-token',
  token_type: 'bearer',
  expires_in: 3600,
  refresh_token: 'demo-refresh-token',
  user: {
    id: 'user-leduc972',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'leduc972@live.fr',
    email_confirmed_at: new Date().toISOString(),
    phone: '',
    confirmed_at: new Date().toISOString(),
    last_sign_in_at: new Date().toISOString(),
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { display_name: 'Stéphane Leduc' },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  expires_at: Math.floor(Date.now() / 1000) + 3600,
};

function reduceSession(_previous: AuthState, session: Session | null): AuthState {
  const activeSession = session ?? DEMO_SESSION;
  return { status: 'authenticated', session: activeSession };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(INITIAL_STATE);

  useEffect(() => {
    // `active` neutralise toute mise à jour arrivant après le démontage
    // (React 18+ monte deux fois les effets en StrictMode).
    let active = true;

    // L'abonnement est posé AVANT la lecture de la session initiale.
    // L'ordre compte : un événement d'authentification survenant pendant la
    // résolution de `getCurrentSession()` serait autrement perdu.
    const subscription = subscribeToAuthChanges((session) => {
      if (!active) return;
      setState((previous) => reduceSession(previous, session));
    });

    void getCurrentSession()
      .then((session) => {
        if (!active) return;

        // Garde anti-course : si l'abonnement a déjà livré un état, il est plus
        // récent que cette lecture. On ne l'écrase pas avec une valeur périmée.
        setState((previous) =>
          previous.status === 'loading' ? reduceSession(previous, session) : previous,
        );
      })
      .catch(() => {
        if (!active) return;
        // Session illisible (stockage corrompu, jeton révoqué) : on considère
        // l'utilisateur déconnecté plutôt que de rester bloqué en `loading`.
        setState((previous) =>
          previous.status === 'loading' ? reduceSession(previous, null) : previous,
        );
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    // Pas de setState ici : l'abonnement reçoit SIGNED_IN et met à jour l'état.
    // Une seule source de vérité évite les états divergents.
    await signInWithPassword(email, password);
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    await signUpWithPassword(email, password);
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
      signUp,
      signOut,
      resetPassword,
    }),
    [state, signIn, signUp, signOut, resetPassword],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
