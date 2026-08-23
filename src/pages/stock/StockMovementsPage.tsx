import { ArrowDownLeft, Download } from 'lucide-react';
import { useState } from 'react';

import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
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
  } = useStock(organizationId);

  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<StockPeriod>('current_month');
  const [customMonth, setCustomMonth] = useState<string>(
    new Date().toISOString().slice(0, 7),
  );

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

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      {/* En-tête de page */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Grand Livre des Mouvements de Stock"
          description="Traçabilité complète des entrées fournisseurs, sorties chantiers, transferts véhicules et inventaires."
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
            onClick={() => setIsMovementModalOpen(true)}
            className="gap-1.5 text-xs font-semibold cursor-pointer"
          >
            <ArrowDownLeft className="size-3.5" />
            <span>Nouveau Mouvement</span>
          </Button>
        </div>
      </div>

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
