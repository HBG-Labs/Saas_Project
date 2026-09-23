import { AlertTriangle, Car, CheckCircle2, Download, Plus, Search, Truck } from 'lucide-react';
import { useMemo, useState } from 'react';

import { AtelierIllustration } from '@/components/feedback/AtelierIllustration';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageShell } from '@/components/layout/PageShell';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { useCurrentOrganization } from '@/features/organizations';
import {
  AddVehicleModal,
  EditVehicleModal,
  VehicleCard,
  VehicleMaintenanceHistoryModal,
  useVehicles,
} from '@/features/vehicles';
import { TeamsNavTabs } from '@/features/teams';
import { cn } from '@/lib/cn';
import { exportToCsv } from '@/lib/csv-export';
import { useDocumentTitle } from '@/lib/use-document-title';

export default function VehiclesPage() {
  useDocumentTitle('Flotte & Véhicules');

  const { organization } = useCurrentOrganization();
  const orgId = organization?.id ?? '';

  const {
    vehicles,
    isLoading,
    error,
    addVehicle,
    updateVehicle,
    deleteVehicle,
    addMaintenanceRecord,
  } = useVehicles(orgId);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const hasActiveFilters =
    searchQuery.trim() !== '' || statusFilter !== 'all' || typeFilter !== 'all';

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [historyVehicleId, setHistoryVehicleId] = useState<string | null>(null);

  const editingVehicle = useMemo(
    () => (editingVehicleId ? (vehicles.find((v) => v.id === editingVehicleId) ?? null) : null),
    [editingVehicleId, vehicles],
  );
  const historyVehicle = useMemo(
    () => (historyVehicleId ? (vehicles.find((v) => v.id === historyVehicleId) ?? null) : null),
    [historyVehicleId, vehicles],
  );

  // KPIs
  const totalCount = vehicles.length;
  const inServiceCount = vehicles.filter((v) => v.status === 'in_service').length;
  const availableCount = vehicles.filter((v) => v.status === 'available').length;

  const urgentAlertsCount = useMemo(() => {
    const now = new Date().getTime();
    return vehicles.filter((v) => {
      const daysCt = Math.ceil((new Date(v.nextCtDate).getTime() - now) / (1000 * 60 * 60 * 24));
      const daysRev = Math.ceil(
        (new Date(v.nextRevisionDate).getTime() - now) / (1000 * 60 * 60 * 24),
      );
      return daysCt <= 45 || daysRev <= 30;
    }).length;
  }, [vehicles]);

  // Filtered vehicles list
  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesPlate = v.plate.toLowerCase().includes(q);
        const matchesBrand = v.brand.toLowerCase().includes(q);
        const matchesModel = v.model.toLowerCase().includes(q);
        const matchesMember = v.assignedMemberName?.toLowerCase().includes(q) ?? false;
        if (!matchesPlate && !matchesBrand && !matchesModel && !matchesMember) {
          return false;
        }
      }

      // Status
      if (statusFilter !== 'all' && v.status !== statusFilter) {
        return false;
      }

      // Type
      if (typeFilter !== 'all' && v.type !== typeFilter) {
        return false;
      }

      return true;
    });
  }, [vehicles, searchQuery, statusFilter, typeFilter]);

  const handleExportCsv = () => {
    exportToCsv(
      `flotte-vehicules-${new Date().toISOString().slice(0, 10)}`,
      [
        { header: 'Immatriculation', accessor: (v) => v.plate },
        { header: 'Marque', accessor: (v) => v.brand },
        { header: 'Modèle', accessor: (v) => v.model },
        { header: 'Type', accessor: (v) => v.type },
        { header: 'Statut', accessor: (v) => v.status },
        { header: 'Kilométrage (km)', accessor: (v) => v.mileage },
        { header: 'Conducteur assigné', accessor: (v) => v.assignedMemberName ?? 'Non assigné' },
        { header: 'Prochain Contrôle Technique', accessor: (v) => v.nextCtDate },
        { header: 'Prochaine Révision', accessor: (v) => v.nextRevisionDate },
        { header: 'Notes', accessor: (v) => v.notes ?? '' },
      ],
      filteredVehicles,
    );
  };

  // Le parc est désormais lu en base : une attente et une panne réseau sont
  // possibles, là où `localStorage` répondait toujours et instantanément. Les
  // taire afficherait une flotte vide, indistinguable d'une entreprise qui n'a
  // pas encore de véhicule.
  if (isLoading) {
    return <ListSkeleton />;
  }

  if (error !== null && vehicles.length === 0) {
    return <ErrorState error={error} />;
  }

  return (
    <PageShell>
      {/* Page Header */}
      <PageHeader
        title="Flotte & Véhicules d'intervention"
        description="Parc automobile, affectations des techniciens terrain, contrôle technique et suivi de maintenance."
        actions={
          <div className="flex w-full items-center gap-2 sm:w-auto">
            {vehicles.length > 0 && (
              <Button
                type="button"
                variant="outline"
                className="min-h-touch flex-1 gap-2 sm:min-h-0 sm:flex-none"
                onClick={handleExportCsv}
                title="Exporter la liste en CSV"
                aria-label="Exporter la flotte au format CSV"
              >
                <Download className="size-4" />
                <span className="hidden sm:inline">Exporter CSV</span>
              </Button>
            )}
            <Button
              type="button"
              variant="primary"
              className="min-h-touch flex-[1.35] gap-2 sm:min-h-0 sm:flex-none"
              onClick={() => setIsAddModalOpen(true)}
            >
              <Plus className="size-4" />
              <span>Ajouter un véhicule</span>
            </Button>
          </div>
        }
      />

      {/* Navigation commune Équipes, Membres et Flotte */}
      <TeamsNavTabs />

      {/* 4 KPIs Flotte */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {/* Total */}
        <Card className="before:bg-primary/70 hover:border-primary/35 hover:shadow-raised border-border/80 relative overflow-hidden shadow-xs transition-[border-color,box-shadow,transform] before:absolute before:inset-x-0 before:top-0 before:h-0.5 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0">
          <CardContent className="flex items-center justify-between p-3.5 pt-3.5 sm:p-4 sm:pt-4">
            <div className="space-y-0.5">
              <p className="text-3xs text-muted-foreground font-semibold tracking-wider uppercase">
                Total Flotte
              </p>
              <p className="text-foreground font-mono text-2xl font-bold">{totalCount}</p>
              <p className="text-3xs text-muted-foreground">Véhicules enregistrés</p>
            </div>
            <div className="bg-primary/10 text-primary rounded-xl p-2.5">
              <Truck className="size-5" />
            </div>
          </CardContent>
        </Card>

        {/* En intervention */}
        <Card className="before:bg-success/70 hover:border-success/35 hover:shadow-raised border-border/80 relative overflow-hidden shadow-xs transition-[border-color,box-shadow,transform] before:absolute before:inset-x-0 before:top-0 before:h-0.5 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0">
          <CardContent className="flex items-center justify-between p-3.5 pt-3.5 sm:p-4 sm:pt-4">
            <div className="space-y-0.5">
              <p className="text-3xs text-muted-foreground font-semibold tracking-wider uppercase">
                Sur le terrain
              </p>
              <p className="text-success font-mono text-2xl font-bold">{inServiceCount}</p>
              <p className="text-3xs text-muted-foreground">
                {totalCount > 0
                  ? `${Math.round((inServiceCount / totalCount) * 100)}% de la flotte`
                  : '0%'}
              </p>
            </div>
            <div className="bg-success/10 text-success rounded-xl p-2.5">
              <CheckCircle2 className="size-5" />
            </div>
          </CardContent>
        </Card>

        {/* Disponibles */}
        <Card className="before:bg-primary/70 hover:border-primary/35 hover:shadow-raised border-border/80 relative overflow-hidden shadow-xs transition-[border-color,box-shadow,transform] before:absolute before:inset-x-0 before:top-0 before:h-0.5 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0">
          <CardContent className="flex items-center justify-between p-3.5 pt-3.5 sm:p-4 sm:pt-4">
            <div className="space-y-0.5">
              <p className="text-3xs text-muted-foreground font-semibold tracking-wider uppercase">
                Disponibles
              </p>
              <p className="text-primary font-mono text-2xl font-bold">{availableCount}</p>
              <p className="text-3xs text-muted-foreground">Au dépôt / Libres</p>
            </div>
            <div className="bg-primary/10 text-primary rounded-xl p-2.5">
              <Car className="size-5" />
            </div>
          </CardContent>
        </Card>

        {/* Alertes Entretien / CT */}
        <Card
          className={cn(
            'before:bg-warning/70 hover:shadow-raised border-border/80 relative overflow-hidden shadow-xs transition-[border-color,box-shadow,transform] before:absolute before:inset-x-0 before:top-0 before:h-0.5 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0',
            urgentAlertsCount > 0 && 'border-warning/40 bg-warning/5',
          )}
        >
          <CardContent className="flex items-center justify-between p-3.5 pt-3.5 sm:p-4 sm:pt-4">
            <div className="space-y-0.5">
              <p className="text-3xs text-muted-foreground font-semibold tracking-wider uppercase">
                Échéances Proches
              </p>
              <p
                className={cn(
                  'font-mono text-2xl font-bold',
                  urgentAlertsCount > 0 ? 'text-warning' : 'text-foreground',
                )}
              >
                {urgentAlertsCount}
              </p>
              <p className="text-3xs text-muted-foreground">CT ou révision &lt; 45j</p>
            </div>
            <div className="bg-warning/10 text-warning rounded-xl p-2.5">
              <AlertTriangle className="size-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barre de filtres et recherche */}
      <div className="border-border bg-surface flex flex-col items-stretch justify-between gap-3 rounded-2xl border p-3 shadow-xs sm:flex-row sm:items-center sm:p-4">
        {/* Recherche */}
        <div className="flex-1">
          <Input
            type="text"
            placeholder="Rechercher une immatriculation, marque, modèle, conducteur..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            label="Rechercher un véhicule"
            hideLabel
            leadingIcon={<Search />}
            className="rounded-xl text-xs"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
          {/* Filtre statut */}
          <Select
            value={statusFilter}
            onValueChange={setStatusFilter}
            aria-label="Filtrer les véhicules par statut"
            className="min-w-0 sm:w-48"
            options={[
              { value: 'all', label: 'Tous les statuts' },
              { value: 'in_service', label: 'Sur le terrain' },
              { value: 'available', label: 'Disponibles au dépôt' },
              { value: 'maintenance', label: 'En maintenance' },
              { value: 'out_of_service', label: 'Hors service' },
            ]}
          />

          {/* Filtre type */}
          <Select
            value={typeFilter}
            onValueChange={setTypeFilter}
            aria-label="Filtrer les véhicules par type"
            className="min-w-0 sm:w-48"
            options={[
              { value: 'all', label: 'Tous les types' },
              { value: 'van', label: 'Fourgons / Ateliers' },
              { value: 'utility', label: 'Fourgonnettes' },
              { value: 'car', label: 'Véhicules Légers (VL)' },
              { value: 'aerial_lift', label: 'Nacelles' },
              { value: 'truck', label: 'Poids Lourds / Bennes' },
            ]}
          />
        </div>
      </div>

      {/* Liste des véhicules */}
      {filteredVehicles.length === 0 ? (
        <EmptyState
          {...(hasActiveFilters
            ? { icon: Truck }
            : { illustration: <AtelierIllustration subject="vehicles" /> })}
          title={hasActiveFilters ? 'Aucun véhicule trouvé' : 'Votre flotte commence ici'}
          description={
            hasActiveFilters
              ? 'Aucun véhicule ne correspond aux critères de recherche sélectionnés.'
              : 'Ajoutez votre premier véhicule d’intervention pour suivre son affectation, sa disponibilité et son entretien.'
          }
          action={
            hasActiveFilters ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setTypeFilter('all');
                }}
                className="min-h-touch sm:min-h-0"
              >
                Réinitialiser les filtres
              </Button>
            ) : (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setIsAddModalOpen(true)}
                className="min-h-touch gap-2 sm:min-h-0"
              >
                <Plus className="size-4" aria-hidden="true" />
                Ajouter le premier véhicule
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredVehicles.map((vehicle) => (
            <VehicleCard
              key={vehicle.id}
              vehicle={vehicle}
              onEdit={(v) => setEditingVehicleId(v.id)}
              onViewHistory={(v) => setHistoryVehicleId(v.id)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <AddVehicleModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        organizationId={orgId}
        onAdd={addVehicle}
      />

      {editingVehicle && (
        <EditVehicleModal
          vehicle={editingVehicle}
          isOpen={true}
          onClose={() => setEditingVehicleId(null)}
          organizationId={orgId}
          onUpdate={updateVehicle}
          onDelete={(id) => {
            deleteVehicle(id);
            setEditingVehicleId(null);
          }}
        />
      )}

      {historyVehicle && (
        <VehicleMaintenanceHistoryModal
          vehicle={historyVehicle}
          isOpen={true}
          onClose={() => setHistoryVehicleId(null)}
          onAddRecord={addMaintenanceRecord}
        />
      )}
    </PageShell>
  );
}
