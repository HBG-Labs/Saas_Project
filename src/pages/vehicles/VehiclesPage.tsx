import {
  AlertTriangle,
  Car,
  CheckCircle2,
  Download,
  Plus,
  Search,
  Truck,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { ErrorState } from '@/components/feedback/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
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

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [historyVehicleId, setHistoryVehicleId] = useState<string | null>(null);

  const editingVehicle = useMemo(
    () => (editingVehicleId ? vehicles.find((v) => v.id === editingVehicleId) ?? null : null),
    [editingVehicleId, vehicles]
  );
  const historyVehicle = useMemo(
    () => (historyVehicleId ? vehicles.find((v) => v.id === historyVehicleId) ?? null : null),
    [historyVehicleId, vehicles]
  );

  // KPIs
  const totalCount = vehicles.length;
  const inServiceCount = vehicles.filter((v) => v.status === 'in_service').length;
  const availableCount = vehicles.filter((v) => v.status === 'available').length;

  const urgentAlertsCount = useMemo(() => {
    const now = new Date().getTime();
    return vehicles.filter((v) => {
      const daysCt = Math.ceil((new Date(v.nextCtDate).getTime() - now) / (1000 * 60 * 60 * 24));
      const daysRev = Math.ceil((new Date(v.nextRevisionDate).getTime() - now) / (1000 * 60 * 60 * 24));
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
      filteredVehicles
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
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Flotte & Véhicules d'intervention"
        description="Parc automobile, affectations des techniciens terrain, contrôle technique et suivi de maintenance."
        actions={
          <div className="flex items-center gap-2">
            {vehicles.length > 0 && (
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={handleExportCsv}
                title="Exporter la liste en CSV"
              >
                <Download className="size-4" />
                <span className="hidden sm:inline">Exporter CSV</span>
              </Button>
            )}
            <Button
              type="button"
              variant="primary"
              className="gap-2"
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total */}
        <Card className="border-border">
          <CardContent className="p-4 pt-4 sm:pt-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-3xs font-semibold text-muted-foreground uppercase tracking-wider">
                Total Flotte
              </p>
              <p className="text-2xl font-bold font-mono text-foreground">{totalCount}</p>
              <p className="text-3xs text-muted-foreground">Véhicules enregistrés</p>
            </div>
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Truck className="size-5" />
            </div>
          </CardContent>
        </Card>

        {/* En intervention */}
        <Card className="border-border">
          <CardContent className="p-4 pt-4 sm:pt-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-3xs font-semibold text-muted-foreground uppercase tracking-wider">
                Sur le terrain
              </p>
              <p className="text-2xl font-bold font-mono text-success">{inServiceCount}</p>
              <p className="text-3xs text-muted-foreground">
                {totalCount > 0 ? `${Math.round((inServiceCount / totalCount) * 100)}% de la flotte` : '0%'}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-success/10 text-success">
              <CheckCircle2 className="size-5" />
            </div>
          </CardContent>
        </Card>

        {/* Disponibles */}
        <Card className="border-border">
          <CardContent className="p-4 pt-4 sm:pt-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-3xs font-semibold text-muted-foreground uppercase tracking-wider">
                Disponibles
              </p>
              <p className="text-2xl font-bold font-mono text-primary">{availableCount}</p>
              <p className="text-3xs text-muted-foreground">Au dépôt / Libres</p>
            </div>
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Car className="size-5" />
            </div>
          </CardContent>
        </Card>

        {/* Alertes Entretien / CT */}
        <Card className={cn('border-border', urgentAlertsCount > 0 && 'border-warning/40 bg-warning/5')}>
          <CardContent className="p-4 pt-4 sm:pt-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-3xs font-semibold text-muted-foreground uppercase tracking-wider">
                Échéances Proches
              </p>
              <p className={cn('text-2xl font-bold font-mono', urgentAlertsCount > 0 ? 'text-warning' : 'text-foreground')}>
                {urgentAlertsCount}
              </p>
              <p className="text-3xs text-muted-foreground">CT ou révision &lt; 45j</p>
            </div>
            <div className="p-2.5 rounded-xl bg-warning/10 text-warning">
              <AlertTriangle className="size-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barre de filtres et recherche */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface p-3 rounded-2xl border border-border">
        {/* Recherche */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher une immatriculation, marque, modèle, conducteur..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-surface-hover/50 border border-border/80 rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Filtre statut */}
          <Select
            value={statusFilter}
            onValueChange={setStatusFilter}
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
        <div className="text-center py-12 px-4 bg-surface rounded-2xl border border-dashed border-border space-y-3">
          <div className="p-3 bg-surface-hover rounded-2xl w-fit mx-auto text-muted-foreground">
            <Truck className="size-6" />
          </div>
          <h3 className="text-sm font-bold text-foreground">Aucun véhicule trouvé</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {searchQuery || statusFilter !== 'all' || typeFilter !== 'all'
              ? 'Aucun véhicule ne correspond aux critères de recherche sélectionnés.'
              : 'Commencez par ajouter votre premier véhicule d’intervention.'}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
              setTypeFilter('all');
            }}
          >
            Réinitialiser les filtres
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
    </div>
  );
}
