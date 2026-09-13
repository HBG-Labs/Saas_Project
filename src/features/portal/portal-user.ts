import type { User } from '@supabase/supabase-js';

/**
 * Un compte créé PAR le portail — jamais par l'inscription REZO360.
 *
 * `portal-request-access` pose `app_metadata.portal = true` à la création du
 * compte. Ce marqueur ne peut être écrit que par le rôle de service : le
 * navigateur n'y touche pas. Il ne donne aucun droit — la base ne le lit pas —
 * il ne sert qu'à envoyer cette personne vers `/portail` plutôt que vers la
 * création d'entreprise quand elle atterrit sur l'espace REZO360.
 */
export function estUtilisateurPortail(user: User | null): boolean {
  return (user?.app_metadata as { portal?: unknown } | undefined)?.portal === true;
}
