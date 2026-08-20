export { useStock } from './hooks/useStock';

export {
  COMMON_CONSUMABLE_CATEGORIES,
  COMMON_UNITS,
  STOCK_MOVEMENT_TYPE_LABELS,
  STOCK_MOVEMENT_TYPE_VARIANTS,
} from './types/stock.types';

export type {
  ConsumableInput,
  StockConsumable,
  StockMetrics,
  StockMovement,
  StockMovementInput,
  StockMovementType,
} from './types/stock.types';

export { StockNavTabs } from './components/StockNavTabs';
export { StockKpiCards, type StockPeriod } from './components/StockKpiCards';
export { StockAlertsBanner } from './components/StockAlertsBanner';
export { ConsumableFormModal } from './components/ConsumableFormModal';
export { RecordMovementModal } from './components/RecordMovementModal';
export { ConsumablesTable } from './components/ConsumablesTable';
export { StockMovementsTable } from './components/StockMovementsTable';
