import type { KeyboardEvent } from 'react';

/**
 * Rend une zone cliquable atteignable au clavier.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUAND L'UTILISER — ET QUAND NE PAS L'UTILISER
 *
 * Un `<button>` fait tout cela nativement, et reste le bon choix par défaut. Cet
 * utilitaire ne sert qu'aux CARTES qui contiennent déjà des boutons : la carte
 * d'un chantier avec ses actions « Itinéraire » et « Appeler », la case d'un
 * jour de calendrier avec ses pastilles d'événement. Un `<button>` ne peut pas
 * en contenir un autre — c'est du HTML invalide, et les lecteurs d'écran
 * n'annoncent alors plus rien de fiable.
 *
 * À accompagner de `role="button"` et `tabIndex={0}`, sans quoi la zone reste
 * invisible au clavier et cet utilitaire ne sert à rien.
 *
 * Espace et Entrée uniquement, comme un vrai bouton. `preventDefault` sur
 * Espace évite que la page défile sous le doigt au moment de l'activation.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function activateOnKey(action: () => void) {
  return (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;

    // Une touche pressée DANS un bouton imbriqué ne doit pas activer la carte :
    // « Itinéraire » ouvrirait la navigation ET sélectionnerait le chantier.
    if (event.target !== event.currentTarget) return;

    event.preventDefault();
    action();
  };
}
