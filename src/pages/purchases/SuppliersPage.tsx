import { Download, Plus } from 'lucide-react';
import { useState } from 'react';

import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
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

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      {/* En-tête de page */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Répertoire Fournisseurs & Grossistes"
          description="Gestion des contacts partenaires, conditions de règlement, tarifs négociés et commandes directes."
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
            onClick={handleOpenAddSupplier}
            className="gap-1.5 text-xs font-semibold cursor-pointer"
          >
            <Plus className="size-3.5" />
            <span>Nouveau Fournisseur</span>
          </Button>
        </div>
      </div>

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
