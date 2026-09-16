import { Lock } from 'lucide-react';

/**
 * Affichée à la place d'une action d'écriture (statut, note, relance,
 * coordonnée, conversion) pour un administrateur qui n'a que
 * `prospecting.view` — jamais la seule barrière : la RLS refuse déjà
 * l'écriture côté base indépendamment de cet affichage (Phase 2/13).
 */
export function ManageOnlyNotice() {
  return (
    <p className="text-subtle-foreground flex items-center gap-1.5 text-xs">
      <Lock className="size-3 shrink-0" aria-hidden="true" />
      Lecture seule — droits de modification (« prospecting.manage ») requis.
    </p>
  );
}
