/** API publique de la feature « industries ». */
export {
  listIndustries,
  listInterventionTypes,
  type Industry,
  type InterventionType,
} from './api/industries.api';
export {
  useCurrentIndustry,
  useIndustries,
  useInterventionTypes,
  useLabel,
  type CurrentIndustry,
} from './hooks/useIndustries';

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
