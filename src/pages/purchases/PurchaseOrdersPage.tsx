import { Download, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';

import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { useCurrentOrganization } from '@/features/organizations';
import { useStock, type StockConsumable } from '@/features/stock';
import { exportToCsv } from '@/lib/csv-export';
import { useDocumentTitle } from '@/lib/use-document-title';

import {
  PurchaseOrderFormModal,
  PurchaseOrdersTable,
  PurchaseOrderViewModal,
  PurchasesKpiCards,
  PurchasesNavTabs,
  ReceiveOrderModal,
  usePurchases,
  type PurchaseOrder,
  type PurchaseOrderInput,
  type PurchaseOrderItemInput,
} from '@/features/purchases';

export default function PurchaseOrdersPage() {
  useDocumentTitle('Commandes Fournisseurs');
  const location = useLocation();

  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? null;

  const {
    suppliers,
    orders,
    metrics,
    createOrder,
    updateOrder,
    deleteOrder,
    receiveOrder,
  } = usePurchases(organizationId);

  const { consumables } = useStock(organizationId);

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [initialSupplierId, setInitialSupplierId] = useState<string | undefined>(undefined);
  const [initialItems, setInitialItems] = useState<PurchaseOrderItemInput[] | undefined>(undefined);

  useEffect(() => {
    const prefill = (
      location.state as { prefillConsumable?: StockConsumable } | undefined
    )?.prefillConsumable;

    if (prefill && suppliers.length > 0) {
      const matchedSupplier = suppliers.find(
        (s) =>
          prefill.supplier &&
          s.name.trim().toLowerCase().includes(prefill.supplier.trim().toLowerCase()),
      );

      const qty = Math.max(1, (prefill.minThreshold || 5) * 2 - prefill.quantityInStock);

      setInitialSupplierId(matchedSupplier?.id || suppliers[0]?.id);
      setInitialItems([
        {
          consumableId: prefill.id,
          reference: prefill.reference,
          description: prefill.name,
          unit: prefill.unit || 'pièce',
          quantityOrdered: qty,
          unitPriceEur: prefill.unitPriceEur ?? 0,
        },
      ]);
      setSelectedOrder(null);
      setIsFormModalOpen(true);

      // Nettoyer l'état pour éviter de réouvrir au rechargement
      window.history.replaceState({}, document.title);
    }
  }, [location.state, suppliers]);

  const handleOpenCreateModal = () => {
    setSelectedOrder(null);
    setInitialSupplierId(undefined);
    setInitialItems(undefined);
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (order: PurchaseOrder) => {
    setSelectedOrder(order);
    setIsFormModalOpen(true);
  };

  const handleOpenViewModal = (order: PurchaseOrder) => {
    setSelectedOrder(order);
    setIsViewModalOpen(true);
  };

  const handleOpenReceiveModal = (order: PurchaseOrder) => {
    setSelectedOrder(order);
    setIsReceiveModalOpen(true);
  };

  const handleFormSubmit = async (input: PurchaseOrderInput) => {
    if (selectedOrder) {
      await updateOrder(selectedOrder.id, input);
    } else {
      await createOrder(input);
    }
  };

  const handleReceiveSubmit = async (
    orderId: string,
    receivedQuantities: Record<string, number>,
    deliveryNotes?: string,
  ) => {
    await receiveOrder(orderId, receivedQuantities, deliveryNotes);
  };

  const handleSendOrder = async (order: PurchaseOrder) => {
    if (
      confirm(
        `Confirmez-vous la transmission de la commande « ${order.reference} » auprès de ${order.supplierName} ?`,
      )
    ) {
      await updateOrder(order.id, { status: 'sent' });
    }
  };

  const handleExportCsv = () => {
    exportToCsv(
      `journal-commandes-fournisseurs-${new Date().toISOString().slice(0, 10)}`,
      [
        { header: 'Référence Commande', accessor: (o) => o.reference },
        { header: 'Fournisseur', accessor: (o) => o.supplierName },
        { header: 'Date Commande', accessor: (o) => o.orderDate },
        { header: 'Livraison Prévue', accessor: (o) => o.expectedDeliveryDate ?? '' },
        { header: 'Date Réception', accessor: (o) => o.receivedDate ?? '' },
        { header: 'Statut', accessor: (o) => o.status },
        { header: 'Réf. Chantier', accessor: (o) => o.missionRef ?? '' },
        { header: 'Nombre d’articles', accessor: (o) => o.items.length },
        { header: 'Montant Total HT (€)', accessor: (o) => o.subtotalEur.toFixed(2) },
        { header: 'Montant Total TTC (€)', accessor: (o) => o.totalEur.toFixed(2) },
        { header: 'Notes', accessor: (o) => o.notes ?? '' },
      ],
      orders,
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      {/* En-tête de page */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Commandes Fournisseurs & Approvisionnement"
          description="Émission de bons de commande (PO), suivi des livraisons et pointage avec mise à jour automatique du stock."
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className="gap-1.5 text-xs font-semibold cursor-pointer"
          >
            <Download className="size-3.5" />
            <span>Export CSV</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenCreateModal}
            className="gap-1.5 text-xs font-semibold cursor-pointer"
          >
            <Plus className="size-3.5" />
            <span>Nouvelle Commande</span>
          </Button>
        </div>
      </div>

      {/* Onglets de navigation Achats */}
      <PurchasesNavTabs pendingDeliveryCount={metrics.ordersPendingDelivery} />

      {/* KPI Cards */}
      <PurchasesKpiCards metrics={metrics} orders={orders} />

      {/* Tableau des commandes */}
      <PurchaseOrdersTable
        orders={orders}
        onView={handleOpenViewModal}
        onEdit={handleOpenEditModal}
        onDelete={deleteOrder}
        onReceive={handleOpenReceiveModal}
        onSend={handleSendOrder}
      />

      {/* Modale de création / édition de commande */}
      <PurchaseOrderFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSubmit={handleFormSubmit}
        orderToEdit={selectedOrder}
        suppliers={suppliers}
        consumables={consumables}
        initialSupplierId={initialSupplierId}
        initialItems={initialItems}
      />

      {/* Modale de réception de commande (Pointage BL) */}
      <ReceiveOrderModal
        isOpen={isReceiveModalOpen}
        onClose={() => setIsReceiveModalOpen(false)}
        onSubmit={handleReceiveSubmit}
        order={selectedOrder}
      />

      {/* Modale de consultation & impression du Bon de Commande */}
      <PurchaseOrderViewModal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        order={selectedOrder}
      />
    </div>
  );
}
