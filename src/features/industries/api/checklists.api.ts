import { supabase, unwrap, unwrapMaybe } from '@/services/supabase';
import type { Json } from '@/types/database';

/**
 * Check-lists métier.
 *
 * Un formulaire recueille des GRANDEURS ; une check-list atteste des GESTES.
 * D'où deux tables et deux modules, plutôt qu'un document commun : leurs
 * réponses n'ont pas la même forme, et un type d'intervention peut n'avoir que
 * l'une des deux.
 */

export interface ChecklistItem {
  id: string;
  code: string;
  label: string;
  help: string | null;
  /** Non coché, ce point EMPÊCHE la transmission du compte rendu. */
  required: boolean;
}

export interface ChecklistTemplate {
  id: string;
  label: string;
  description: string | null;
  items: readonly ChecklistItem[];
}

export interface ChecklistResponse {
  id: string;
  interventionId: string;
  checklistTemplateId: string;
  /** Codes cochés. Un point non coché est absent — il n'y a pas de `false`. */
  checked: readonly string[];
  completedAt: string | null;
}

function toCodes(raw: Json): readonly string[] {
  return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string') : [];
}

/** Check-list active d'un type d'intervention. `null` s'il n'en a pas. */
export async function getChecklistTemplate(
  interventionTypeId: string,
): Promise<ChecklistTemplate | null> {
  const template = await unwrapMaybe(
    supabase
      .from('checklist_templates')
      .select('id, label, description')
      .eq('intervention_type_id', interventionTypeId)
      .eq('status', 'active')
      .single(),
  );

  if (template === null) return null;

  const rows = await unwrap(
    supabase
      .from('checklist_items')
      .select('id, code, label, help, required, sort_order')
      .eq('checklist_template_id', template.id)
      .order('sort_order', { ascending: true }),
  );

  return {
    id: template.id,
    label: template.label,
    description: template.description,
    items: rows.map((item) => ({
      id: item.id,
      code: item.code,
      label: item.label,
      help: item.help,
      required: item.required,
    })),
  };
}

export async function getChecklistResponse(
  interventionId: string,
): Promise<ChecklistResponse | null> {
  const row = await unwrapMaybe(
    supabase
      .from('intervention_checklist_responses')
      .select('id, intervention_id, checklist_template_id, checked, completed_at')
      .eq('intervention_id', interventionId)
      .single(),
  );

  if (row === null) return null;

  return {
    id: row.id,
    interventionId: row.intervention_id,
    checklistTemplateId: row.checklist_template_id,
    checked: toCodes(row.checked),
    completedAt: row.completed_at,
  };
}

export async function saveChecklistResponse(input: {
  interventionId: string;
  organizationId: string;
  checklistTemplateId: string;
  checked: readonly string[];
  completed: boolean;
}): Promise<ChecklistResponse> {
  const row = await unwrap(
    supabase
      .from('intervention_checklist_responses')
      .upsert(
        {
          intervention_id: input.interventionId,
          organization_id: input.organizationId,
          checklist_template_id: input.checklistTemplateId,
          checked: [...input.checked],
          completed_at: input.completed ? new Date().toISOString() : null,
        },
        { onConflict: 'intervention_id' },
      )
      .select('id, intervention_id, checklist_template_id, checked, completed_at')
      .single(),
  );

  return {
    id: row.id,
    interventionId: row.intervention_id,
    checklistTemplateId: row.checklist_template_id,
    checked: toCodes(row.checked),
    completedAt: row.completed_at,
  };
}
