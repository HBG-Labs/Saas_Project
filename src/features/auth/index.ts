export { AuthProvider } from './context/AuthProvider';
export { ProtectedRoute } from './components/ProtectedRoute';
export { PublicOnlyRoute } from './components/PublicOnlyRoute';
export { useAuth } from './hooks/useAuth';
export {
  updatePassword,
  requestPasswordReset,
  signInWithGoogle,
  signOutOtherDevices,
} from './api/auth.api';
/*
  Le contexte lui-même est exposé pour les rares consommateurs qui doivent
  TOLÉRER son absence — l'historique de calcul s'affiche aussi hors session, et
  `useAuth()` lève délibérément dans ce cas.
*/
export { AuthContext } from './context/auth-context';
export type { AuthContextValue, AuthStatus } from './context/auth-context';
