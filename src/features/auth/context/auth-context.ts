import type { Session, User } from '@supabase/supabase-js';
import { createContext } from 'react';

/**
 * `loading` est un état à part entière, distinct de `unauthenticated`.
 *
 * Les confondre est le bug classique : au rechargement d'une page protégée, la
 * session n'est pas encore restaurée et l'utilisateur serait redirigé vers
 * /login alors qu'il est connecté.
 */
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
