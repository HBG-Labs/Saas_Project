import { SelectField } from '@/components/ui/SelectField';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Cpu,
  Download,
  Pencil,
  Plus,
  Search,
  Trash2,
  User,
  Wrench,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { ErrorState } from '@/components/feedback/ErrorState';
import { FormError } from '@/components/feedback/FormError';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { exportToCsv } from '@/lib/csv-export';
import {
  EQUIPMENT_CATEGORY_LABELS,
  EQUIPMENT_STATUS_LABELS,
  calibrationState,
  useCreateEquipment,
  useDeleteEquipment,
  useEquipmentList,
  useUpdateEquipment,
} from '@/features/equipment';
import {
  memberDisplayName,
  PERMISSIONS,
  useCurrentOrganization,
  useMembers,
  usePermission,
} from '@/features/organizations';
import { useEquipmentCategories } from '@/features/industries';
import { StockNavTabs, useStock } from '@/features/stock';
import { useDocumentTitle } from '@/lib/use-document-title';
import type { EquipmentStatus } from '@/types/database';
import type { EquipmentWithAssignee } from '@/types/domain';


const STATUS_OPTIONS: { value: EquipmentStatus; label: string }[] = [
  { value: 'assigned', label: 'Attribué à un technicien' },
  { value: 'available', label: 'Disponible en Stock' },
  { value: 'maintenance', label: 'En Révision / Étalonnage' },
];

function inOneYear(): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

/** `''` plutôt que `null` : un `<input>` contrôlé ne doit jamais recevoir `null`. */
function toFormDate(value: string | null): string {
  return value ?? '';
}

/** `null` plutôt que `''` : la base distingue « pas de date » de « chaîne vide ». */
function toPatchDate(value: string): string | null {
  return value.trim() === '' ? null : value;
}

