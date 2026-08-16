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
