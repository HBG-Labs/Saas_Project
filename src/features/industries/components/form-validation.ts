import type { FormField, FormValues } from '../api/forms.api';

/**
 * Champs obligatoires encore vides.
 *
 * Dans son propre module, et non dans `DynamicForm.tsx` : un fichier qui
 * exporte autre chose qu'un composant fait perdre le rechargement à chaud de
 * tout ce qu'il contient. Le formulaire est précisément l'endroit où l'on
 * itère le plus — s'en priver coûterait cher.
 *
 * L'écran appelant en a besoin AVANT de soumettre, pour décider s'il peut
 * déclarer le relevé complet. Le serveur applique la même règle ; celle-ci
 * évite un aller-retour et désigne TOUS les champs manquants d'un coup, là où
 * ils se trouvent, plutôt que le premier venu en tête de page.
 */
export function findMissingRequired(
  fields: readonly FormField[],
  values: FormValues,
): readonly string[] {
  return fields
    .filter((field) => {
      if (!field.required) return false;

      const value = values[field.key];
      if (value === undefined || value === null) return true;
      if (typeof value === 'string') return value.trim() === '';
      if (Array.isArray(value)) return value.length === 0;
      return false;
    })
    .map((field) => field.key);
}
