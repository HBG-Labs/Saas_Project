export type StockMovementType = 'in' | 'out' | 'transfer' | 'adjustment';

export interface StockConsumable {
  id: string;
  organizationId: string;
  reference: string;
  name: string;
  category: string;
  unit: string; // 'm' | 'pièce' | 'rouleau' | 'boîte' | 'kg' | 'lot' | 'litre'
  quantityInStock: number;
  minThreshold: number;
  unitPriceEur?: number | undefined;
  sellingPriceEur?: number | undefined;
  location: string;
  supplier?: string | undefined;
  notes?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface StockMovement {
  id: string;
  organizationId: string;
  consumableId: string;
  consumableName: string;
  consumableReference: string;
  type: StockMovementType;
  quantity: number; // Toujours positif dans le record, le type indique le sens
  reason: string;
  technicianName?: string | undefined;
  technicianId?: string | undefined;
  interventionRef?: string | undefined;
  locationFrom?: string | undefined;
  locationTo?: string | undefined;
  date: string;
  createdAt: string;
}

export interface ConsumableInput {
  reference: string;
  name: string;
  category: string;
  unit: string;
  quantityInStock: number;
  minThreshold: number;
  unitPriceEur?: number | undefined;
  sellingPriceEur?: number | undefined;
  location: string;
  supplier?: string | undefined;
  notes?: string | undefined;
}

export interface StockMovementInput {
  consumableId: string;
  type: StockMovementType;
  quantity: number;
  reason: string;
  technicianName?: string | undefined;
  technicianId?: string | undefined;
  interventionRef?: string | undefined;
  locationFrom?: string | undefined;
  locationTo?: string | undefined;
}

export interface StockMetrics {
  totalArticles: number;
  totalQuantity: number;
  totalValueEur: number;
  lowStockCount: number;
  movementsCountMonth: number;
}

export const STOCK_MOVEMENT_TYPE_LABELS: Record<StockMovementType, string> = {
  in: 'Entrée / Réception',
  out: 'Sortie / Consommation',
  transfer: 'Transfert de stock',
  adjustment: 'Régularisation inventaire',
};

export const STOCK_MOVEMENT_TYPE_VARIANTS: Record<
  StockMovementType,
  { badge: 'success' | 'danger' | 'warning' | 'info'; color: string; sign: string }
> = {
  in: { badge: 'success', color: 'text-emerald-600 dark:text-emerald-400', sign: '+' },
  out: { badge: 'danger', color: 'text-rose-600 dark:text-rose-400', sign: '-' },
  transfer: { badge: 'info', color: 'text-blue-600 dark:text-blue-400', sign: '⇄' },
  adjustment: { badge: 'warning', color: 'text-amber-600 dark:text-amber-400', sign: '±' },
};

export const COMMON_CONSUMABLE_CATEGORIES = [
  'Câblage & Fibre',
  'Appareillage & Électricité',
  'Plomberie & Tuyauterie',
  'CVC & Fluides Frigo',
  'Fixations & Quincaillerie',
  'Consommables Chantier & Nettoyage',
  'EPI & Sécurité',
  'Réseaux & Informatique',
  'Autre',
] as const;

export const COMMON_UNITS = [
  'pièce',
  'm',
  'rouleau',
  'boîte',
  'lot',
  'kg',
  'litre',
  'flacon',
] as const;
