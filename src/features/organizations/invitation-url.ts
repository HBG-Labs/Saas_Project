import { ROUTES } from '@/config/routes';

/**
 * URL absolue d'acceptation d'une invitation.
 *
 * `window.location.origin` plutôt qu'une variable d'environnement : le lien doit
 * pointer vers l'instance qui l'a produit — production, préproduction ou poste
 * de développement. Une constante figée enverrait vers la production des
 * invitations émises ailleurs.
 *
 * Fichier séparé du composant : mêler une fonction et un composant dans un même
 * module casse le rafraîchissement à chaud de Vite (`react-refresh/only-export-components`).
 */
export function buildInvitationUrl(token: string): string {
  return `${window.location.origin}${ROUTES.invitation(token)}`;
}
