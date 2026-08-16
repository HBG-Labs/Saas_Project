/** API publique de la feature « industries ». */
export { listIndustries, type Industry } from './api/industries.api';
export {
  useCurrentIndustry,
  useIndustries,
  useLabel,
  type CurrentIndustry,
} from './hooks/useIndustries';
