/**
 * API publique de la feature « parc matériel ».
 *
 * Les pages importent d'ici, jamais d'un fichier interne : la règle ESLint
 * `no-restricted-imports` l'impose, et c'est ce qui permet de réorganiser
 * l'intérieur de la feature sans casser ses consommateurs.
 */
export {
  useCreateEquipment,
  useDeleteEquipment,
  useEquipmentList,
  useUpdateEquipment,
} from './hooks/useEquipment';

export type { EquipmentFilters, EquipmentInput } from './api/equipment.api';

export {
  EQUIPMENT_CATEGORY_LABELS,
  EQUIPMENT_CONDITION_LABELS,
  EQUIPMENT_STATUS_LABELS,
  EQUIPMENT_STATUS_VARIANTS,
  calibrationState,
} from './labels';
