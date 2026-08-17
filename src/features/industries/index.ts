/** API publique de la feature « industries ». */
export {
  listIndustries,
  listEquipmentCategories,
  listInterventionTypes,
  type EquipmentCategoryRef,
  type Industry,
  type InterventionType,
} from './api/industries.api';
export {
  useCurrentIndustry,
  useEquipmentCategories,
  useIndustries,
  useInterventionTypes,
  useLabel,
  type CurrentIndustry,
} from './hooks/useIndustries';
export { formatNewNoun } from '@/config/industries';

export {
  getFormResponse,
  getFormTemplate,
  saveFormResponse,
  type FormField,
  type FormResponse,
  type FormTemplate,
  type FormValues,
} from './api/forms.api';
export { useFormResponse, useFormTemplate, useSaveFormResponse } from './hooks/useForms';
export { DynamicForm } from './components/DynamicForm';
export { findMissingRequired } from './components/form-validation';
export { InterventionFormCard } from './components/InterventionFormCard';

export {
  getChecklistResponse,
  getChecklistTemplate,
  saveChecklistResponse,
  type ChecklistItem,
  type ChecklistResponse,
  type ChecklistTemplate,
} from './api/checklists.api';
export { ChecklistCard } from './components/ChecklistCard';
