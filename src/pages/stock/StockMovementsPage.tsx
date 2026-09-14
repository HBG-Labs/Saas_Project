import { ArrowDownLeft, Download } from 'lucide-react';
import { useState } from 'react';

import { ErrorState } from '@/components/feedback/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { exportToCsv } from '@/lib/csv-export';
import { useDocumentTitle } from '@/lib/use-document-title';
import { useCurrentOrganization } from '@/features/organizations';
import {
  RecordMovementModal,
  StockKpiCards,
  StockMovementsTable,
  StockNavTabs,
  useStock,
  type StockMovementInput,
  type StockPeriod,
} from '@/features/stock';

export default function StockMovementsPage() {
  useDocumentTitle('Mouvements de Stock & Historique');

  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? null;

  const {
    consumables,
    movements,
    lowStockArticles,
    metrics,
    recordMovement,
    isLoading,
    error,
    refreshAll,
  } = useStock(organizationId);

  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<StockPeriod>('current_month');
  const [customMonth, setCustomMonth] = useState<string>(new Date().toISOString().slice(0, 7));

  const handleMovementSubmit = async (input: StockMovementInput) => {
    await recordMovement(input);
  };

  const handleExportCsv = () => {
    exportToCsv(
      `journal-mouvements-stock-${new Date().toISOString().slice(0, 10)}`,
      [
        { header: 'Date', accessor: (m) => m.date },
        { header: 'Type de mouvement', accessor: (m) => m.type },
        { header: 'Référence Article', accessor: (m) => m.consumableReference },
        { header: 'Désignation Article', accessor: (m) => m.consumableName },
        { header: 'Quantité', accessor: (m) => m.quantity },
        { header: 'Motif / Justification', accessor: (m) => m.reason },
        { header: 'Technicien', accessor: (m) => m.technicianName ?? '' },
        { header: 'Réf. Intervention', accessor: (m) => m.interventionRef ?? '' },
        { header: 'Emplacement Source', accessor: (m) => m.locationFrom ?? '' },
        { header: 'Emplacement Cible', accessor: (m) => m.locationTo ?? '' },
      ],
      movements,
    );
  };

  if (isLoading) return <ListSkeleton />;

  if (error !== null && consumables.length === 0 && movements.length === 0) {
    return (
      <ErrorState
        error={error}
        title="Mouvements de stock indisponibles"
        onRetry={() => void refreshAll()}
      />
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <PageHeader
        title="Mouvements de stock"
        description="Retrouvez chaque entrée, sortie chantier, transfert véhicule et correction d’inventaire."
        actions={
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              className="min-h-touch flex-1 gap-1.5 text-xs font-semibold sm:min-h-0 sm:flex-none"
              aria-label="Exporter les mouvements de stock au format CSV"
            >
              <Download className="size-3.5" />
              <span>Export CSV</span>
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsMovementModalOpen(true)}
              className="min-h-touch flex-[1.35] gap-1.5 text-xs font-semibold sm:min-h-0 sm:flex-none"
            >
              <ArrowDownLeft className="size-3.5" />
              <span>Nouveau mouvement</span>
            </Button>
          </div>
        }
      />

      {/* Onglets de navigation Stock */}
      <StockNavTabs lowStockCount={lowStockArticles.length} />

      {/* KPI Cards avec filtre de période synchronisé */}
      <StockKpiCards
        metrics={metrics}
        movements={movements}
        selectedPeriod={selectedPeriod}
        onPeriodChange={setSelectedPeriod}
        customMonth={customMonth}
        onCustomMonthChange={setCustomMonth}
      />

      {/* Tableau des mouvements avec pagination et filtre calendrier */}
      <StockMovementsTable
        movements={movements}
        selectedPeriod={selectedPeriod}
        onPeriodChange={setSelectedPeriod}
        customMonth={customMonth}
        onCustomMonthChange={setCustomMonth}
      />

      {/* Montée seulement lorsqu'elle est ouverte — voir StockConsumablesPage. */}
      {isMovementModalOpen ? (
        <RecordMovementModal
          isOpen
          onClose={() => setIsMovementModalOpen(false)}
          onSubmit={handleMovementSubmit}
          consumables={consumables}
        />
      ) : null}
    </div>
  );
}
