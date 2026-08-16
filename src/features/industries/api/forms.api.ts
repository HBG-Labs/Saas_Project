import { supabase, unwrap, unwrapMaybe } from '@/services/supabase';
import type { FormFieldType, Json } from '@/types/database';

/**
 * Formulaires métier : lecture des modèles, lecture et écriture des réponses.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE MODULE NE VALIDE RIEN
 *
 * `app.validate_form_response` refuse à l'écriture une clé inconnue du modèle,
 * un nombre hors bornes, un choix hors liste. Le formulaire construit bien un
 * schéma Zod à partir des mêmes champs — mais pour guider la saisie, pas pour
 * autoriser. Dupliquer la règle ici en ferait une troisième copie, celle qu'on
 * oublie de mettre à jour.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface FormField {
  id: string;
  key: string;
  label: string;
  help: string | null;
  type: FormFieldType;
  required: boolean;
  unit: string | null;
  min: number | null;
  max: number | null;
  options: readonly string[];
}

export interface FormTemplate {
  id: string;
  version: number;
  label: string;
  description: string | null;
  fields: readonly FormField[];
}

/** Les valeurs saisies : un objet libre, dont la forme suit le modèle. */
export type FormValues = Record<string, Json>;

export interface FormResponse {
  id: string;
  interventionId: string;
  formTemplateId: string;
  values: FormValues;
  completedAt: string | null;
}

/**
 * `options` arrive en `jsonb`. On ne lui fait pas confiance : une valeur
 * inattendue produit une liste vide plutôt qu'un rendu cassé.
 */
function toOptions(raw: Json): readonly string[] {
  return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string') : [];
}

/**
 * `values` arrive en `jsonb`. La colonne porte une contrainte
 * `jsonb_typeof(values) = 'object'`, mais le type TypeScript reste `Json` : on
 * vérifie plutôt que de supposer, et une valeur inattendue donne un objet vide
 * au lieu d'un rendu cassé.
 */
function toValues(raw: Json): FormValues {
  return typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? raw : {};
}

/**
 * Modèle actif d'un type d'intervention, avec ses champs.
 *
 * Renvoie `null` quand le type n'a pas encore de formulaire — un état
 * parfaitement valide : la fiche affiche alors le compte rendu seul, comme
 * avant l'arrivée des formulaires métier.
 */
export async function getFormTemplate(interventionTypeId: string): Promise<FormTemplate | null> {
  // DEUX requêtes, et non un embed `form_templates → form_fields`.
  //
  // L'embed est plus élégant sur le papier. Il est aussi la source de la panne
  // la plus coûteuse rencontrée sur ce projet : une jointure mal formée ne lève
  // pas d'erreur de compilation, elle renvoie un ensemble vide, et l'écran
  // affiche « aucun champ » avec le même aplomb qu'un formulaire réellement
  // vide. Deux requêtes explicites échouent bruyamment ou réussissent — il n'y
  // a pas de troisième issue.
  //
  // Le coût est nul en pratique : ce modèle est mis en cache une heure.
  const template = await unwrapMaybe(
    supabase
      .from('form_templates')
      .select('*')
      .eq('intervention_type_id', interventionTypeId)
      .eq('status', 'active')
      .single(),
  );

  if (template === null) return null;

  const rows = await unwrap(
    supabase
      .from('form_fields')
      .select('id, key, label, help, type, required, unit, min_value, max_value, options, sort_order')
      .eq('form_template_id', template.id)
      .order('sort_order', { ascending: true }),
  );

  const fields = rows.map((field) => ({
    id: field.id,
    key: field.key,
    label: field.label,
    help: field.help,
    type: field.type,
    required: field.required,
    unit: field.unit,
    min: field.min_value,
    max: field.max_value,
    options: toOptions(field.options),
  }));

  return {
    id: template.id,
    version: template.version,
    label: template.label,
    description: template.description,
    fields,
  };
}

export async function getFormResponse(interventionId: string): Promise<FormResponse | null> {
  const row = await unwrapMaybe(
    supabase
      .from('intervention_form_responses')
      .select('id, intervention_id, form_template_id, values, completed_at')
      .eq('intervention_id', interventionId)
      .single(),
  );

  if (row === null) return null;

  return {
    id: row.id,
    interventionId: row.intervention_id,
    formTemplateId: row.form_template_id,
    values: toValues(row.values),
    completedAt: row.completed_at,
  };
}

/**
 * Enregistre les réponses.
 *
 * `upsert` sur `intervention_id`, qui porte une contrainte d'unicité : une
 * intervention n'a qu'un formulaire. Distinguer création et mise à jour côté
 * client demanderait une lecture préalable, et deux enregistrements
 * simultanés depuis deux onglets produiraient un conflit que la contrainte
 * arbitre déjà.
 *
 * `completed` sépare le brouillon de la déclaration d'achèvement : c'est à la
 * complétion seulement que le serveur exige les champs obligatoires. Un
 * technicien doit pouvoir enregistrer une saisie partielle et la finir plus
 * tard.
 */
export async function saveFormResponse(input: {
  interventionId: string;
  organizationId: string;
  formTemplateId: string;
  values: FormValues;
  completed: boolean;
}): Promise<FormResponse> {
  const row = await unwrap(
    supabase
      .from('intervention_form_responses')
      .upsert(
        {
          intervention_id: input.interventionId,
          organization_id: input.organizationId,
          form_template_id: input.formTemplateId,
          values: input.values,
          completed_at: input.completed ? new Date().toISOString() : null,
        },
        { onConflict: 'intervention_id' },
      )
      .select('id, intervention_id, form_template_id, values, completed_at')
      .single(),
  );

  return {
    id: row.id,
    interventionId: row.intervention_id,
    formTemplateId: row.form_template_id,
    values: toValues(row.values),
    completedAt: row.completed_at,
  };
}
