export type PurchaseOrderStatus =
  | 'draft'
  | 'sent'
  | 'partially_received'
  | 'received'
  | 'cancelled';

export interface Supplier {
  id: string;
  organizationId: string;
  name: string;
  code?: string | undefined;
  contactName?: string | undefined;
  email?: string | undefined;
  phone?: string | undefined;
  address?: string | undefined;
  city?: string | undefined;
  postalCode?: string | undefined;
  siret?: string | undefined;
  vatNumber?: string | undefined;
  website?: string | undefined;
  defaultPaymentTerms?: string | undefined;
  notes?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

export type SupplierInput = Omit<Supplier, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>;

export interface PurchaseOrderItem {
  id: string;
  consumableId?: string | undefined;
  reference: string;
  description: string;
  unit: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitPriceEur: number;
  totalEur: number;
}

export type PurchaseOrderItemInput = Omit<PurchaseOrderItem, 'id' | 'quantityReceived' | 'totalEur'> & {
  id?: string | undefined;
  consumableId?: string | undefined;
  quantityReceived?: number | undefined;
  totalEur?: number | undefined;
};

export interface PurchaseOrder {
  id: string;
  reference: string; // Ex: "PO-2026-001"
  organizationId: string;
  supplierId: string;
  supplierName: string;
  supplierEmail?: string | undefined;
  supplierPhone?: string | undefined;
  supplierAddress?: string | undefined;
  status: PurchaseOrderStatus;
  orderDate: string; // YYYY-MM-DD
  expectedDeliveryDate?: string | undefined; // YYYY-MM-DD
  receivedDate?: string | undefined;
  missionId?: string | undefined;
  missionRef?: string | undefined;
  items: PurchaseOrderItem[];
  subtotalEur: number;
  taxRate: number; // Ex: 0.20 pour 20%
  taxEur: number;
  totalEur: number;
  notes?: string | undefined;
  deliveryNotes?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrderInput {
  supplierId: string;
  reference?: string | undefined;
  orderDate: string;
  expectedDeliveryDate?: string | undefined;
  missionId?: string | undefined;
  missionRef?: string | undefined;
  items: PurchaseOrderItemInput[];
  taxRate?: number | undefined;
  notes?: string | undefined;
  status?: PurchaseOrderStatus | undefined;
}

export interface PurchaseMetrics {
  totalOrders: number;
  ordersDraft: number;
  ordersPendingDelivery: number;
  ordersCompleted: number;
  totalSpendMonthEur: number;
  activeSuppliersCount: number;
}

export const PURCHASE_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  draft: 'Brouillon',
  sent: 'Envoyée / En attente',
  partially_received: 'Partiellement reçue',
  received: 'Reçue & Soldée',
  cancelled: 'Annulée',
};

export const PURCHASE_STATUS_VARIANTS: Record<
  PurchaseOrderStatus,
  'primary' | 'warning' | 'success' | 'error' | 'outline'
> = {
  draft: 'outline',
  sent: 'primary',
  partially_received: 'warning',
  received: 'success',
  cancelled: 'error',
};
