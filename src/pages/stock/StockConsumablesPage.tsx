import { ArrowDownLeft, Download, Plus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
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
            c.unitPriceEur !== undefined
              ? (c.quantityInStock * c.unitPriceEur).toFixed(2)
              : '',
        },
        { header: 'Emplacement', accessor: (c) => c.location },
        { header: 'Fournisseur', accessor: (c) => c.supplier ?? '' },
        { header: 'Notes', accessor: (c) => c.notes ?? '' },
      ],
      consumables,
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      {/* En-tête de page avec boutons d'action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Gestion des Stocks & Fournitures"
          description="Catalogue d’articles, gestion des seuils d'alerte, prix d'achat et suivi des quantités en temps réel."
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
            variant="outline"
            size="sm"
            onClick={() => handleOpenMovementModal(null, 'in')}
            className="gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 cursor-pointer"
          >
            <ArrowDownLeft className="size-3.5" />
            <span>Mouvement</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenAddModal}
            className="gap-1.5 text-xs font-semibold cursor-pointer"
          >
            <Plus className="size-3.5" />
            <span>Nouvel Article</span>
          </Button>
        </div>
      </div>

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

      {/* Modale d'ajout / modification d'un consommable */}
      <ConsumableFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSubmit={handleFormSubmit}
        consumableToEdit={selectedConsumable}
      />

      {/* Modale de déclaration de mouvement */}
      <RecordMovementModal
        isOpen={isMovementModalOpen}
        onClose={() => setIsMovementModalOpen(false)}
        onSubmit={handleMovementSubmit}
        consumables={consumables}
        initialConsumable={selectedConsumable}
        initialType={selectedMovementType}
      />
    </div>
  );
}
