import { ROUTES } from '@/config/routes';
import { env } from '@/config/env';

/**
 * URL absolue d'acceptation d'une invitation.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI UNE SURCHARGE, ALORS QUE L'ORIGINE SUFFIRAIT
 *
 * `window.location.origin` pointe vers l'instance qui produit le lien —
 * production, préproduction ou poste de développement. C'est le bon défaut, et
 * en production il donne exactement la bonne adresse.
 *
 * Mais un dirigeant qui prépare ses invitations depuis son poste obtenait
 * `http://localhost:5173/invitations/…` : un lien qu'il ne peut transmettre à
 * personne, et qui DIVERGE de celui du courriel — construit, lui, à partir du
 * secret serveur `APP_URL`. Deux adresses pour la même invitation, dont une
 * morte.
 *
 * `VITE_PUBLIC_APP_URL` lève l'ambiguïté quand elle est posée, sans rien
 * changer là où l'origine est déjà juste. À renseigner dans `.env.local` avec
 * la même valeur que le secret `APP_URL` — les deux décrivent la même chose.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Fichier séparé du composant : mêler une fonction et un composant dans un même
 * module casse le rafraîchissement à chaud de Vite
 * (`react-refresh/only-export-components`).
 */
export function buildInvitationUrl(token: string): string {
  const base = (env.VITE_PUBLIC_APP_URL ?? window.location.origin).replace(/\/$/, '');
  return `${base}${ROUTES.invitation(token)}`;
}
