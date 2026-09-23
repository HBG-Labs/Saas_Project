import { ArrowDownLeft, Download, Plus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { ErrorState } from '@/components/feedback/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageShell } from '@/components/layout/PageShell';
import { Button } from '@/components/ui/Button';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { ROUTES } from '@/config/routes';
import { exportToCsv } from '@/lib/csv-export';
import { useDocumentTitle } from '@/lib/use-document-title';
import { useCurrentOrganization } from '@/features/organizations';
import {
  ConsumableFormModal,
  ConsumablesTable,
  RecordMovementModal,
  StockAlertsBanner,
  StockKpiCards,
  StockNavTabs,
  useStock,
  type ConsumableInput,
  type StockConsumable,
  type StockMovementInput,
  type StockMovementType,
} from '@/features/stock';

export default function StockConsumablesPage() {
  useDocumentTitle('Fournitures & Consommables');
  const navigate = useNavigate();

  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? null;

  const {
    consumables,
    movements,
    lowStockArticles,
    metrics,
    addConsumable,
    updateConsumable,
    deleteConsumable,
    recordMovement,
    quickAdjust,
    isLoading,
    error,
    refreshAll,
  } = useStock(organizationId);

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [selectedConsumable, setSelectedConsumable] = useState<StockConsumable | null>(null);
  const [selectedMovementType, setSelectedMovementType] = useState<StockMovementType>('in');

  const handleOpenAddModal = () => {
    setSelectedConsumable(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (item: StockConsumable) => {
    setSelectedConsumable(item);
    setIsFormModalOpen(true);
  };

  const handleOpenMovementModal = (
    item?: StockConsumable | null,
    defaultType: StockMovementType = 'in',
  ) => {
    setSelectedConsumable(item ?? null);
    setSelectedMovementType(defaultType);
    setIsMovementModalOpen(true);
  };

  const handleOrderConsumable = (article: StockConsumable) => {
    void navigate(ROUTES.purchaseOrders, {
      state: { prefillConsumable: article },
    });
  };

  const handleFormSubmit = async (input: ConsumableInput) => {
    if (selectedConsumable) {
      await updateConsumable(selectedConsumable.id, input);
    } else {
      await addConsumable(input);
    }
  };

  const handleMovementSubmit = async (input: StockMovementInput) => {
    await recordMovement(input);
  };

  const handleExportCsv = () => {
    exportToCsv(
      `inventaire-stock-${new Date().toISOString().slice(0, 10)}`,
      [
        { header: 'Référence / SKU', accessor: (c) => c.reference },
        { header: 'Désignation', accessor: (c) => c.name },
        { header: 'Catégorie', accessor: (c) => c.category },
        { header: 'Quantité en Stock', accessor: (c) => c.quantityInStock },
        { header: 'Unité', accessor: (c) => c.unit },
        { header: 'Seuil Alerte Min', accessor: (c) => c.minThreshold },
        {
          header: 'Prix Achat Unitaire HT (€)',
          accessor: (c) => (c.unitPriceEur !== undefined ? c.unitPriceEur.toFixed(2) : ''),
        },
        {
          header: 'Prix Vente Unitaire HT (€)',
          accessor: (c) => (c.sellingPriceEur !== undefined ? c.sellingPriceEur.toFixed(2) : ''),
        },
        {
          header: 'Valeur Totale HT (€)',
          accessor: (c) =>
            c.unitPriceEur !== undefined ? (c.quantityInStock * c.unitPriceEur).toFixed(2) : '',
        },
        { header: 'Emplacement', accessor: (c) => c.location },
        { header: 'Fournisseur', accessor: (c) => c.supplier ?? '' },
        { header: 'Notes', accessor: (c) => c.notes ?? '' },
      ],
      consumables,
    );
  };

  if (isLoading) return <ListSkeleton />;

  if (error !== null && consumables.length === 0 && movements.length === 0) {
    return (
      <ErrorState error={error} title="Stock indisponible" onRetry={() => void refreshAll()} />
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Stocks & fournitures"
        description="Pilotez vos articles, seuils d’alerte, prix d’achat et quantités disponibles."
        actions={
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              className="min-h-touch gap-1.5 text-xs font-semibold sm:min-h-0"
              aria-label="Exporter l’inventaire au format CSV"
            >
              <Download className="size-3.5" />
              <span>Export CSV</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenMovementModal(null, 'in')}
              className="min-h-touch border-success/30 text-success hover:bg-success/10 gap-1.5 text-xs font-semibold sm:min-h-0"
            >
              <ArrowDownLeft className="size-3.5" />
              <span>Mouvement</span>
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenAddModal}
              className="min-h-touch col-span-2 gap-1.5 text-xs font-semibold sm:min-h-0"
            >
              <Plus className="size-3.5" />
              <span>Nouvel article</span>
            </Button>
          </div>
        }
      />

      {/* Onglets de navigation Stock unifiée */}
      <StockNavTabs lowStockCount={lowStockArticles.length} />

      {/* KPI Cards */}
      <StockKpiCards metrics={metrics} movements={movements} />

      {/* Bandeau d'alerte si des stocks sont sous le seuil critique */}
      <StockAlertsBanner
        lowStockArticles={lowStockArticles}
        onOrder={handleOrderConsumable}
        onMovement={(article) => handleOpenMovementModal(article, 'in')}
      />

      {/* Tableau des consommables */}
      <ConsumablesTable
        consumables={consumables}
        onEdit={handleOpenEditModal}
        onDelete={deleteConsumable}
        onQuickAdjust={(id, delta) => void quickAdjust(id, delta)}
        onRecordMovement={(item, defaultType) => handleOpenMovementModal(item, defaultType)}
        onOrder={handleOrderConsumable}
      />

      {/* Montée seulement lorsqu'elle est ouverte — voir la modale de mouvement. */}
      {isFormModalOpen ? (
        <ConsumableFormModal
          isOpen
          onClose={() => setIsFormModalOpen(false)}
          onSubmit={handleFormSubmit}
          consumableToEdit={selectedConsumable}
        />
      ) : null}

      {/*
        Montée seulement lorsqu'elle est ouverte : la modale repart ainsi d'un
        formulaire vierge à chaque ouverture, sans avoir à recopier les props
        dans son état par un effet.
      */}
      {isMovementModalOpen ? (
        <RecordMovementModal
          isOpen
          onClose={() => setIsMovementModalOpen(false)}
          onSubmit={handleMovementSubmit}
          consumables={consumables}
          initialConsumable={selectedConsumable}
          initialType={selectedMovementType}
        />
      ) : null}
    </PageShell>
  );
}
