import { AlertCircle } from 'lucide-react';

import { toAppError } from '@/lib/errors';

/**
 * Erreur globale d'un formulaire (échec de la requête, pas d'un champ).
 *
 * `role="alert"` : l'erreur est annoncée immédiatement au lecteur d'écran.
 * Sans cela, un utilisateur non voyant ne saurait pas pourquoi le formulaire
 * n'a pas abouti.
 *
 * Vit dans `components/feedback/` et non dans une feature : il n'affiche qu'une
 * `AppError`, sans rien connaître du domaine. Le laisser sous `features/auth`
 * obligeait les autres features à franchir une frontière d'architecture pour
 * afficher une erreur de formulaire.
 */
export function FormError({ error }: { error: unknown }) {
  if (!error) return null;

  return (
    <div
      role="alert"
      className="border-error-border bg-error-subtle mb-4 flex gap-2.5 rounded-md border px-3 py-2.5"
    >
      <AlertCircle className="text-error mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p className="text-foreground text-xs">{toAppError(error).message}</p>
    </div>
  );
}
