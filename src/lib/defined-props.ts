/**
 * Retire les clés dont la valeur est `undefined`.
 *
 * Pourquoi c'est nécessaire : le projet active `exactOptionalPropertyTypes`,
 * qui distingue « propriété absente » de « propriété présente valant undefined ».
 * Les librairies tierces (ici Radix UI) déclarent `checked?: CheckedState` sans
 * `| undefined`, et refusent donc `checked={undefined}`.
 *
 * Plutôt que de relâcher la règle pour tout le projet — elle reste précieuse sur
 * les types métier et les insertions Supabase — on nettoie l'objet au point de
 * contact.
 *
 * Le type de retour utilise un mapped type optionnel plutôt que `Partial<T>` :
 * sous `exactOptionalPropertyTypes`, `Partial<T>` réintroduirait `| undefined`
 * et le problème resterait entier.
 */
export function definedProps<T extends Record<string, unknown>>(
  props: T,
): { [K in keyof T]?: Exclude<T[K], undefined> } {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(props)) {
    if (value !== undefined) result[key] = value;
  }

  return result as { [K in keyof T]?: Exclude<T[K], undefined> };
}