export default function EquipmentPage() {
  useDocumentTitle('Parc Matériel & Outillage');

  const { organization } = useCurrentOrganization();
  const { can } = usePermission();
  const organizationId = organization?.id ?? null;
  const canManage = can(PERMISSIONS.equipmentManage);

  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | EquipmentStatus>('all');
  const [filterCalibration, setFilterCalibration] = useState<'all' | 'valid' | 'due_soon' | 'expired'>('all');

  /*
    Categories du metier de l'entreprise, plus les communes.

    Remplacent les cinq valeurs de l'ancien enum, toutes issues du monde fibre :
    un frigoriste n'y rangeait ni ses stations de charge ni ses detecteurs de
    fuite, un paysagiste ni sa motoculture.
  */
  const categoriesQuery = useEquipmentCategories();
  const categories = categoriesQuery.data ?? [];

  const equipmentQuery = useEquipmentList(organizationId, {
    ...(search.trim() !== '' ? { search: search.trim() } : {}),
    ...(filterCategory !== 'all' ? { categoryId: filterCategory } : {}),
    ...(filterStatus !== 'all' ? { status: filterStatus } : {}),
  });

  // Le parc complet, non filtré, alimente les compteurs : afficher « 2 total »
  // parce qu'un filtre est actif n'aurait aucun sens sur un indicateur de parc.
  const parcQuery = useEquipmentList(organizationId);

  // Alimente le badge « sous le seuil » de StockNavTabs. Appelé ici, avec les
  // autres hooks de données : plus bas, il se serait trouvé derrière le retour
  // anticipé d'erreur, et l'ordre des hooks aurait changé d'un rendu à l'autre.
  const { lowStockArticles } = useStock(organizationId);

  const membersQuery = useMembers(organizationId);
  const members = (membersQuery.data ?? []).filter((member) => member.status === 'active');

  const createEquipment = useCreateEquipment(organizationId ?? '');
  const updateEquipment = useUpdateEquipment();
  const removeEquipment = useDeleteEquipment();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [newEq, setNewEq] = useState({
    name: '',
    brand: '',
    serialNumber: '',
    categoryId: '',
    status: 'available' as EquipmentStatus,
    assignedMemberId: '',
    nextCalibration: inOneYear(),
  });

  const [editing, setEditing] = useState<EquipmentWithAssignee | null>(null);

  const resetNewEq = () => {
    setNewEq({
      name: '',
      brand: '',
      serialNumber: '',
      categoryId: '',
      status: 'available',
      assignedMemberId: '',
      nextCalibration: inOneYear(),
    });
  };

  const handleAddSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError(null);

    if (newEq.name.trim() === '') return;

    createEquipment.mutate(
      {
        name: newEq.name.trim(),
        ...(newEq.categoryId !== '' ? { categoryId: newEq.categoryId } : {}),
        condition: 'neuf',
        assignedMemberId: newEq.assignedMemberId === '' ? null : newEq.assignedMemberId,
        lastCalibration: new Date().toISOString().slice(0, 10),
        nextCalibration: toPatchDate(newEq.nextCalibration),
        ...(newEq.brand.trim() !== '' ? { brand: newEq.brand.trim() } : {}),
        ...(newEq.serialNumber.trim() !== '' ? { serialNumber: newEq.serialNumber.trim() } : {}),
      },
      {
        onSuccess: () => {
          setIsAddOpen(false);
          resetNewEq();
        },
        onError: setSubmitError,
      },
    );
  };

  const handleEditSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError(null);
    if (editing === null) return;

    updateEquipment.mutate(
      {
        id: editing.id,
        patch: {
          name: editing.name,
          brand: editing.brand,
          serial_number: editing.serial_number,
          ...(editing.category_id !== null ? { categoryId: editing.category_id } : {}),
          status: editing.status,
          assigned_member_id: editing.assigned_member_id,
          next_calibration: editing.next_calibration,
        },
      },
      {
        onSuccess: () => setEditing(null),
        onError: setSubmitError,
      },
    );
  };

  const rawList = equipmentQuery.data ?? [];
  const list = useMemo(() => {
    if (filterCalibration === 'all') return rawList;
    return rawList.filter((eq) => calibrationState(eq.next_calibration) === filterCalibration);
  }, [rawList, filterCalibration]);

  const parc = parcQuery.data ?? [];

  const handleExportCsv = () => {
    exportToCsv(
      `parc-materiel-${new Date().toISOString().slice(0, 10)}`,
      [
        { header: 'Nom du matériel', accessor: (eq) => eq.name },
        { header: 'Marque', accessor: (eq) => eq.brand ?? '' },
        { header: 'Numéro de série / Matricule', accessor: (eq) => eq.serial_number ?? '' },
        {
          header: 'Catégorie',
          accessor: (eq) =>
            EQUIPMENT_CATEGORY_LABELS[eq.category_id as keyof typeof EQUIPMENT_CATEGORY_LABELS] ??
            eq.category_id ??
            '',
        },
        { header: 'Statut', accessor: (eq) => EQUIPMENT_STATUS_LABELS[eq.status] ?? eq.status },
        {
          header: 'Technicien assigné',
          accessor: (eq) => (eq.assigned_member ? memberDisplayName(eq.assigned_member) : 'Non assigné'),
        },
        { header: 'Prochain contrôle', accessor: (eq) => eq.next_calibration ?? '' },
        { header: 'État étalonnage', accessor: (eq) => calibrationState(eq.next_calibration) },
      ],
      list
    );
  };

  const totalCount = parc.length;
  const assignedCount = parc.filter((eq) => eq.status === 'assigned').length;
  const availableCount = parc.filter((eq) => eq.status === 'available').length;
  const maintenanceCount = parc.filter(
    (eq) => eq.status === 'maintenance' || eq.status === 'expired',
  ).length;

  const calibrationAlertsCount = useMemo(() => {
    return parc.filter((eq) => {
      const state = calibrationState(eq.next_calibration);
      return state === 'due_soon' || state === 'expired';
    }).length;
  }, [parc]);

  if (equipmentQuery.isError) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 pb-12">
        <PageHeader
          title="Parc Matériel & Outillage"
          description="Inventaire des appareils de mesure, soudeuses optiques, outils électriques et état d'étalonnage."
        />
        <ErrorState error={equipmentQuery.error} onRetry={() => void equipmentQuery.refetch()} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <PageHeader
        title="Parc Matériel & Outillage"
        description="Inventaire en direct des appareils de mesure, soudeuses optiques, outils électriques et état d'étalonnage."
      />

      {/* Onglets de navigation Stock unifiés */}
      <StockNavTabs lowStockCount={lowStockArticles.length} />

      {/* KPI Cards Header */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card className="border-primary/20 p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Total Équipements</p>
              <p className="text-foreground mt-1 text-xl font-bold sm:text-2xl">{totalCount}</p>
            </div>
            <div className="hidden size-10 shrink-0 items-center justify-center rounded-xl sm:flex bg-primary/10 text-primary border border-primary/20">
              <Cpu className="size-5" />
            </div>
          </div>
        </Card>

        <Card className="border-success/20 p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xs font-semibold uppercase tracking-wider text-success">Attribués / Sur le terrain</p>
              <p className="text-foreground mt-1 text-xl font-bold sm:text-2xl">{assignedCount}</p>
            </div>
            <div className="hidden size-10 shrink-0 items-center justify-center rounded-xl sm:flex bg-success/10 text-success border border-success/20">
              <User className="size-5" />
            </div>
          </div>
        </Card>

        <Card className="border-border-strong p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Disponibles en Stock</p>
              <p className="text-foreground mt-1 text-xl font-bold sm:text-2xl">{availableCount}</p>
            </div>
            <div className="hidden size-10 shrink-0 items-center justify-center rounded-xl sm:flex bg-surface-raised text-muted-foreground border border-border-strong">
              <CheckCircle2 className="size-5" />
            </div>
          </div>
        </Card>

        <Card className="border-warning/20 p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xs font-semibold uppercase tracking-wider text-warning">Étalonnage / Révision</p>
              <p className="text-foreground mt-1 text-xl font-bold sm:text-2xl">{maintenanceCount}</p>
            </div>
            <div className="hidden size-10 shrink-0 items-center justify-center rounded-xl sm:flex bg-warning/10 text-warning border border-warning/20">
              <AlertTriangle className="size-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Barre d'action et filtres */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher par nom, marque ou matricule S/N…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-border-strong bg-surface text-foreground placeholder:text-subtle-foreground focus:border-primary min-h-touch w-full rounded-md border py-2 pr-4 pl-9 text-xs focus:outline-none md:min-h-0"
            />
          </div>

          {/*
            Les deux filtres se partagent la ligne, l'action passe dessous et
            occupe toute la largeur : sur un téléphone, « Nouveau matériel » est
            le geste principal de cet écran, pas une commande secondaire coincée
            au bout d'une rangée.
          */}
          <div className="grid grid-cols-2 gap-2 md:flex md:items-center">
            <SelectField
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              aria-label="Filtrer par catégorie"
              className="border-border-strong bg-surface text-foreground focus:border-primary min-h-touch w-full rounded-md border px-3 py-2 text-xs focus:outline-none md:min-h-0 md:w-auto"
            >
              <option value="all">Toutes catégories</option>
              {categories.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </SelectField>

            <SelectField
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as 'all' | EquipmentStatus)}
              aria-label="Filtrer par statut"
              className="border-border-strong bg-surface text-foreground focus:border-primary min-h-touch w-full rounded-md border px-3 py-2 text-xs focus:outline-none md:min-h-0 md:w-auto"
            >
              <option value="all">Tous les statuts</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {EQUIPMENT_STATUS_LABELS[option.value]}
                </option>
              ))}
            </SelectField>

            <SelectField
              value={filterCalibration}
              onChange={(e) => setFilterCalibration(e.target.value as 'all' | 'valid' | 'due_soon' | 'expired')}
              aria-label="Filtrer par conformité étalonnage"
              className="border-border-strong bg-surface text-foreground focus:border-primary min-h-touch w-full rounded-md border px-3 py-2 text-xs focus:outline-none md:min-h-0 md:w-auto font-medium"
            >
              <option value="all">Tous contrôles</option>
              <option value="valid">✅ Étalonnage Conforme</option>
              <option value="due_soon">⚠️ Échéance &lt; 30 jours</option>
              <option value="expired">🚫 Étalonnage Expiré</option>
            </SelectField>

            {list.length > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={handleExportCsv}
                title="Exporter le matériel en CSV"
                className="col-span-2 min-h-touch cursor-pointer gap-2 text-xs md:col-span-1 md:min-h-0"
              >
                <Download className="size-4" />
                <span className="hidden sm:inline">Exporter CSV</span>
              </Button>
            )}

            {canManage && (
              <Button
                variant="primary"
                onClick={() => setIsAddOpen(true)}
                className="col-span-2 min-h-touch cursor-pointer gap-2 text-xs md:col-span-1 md:min-h-0"
              >
                <Plus className="size-4" />
                Nouveau matériel
              </Button>
            )}
          </div>
        </div>

        {calibrationAlertsCount > 0 && (
          <div className="mt-3 flex items-center gap-2.5 p-3 rounded-xl bg-warning/10 border border-warning/30 text-warning text-xs font-semibold">
            <AlertTriangle className="size-4 shrink-0 text-warning" />
            <span>
              <strong>Alerte Réglementaire :</strong> {calibrationAlertsCount} appareil(s) de mesure nécessite(nt) un étalonnage ou un contrôle périodique urgent pour rester conformes aux exigences des donneurs d'ordre.
            </span>
          </div>
        )}
      </Card>

      {/* Liste du Parc Matériel */}
      <div className="space-y-3">
        {equipmentQuery.isPending ? (
          <>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </>
        ) : (
          list.map((eq) => {
            const assigneeName =
              eq.assigned_member !== null ? memberDisplayName(eq.assigned_member) : null;

            const statusBadge =
              eq.status === 'assigned' ? (
                <Badge variant="outline" className="border-success/30 bg-success/10 text-success text-2xs">
                  Attribué{assigneeName !== null ? ` · ${assigneeName}` : ''}
                </Badge>
              ) : eq.status === 'available' ? (
                <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary text-2xs">
                  Stock Disponible
                </Badge>
              ) : (
                <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning text-2xs">
                  En Révision / Étalonnage
                </Badge>
              );

            const calibration = calibrationState(eq.next_calibration);

            return (
              <Card key={eq.id} className="p-4 hover:border-border-strong transition-colors">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-raised text-primary border border-border-strong mt-0.5">
                      <Wrench className="size-5" />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h3 className="text-sm font-semibold text-foreground">{eq.name}</h3>
                        {eq.brand !== null && eq.brand !== '' && (
                          <span className="rounded bg-surface-raised px-2 py-0.5 font-mono text-2xs text-muted-foreground">
                            {eq.brand}
                          </span>
                        )}
                        {statusBadge}
                      </div>

                      <div className="text-muted-foreground flex flex-col gap-1 text-xs sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                        <span>
                          Matricule S/N :{' '}
                          <strong className="text-foreground font-mono">
                            {eq.serial_number ?? '—'}
                          </strong>
                        </span>
                        <span className="hidden sm:inline">•</span>
                        <span>
                          Catégorie :{' '}
                          <strong className="text-muted-foreground">
                            {categories.find((c) => c.id === eq.category_id)?.label ?? (eq.category ? EQUIPMENT_CATEGORY_LABELS[eq.category] : 'Général')}
                          </strong>
                        </span>
                        <span className="hidden sm:inline">•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3" /> Prochain étalonnage :{' '}
                          <strong
                            className={
                              calibration === 'expired'
                                ? 'text-error'
                                : calibration === 'due_soon'
                                  ? 'text-warning'
                                  : 'text-muted-foreground'
                            }
                          >
                            {eq.next_calibration ?? 'Non spécifié'}
                          </strong>
                          {calibration === 'expired' && (
                            <span className="text-error font-semibold">— dépassé</span>
                          )}
                          {calibration === 'due_soon' && (
                            <span className="text-warning font-semibold">— sous 30 jours</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {canManage && (
                    <div className="flex items-center gap-1.5 self-end sm:self-center">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setEditing(eq)}
                        className="cursor-pointer text-muted-foreground hover:text-primary"
                        title="Modifier cet équipement"
                      >
                        <Pencil className="size-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          if (confirm(`Êtes-vous sûr de vouloir supprimer l'équipement « ${eq.name} » ?`)) {
                            removeEquipment.mutate(eq.id);
                          }
                        }}
                        className="cursor-pointer text-muted-foreground hover:text-error"
                        title="Supprimer"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })
        )}

        {!equipmentQuery.isPending && list.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground">
            <p className="text-sm">
              {totalCount === 0
                ? 'Aucun équipement enregistré. Ajoutez votre premier appareil de mesure.'
                : 'Aucun équipement ne correspond à votre recherche.'}
            </p>
          </Card>
        )}
      </div>

      {/* Modal d'ajout de matériel */}
      <Modal
        open={isAddOpen}
        onOpenChange={(open) => {
          setIsAddOpen(open);
          if (!open) setSubmitError(null);
        }}
        title="Ajouter un équipement au parc"
        description="Enregistrez un nouvel appareil de mesure, réflectomètre ou outil professionnel."
      >
        <form onSubmit={handleAddSubmit} className="space-y-4 pt-2">
          <FormError error={submitError} />

          <Input
            label="Nom de l'équipement"
            placeholder="ex: Soudeuse Optique Fujikura 90S"
            value={newEq.name}
            onChange={(e) => setNewEq({ ...newEq, name: e.target.value })}
            required
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Marque / Constructeur"
              placeholder="ex: VIAVI, Fujikura, Fluke"
              value={newEq.brand}
              onChange={(e) => setNewEq({ ...newEq, brand: e.target.value })}
            />
            <Input
              label="Matricule / Numéro de Série (S/N)"
              placeholder="ex: SN-98204"
              value={newEq.serialNumber}
              onChange={(e) => setNewEq({ ...newEq, serialNumber: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="new-eq-category" className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Catégorie technique
              </label>
              <SelectField
                id="new-eq-category"
                value={newEq.categoryId}
                onChange={(e) => setNewEq({ ...newEq, categoryId: e.target.value })}
                className="w-full rounded-md border border-border-strong bg-surface py-2 px-3 text-xs text-foreground focus:border-primary focus:outline-none"
              >
                {categories.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </SelectField>
            </div>

            <div>
              <label htmlFor="new-eq-member" className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Affecter à un technicien
              </label>
              <SelectField
                id="new-eq-member"
                value={newEq.assignedMemberId}
                onChange={(e) => setNewEq({ ...newEq, assignedMemberId: e.target.value })}
                className="w-full rounded-md border border-border-strong bg-surface py-2 px-3 text-xs text-foreground focus:border-primary focus:outline-none"
              >
                <option value="">Aucun — laisser en stock</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {memberDisplayName(member)}
                  </option>
                ))}
              </SelectField>
            </div>
          </div>

          <Input
            label="Date du prochain étalonnage"
            type="date"
            value={newEq.nextCalibration}
            onChange={(e) => setNewEq({ ...newEq, nextCalibration: e.target.value })}
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button variant="outline" type="button" onClick={() => setIsAddOpen(false)} className="cursor-pointer">
              Annuler
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={createEquipment.isPending}
              className="cursor-pointer bg-primary hover:bg-primary text-white"
            >
              {createEquipment.isPending ? 'Enregistrement…' : "Enregistrer l'équipement"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal d'édition d'équipement */}
      {editing !== null && (
        <Modal
          open
          onOpenChange={(open) => {
            if (!open) {
              setEditing(null);
              setSubmitError(null);
            }
          }}
          title="Modifier l'équipement"
          description="Mettez à jour le nom, le matricule S/N, l'affectation ou la date du prochain étalonnage."
        >
          <form onSubmit={handleEditSubmit} className="space-y-4 pt-2">
            <FormError error={submitError} />

            <Input
              label="Nom de l'équipement"
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              required
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="Marque / Constructeur"
                value={editing.brand ?? ''}
                onChange={(e) => setEditing({ ...editing, brand: e.target.value })}
              />
              <Input
                label="Matricule S/N"
                value={editing.serial_number ?? ''}
                onChange={(e) => setEditing({ ...editing, serial_number: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="edit-eq-category" className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Catégorie technique
                </label>
                <SelectField
                  id="edit-eq-category"
                  value={editing.category_id ?? ''}
                  onChange={(e) =>
                    setEditing({ ...editing, category_id: e.target.value })
                  }
                  className="w-full rounded-md border border-border-strong bg-surface py-2 px-3 text-xs text-foreground focus:border-primary focus:outline-none"
                >
                  {categories.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </SelectField>
              </div>

              <div>
                <label htmlFor="edit-eq-status" className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Statut du matériel
                </label>
                <SelectField
                  id="edit-eq-status"
                  value={editing.status}
                  onChange={(e) =>
                    setEditing({ ...editing, status: e.target.value as EquipmentStatus })
                  }
                  className="w-full rounded-md border border-border-strong bg-surface py-2 px-3 text-xs text-foreground focus:border-primary focus:outline-none"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {EQUIPMENT_STATUS_LABELS[option.value]}
                    </option>
                  ))}
                </SelectField>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="edit-eq-member" className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Attribué au technicien
                </label>
                <SelectField
                  id="edit-eq-member"
                  value={editing.assigned_member_id ?? ''}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      assigned_member_id: e.target.value === '' ? null : e.target.value,
                    })
                  }
                  className="w-full rounded-md border border-border-strong bg-surface py-2 px-3 text-xs text-foreground focus:border-primary focus:outline-none"
                >
                  <option value="">Aucun — retour en stock</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {memberDisplayName(member)}
                    </option>
                  ))}
                </SelectField>
              </div>

              <Input
                label="Date du prochain étalonnage"
                type="date"
                value={toFormDate(editing.next_calibration)}
                onChange={(e) =>
                  setEditing({ ...editing, next_calibration: toPatchDate(e.target.value) })
                }
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button
                variant="outline"
                type="button"
                onClick={() => setEditing(null)}
                className="cursor-pointer"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={updateEquipment.isPending}
                className="cursor-pointer bg-primary hover:bg-primary text-white font-semibold"
              >
                {updateEquipment.isPending ? 'Enregistrement…' : 'Enregistrer les modifications'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
