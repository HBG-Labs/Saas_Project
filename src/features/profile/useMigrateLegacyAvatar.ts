import { useEffect } from 'react';

import { useAuth } from '@/features/auth';

import { useMyProfile, useUpdateMyProfile } from './hooks';

/**
 * Reprise de l'avatar choisi dans l'ANCIEN système, purement local.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUE CETTE REPRISE PEUT, ET CE QU'ELLE NE PEUT PAS
 *
 * L'ancien choix ne vivait nulle part en base — mesuré : les 13 profils
 * existants ont tous `avatar_id is null`. Il ne vivait que dans une clé
 * `localStorage` PARTAGÉE PAR LE NAVIGATEUR, pas par compte : sur un poste
 * utilisé par plusieurs personnes, cette valeur pouvait appartenir à
 * n'importe laquelle d'entre elles, pas nécessairement à celle qui se
 * reconnecte aujourd'hui.
 *
 * Reconstituer avec certitude « ce que CETTE personne avait choisi » est donc
 * impossible — l'information n'a jamais existé sous cette forme. Ce qui EST
 * possible, et ce que ce hook fait : éviter qu'un ancien réglage local reste
 * en mémoire indéfiniment, en le convertissant une fois pour toutes vers un
 * avatar de la nouvelle bibliothèque plutôt que de le laisser pointer sur un
 * fichier qui va être supprimé.
 *
 * LA CORRESPONDANCE EST POSITIONNELLE, DÉLIBÉRÉMENT
 *
 * Tenter un rapprochement par « style » (patron → costume, technicien →
 * casque) prêterait une précision que la donnée d'origine n'a jamais eue.
 * Une correspondance simple et déterministe — le premier ancien avatar vers
 * le premier nouveau, et ainsi de suite — ne prétend pas mieux que ce qui est
 * vérifiable, et suffit à l'objectif réel : plus aucune référence à un
 * fichier qui n'existe plus.
 *
 * NE JAMAIS ÉCRASER UN CHOIX DÉJÀ FAIT SOUS LE NOUVEAU SYSTÈME
 *
 * L'écriture n'a lieu que si `avatar_id` est encore `null` en base. Une
 * personne qui a déjà ouvert le nouveau sélecteur a fait un choix réel ; le
 * remplacer par une reprise approximative de l'ancien système serait une
 * régression, pas une migration.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const CLE_ANCIENNE = 'rezo360_active_avatar_url';
const DRAPEAU_TRAITE = 'rezo360_legacy_avatar_migrated';

/** Ordre d'apparition des anciens avatars dans `avatars-data.ts`, avant sa suppression. */
const ANCIENS_IDS_EN_ORDRE = [
  'tech-male-1',
  'boss-male-1',
  'tech-female-1',
  'boss-female-1',
  'tech-male-2',
  'tech-female-2',
  'boss-male-2',
  'artisan-male-1',
  'abstract-cyber-1',
  'abstract-fluid-2',
  'abstract-gold-3',
  'abstract-energy-4',
] as const;

/**
 * L'ancienne URL (`/avatars/tech-male-1.jpg`) vers le nouvel identifiant
 * (`avatar-01`), ou `null` si elle ne correspond à rien de connu.
 *
 * Fonction pure, testée séparément de l'effet qui la déclenche.
 */
export function nouvelIdentifiantPourAncienneUrl(url: string): string | null {
  const nom = url.replace(/^\/avatars\//, '').replace(/\.(jpg|jpeg|png)$/i, '');
  const position = ANCIENS_IDS_EN_ORDRE.indexOf(nom as (typeof ANCIENS_IDS_EN_ORDRE)[number]);
  if (position === -1) return null;

  return `avatar-${String(position + 1).padStart(2, '0')}`;
}

export function useMigrateLegacyAvatar(): void {
  const { user } = useAuth();
  const profileQuery = useMyProfile();
  const updateProfile = useUpdateMyProfile();

  useEffect(() => {
    if (user === null) return;
    // On attend une réponse DÉFINITIVE du profil avant d'agir : partir d'un
    // `undefined` transitoire (chargement en cours) risquerait de lire
    // `avatar_id` comme absent alors qu'il ne l'est peut-être pas encore.
    if (profileQuery.isPending) return;

    let ancienneValeur: string | null;
    try {
      if (localStorage.getItem(DRAPEAU_TRAITE) !== null) return;
      ancienneValeur = localStorage.getItem(CLE_ANCIENNE);
    } catch {
      return; // Stockage indisponible : rien à reprendre, rien à casser.
    }

    if (ancienneValeur !== null) {
      const avatarIdActuel = profileQuery.data?.identity?.avatar_id ?? null;

      if (avatarIdActuel === null) {
        const nouvelId = nouvelIdentifiantPourAncienneUrl(ancienneValeur);
        if (nouvelId !== null) {
          updateProfile.mutate({ identity: { avatar_id: nouvelId } });
        }
      }
    }

    try {
      localStorage.removeItem(CLE_ANCIENNE);
      localStorage.setItem(DRAPEAU_TRAITE, new Date().toISOString());
    } catch {
      // Stockage indisponible en écriture : la reprise a eu lieu si elle
      // pouvait avoir lieu, le drapeau n'est qu'une optimisation.
    }
    // `updateProfile` est stable (identité de `useMutation`), mais l'inclure
    // dans les dépendances déclencherait un avertissement de lint sans
    // changer le comportement : il n'est jamais recréé entre deux rendus
    // porteurs du même `user`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profileQuery.isPending, profileQuery.data]);
}
