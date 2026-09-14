import { Download, Plus } from 'lucide-react';
import { useState } from 'react';

import { ErrorState } from '@/components/feedback/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { useCurrentOrganization } from '@/features/organizations';
import { useStock } from '@/features/stock';
import { exportToCsv } from '@/lib/csv-export';
import { useDocumentTitle } from '@/lib/use-document-title';

import {
  PurchaseOrderFormModal,
  PurchasesKpiCards,
  PurchasesNavTabs,
  SupplierFormModal,
  SuppliersTable,
  usePurchases,
  type PurchaseOrderInput,
  type Supplier,
  type SupplierInput,
} from '@/features/purchases';

export default function SuppliersPage() {
  useDocumentTitle('Fournisseurs & Grossistes');

  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? null;

  const {
    suppliers,
    orders,
    metrics,
    createSupplier,
    updateSupplier,
    deleteSupplier,
    createOrder,
    isLoading,
    error,
    refreshPurchases,
  } = usePurchases(organizationId);

  const { consumables } = useStock(organizationId);

  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  const handleOpenAddSupplier = () => {
    setSelectedSupplier(null);
    setIsSupplierModalOpen(true);
  };

  const handleOpenEditSupplier = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setIsSupplierModalOpen(true);
  };

  const handleOpenCreateOrderForSupplier = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setIsOrderModalOpen(true);
  };

  const handleSupplierSubmit = async (input: SupplierInput) => {
    if (selectedSupplier) {
      await updateSupplier(selectedSupplier.id, input);
    } else {
      await createSupplier(input);
    }
  };

  const handleOrderSubmit = async (input: PurchaseOrderInput) => {
    await createOrder(input);
  };

  const handleExportCsv = () => {
    exportToCsv(
      `annuaire-fournisseurs-${new Date().toISOString().slice(0, 10)}`,
      [
        { header: 'Raison Sociale', accessor: (s) => s.name },
        { header: 'Code Fournisseur', accessor: (s) => s.code ?? '' },
        { header: 'Contact', accessor: (s) => s.contactName ?? '' },
        { header: 'Email', accessor: (s) => s.email ?? '' },
        { header: 'Téléphone', accessor: (s) => s.phone ?? '' },
        { header: 'Adresse', accessor: (s) => s.address ?? '' },
        { header: 'Code Postal', accessor: (s) => s.postalCode ?? '' },
        { header: 'Ville', accessor: (s) => s.city ?? '' },
        { header: 'Conditions Règlement', accessor: (s) => s.defaultPaymentTerms ?? '' },
        { header: 'SIRET', accessor: (s) => s.siret ?? '' },
        { header: 'TVA', accessor: (s) => s.vatNumber ?? '' },
        { header: 'Site Web', accessor: (s) => s.website ?? '' },
        { header: 'Notes', accessor: (s) => s.notes ?? '' },
      ],
      suppliers,
    );
  };

  if (isLoading) return <ListSkeleton />;

  if (error !== null && suppliers.length === 0 && orders.length === 0) {
    return (
      <ErrorState
        error={error}
        title="Fournisseurs indisponibles"
        onRetry={() => void refreshPurchases()}
      />
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <PageHeader
        title="Fournisseurs & grossistes"
        description="Centralisez vos contacts partenaires, leurs conditions de règlement et vos commandes directes."
        actions={
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              className="min-h-touch flex-1 gap-1.5 text-xs font-semibold sm:min-h-0 sm:flex-none"
              aria-label="Exporter les fournisseurs au format CSV"
            >
              <Download className="size-3.5" />
              <span>Export CSV</span>
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenAddSupplier}
              className="min-h-touch flex-[1.35] gap-1.5 text-xs font-semibold sm:min-h-0 sm:flex-none"
            >
              <Plus className="size-3.5" />
              <span>Nouveau fournisseur</span>
            </Button>
          </div>
        }
      />

      {/* Onglets de navigation Achats */}
      <PurchasesNavTabs pendingDeliveryCount={metrics.ordersPendingDelivery} />

      {/* KPI Cards */}
      <PurchasesKpiCards metrics={metrics} />

      {/* Tableau des fournisseurs */}
      <SuppliersTable
        suppliers={suppliers}
        orders={orders}
        onEdit={handleOpenEditSupplier}
        onDelete={deleteSupplier}
        onCreateOrder={handleOpenCreateOrderForSupplier}
      />

      {/* Montées seulement lorsqu'elles sont ouvertes — voir PurchaseOrdersPage. */}
      {isSupplierModalOpen ? (
        <SupplierFormModal
          isOpen
          onClose={() => setIsSupplierModalOpen(false)}
          onSubmit={handleSupplierSubmit}
          supplierToEdit={selectedSupplier}
        />
      ) : null}

      {isOrderModalOpen ? (
        <PurchaseOrderFormModal
          isOpen
          onClose={() => setIsOrderModalOpen(false)}
          onSubmit={handleOrderSubmit}
          suppliers={suppliers}
          consumables={consumables}
          initialSupplierId={selectedSupplier?.id}
        />
      ) : null}
    </div>
  );
}
