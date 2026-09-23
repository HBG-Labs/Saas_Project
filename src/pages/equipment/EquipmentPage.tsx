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

import { AtelierIllustration } from '@/components/feedback/AtelierIllustration';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { FormError } from '@/components/feedback/FormError';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageShell } from '@/components/layout/PageShell';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
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
  const [filterCalibration, setFilterCalibration] = useState<
    'all' | 'valid' | 'due_soon' | 'expired'
  >('all');

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
  const [deleting, setDeleting] = useState<EquipmentWithAssignee | null>(null);

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

  const rawList = useMemo(() => equipmentQuery.data ?? [], [equipmentQuery.data]);
  const list = useMemo(() => {
    if (filterCalibration === 'all') return rawList;
    return rawList.filter((eq) => calibrationState(eq.next_calibration) === filterCalibration);
  }, [rawList, filterCalibration]);

  const parc = useMemo(() => parcQuery.data ?? [], [parcQuery.data]);

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
          accessor: (eq) =>
            eq.assigned_member ? memberDisplayName(eq.assigned_member) : 'Non assigné',
        },
        { header: 'Prochain contrôle', accessor: (eq) => eq.next_calibration ?? '' },
        { header: 'État étalonnage', accessor: (eq) => calibrationState(eq.next_calibration) },
      ],
      list,
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
      <PageShell>
        <PageHeader
          title="Parc Matériel & Outillage"
          description="Inventaire des appareils de mesure, soudeuses optiques, outils électriques et état d'étalonnage."
        />
        <ErrorState error={equipmentQuery.error} onRetry={() => void equipmentQuery.refetch()} />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Parc Matériel & Outillage"
        description="Inventaire en direct des appareils de mesure, soudeuses optiques, outils électriques et état d'étalonnage."
      />

      {/* Onglets de navigation Stock unifiés */}
      <StockNavTabs lowStockCount={lowStockArticles.length} />

      {/* KPI Cards Header */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card className="before:bg-primary/70 hover:border-primary/35 hover:shadow-raised relative overflow-hidden p-3 shadow-xs transition-[border-color,box-shadow,transform] before:absolute before:inset-x-0 before:top-0 before:h-0.5 motion-reduce:hover:translate-y-0 sm:p-4 sm:hover:-translate-y-0.5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xs text-muted-foreground font-semibold tracking-wider uppercase">
                Total Équipements
              </p>
              <p className="text-foreground mt-1 text-xl font-bold sm:text-2xl">{totalCount}</p>
            </div>
            <div className="bg-primary/10 text-primary border-primary/20 hidden size-10 shrink-0 items-center justify-center rounded-xl border sm:flex">
              <Cpu className="size-5" />
            </div>
          </div>
        </Card>

        <Card className="before:bg-success/70 hover:border-success/35 hover:shadow-raised relative overflow-hidden p-3 shadow-xs transition-[border-color,box-shadow,transform] before:absolute before:inset-x-0 before:top-0 before:h-0.5 motion-reduce:hover:translate-y-0 sm:p-4 sm:hover:-translate-y-0.5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xs text-success font-semibold tracking-wider uppercase">
                Attribués / Sur le terrain
              </p>
              <p className="text-foreground mt-1 text-xl font-bold sm:text-2xl">{assignedCount}</p>
            </div>
            <div className="bg-success/10 text-success border-success/20 hidden size-10 shrink-0 items-center justify-center rounded-xl border sm:flex">
              <User className="size-5" />
            </div>
          </div>
        </Card>

        <Card className="before:bg-primary/50 hover:border-primary/30 hover:shadow-raised relative overflow-hidden p-3 shadow-xs transition-[border-color,box-shadow,transform] before:absolute before:inset-x-0 before:top-0 before:h-0.5 motion-reduce:hover:translate-y-0 sm:p-4 sm:hover:-translate-y-0.5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xs text-muted-foreground font-semibold tracking-wider uppercase">
                Disponibles en Stock
              </p>
              <p className="text-foreground mt-1 text-xl font-bold sm:text-2xl">{availableCount}</p>
            </div>
            <div className="bg-surface-raised text-muted-foreground border-border-strong hidden size-10 shrink-0 items-center justify-center rounded-xl border sm:flex">
              <CheckCircle2 className="size-5" />
            </div>
          </div>
        </Card>

        <Card className="before:bg-warning/70 hover:border-warning/35 hover:shadow-raised relative overflow-hidden p-3 shadow-xs transition-[border-color,box-shadow,transform] before:absolute before:inset-x-0 before:top-0 before:h-0.5 motion-reduce:hover:translate-y-0 sm:p-4 sm:hover:-translate-y-0.5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xs text-warning font-semibold tracking-wider uppercase">
                Étalonnage / Révision
              </p>
              <p className="text-foreground mt-1 text-xl font-bold sm:text-2xl">
                {maintenanceCount}
              </p>
            </div>
            <div className="bg-warning/10 text-warning border-warning/20 hidden size-10 shrink-0 items-center justify-center rounded-xl border sm:flex">
              <AlertTriangle className="size-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Barre d'action et filtres */}
      <Card className="overflow-hidden rounded-2xl p-3.5 shadow-xs sm:p-4">
        <div className="flex flex-col items-stretch justify-between gap-3 md:flex-row md:items-center">
          <div className="flex-1">
            <Input
              type="text"
              placeholder="Rechercher par nom, marque ou matricule S/N…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              label="Rechercher un équipement"
              hideLabel
              leadingIcon={<Search />}
              className="rounded-xl text-xs"
            />
          </div>

          {/*
            Les deux filtres se partagent la ligne, l'action passe dessous et
            occupe toute la largeur : sur un téléphone, « Nouveau matériel » est
            le geste principal de cet écran, pas une commande secondaire coincée
            au bout d'une rangée.
          */}
          <div className="grid grid-cols-2 gap-2 md:flex md:items-center">
            <Select
              value={filterCategory}
              onValueChange={setFilterCategory}
              aria-label="Filtrer par catégorie"
              className="min-w-0 md:w-44"
              options={[
                { value: 'all', label: 'Toutes catégories' },
                ...categories.map((option) => ({ value: option.id, label: option.label })),
              ]}
            />

            <Select
              value={filterStatus}
              onValueChange={(value) => setFilterStatus(value as 'all' | EquipmentStatus)}
              aria-label="Filtrer par statut"
              className="min-w-0 md:w-44"
              options={[
                { value: 'all', label: 'Tous les statuts' },
                ...STATUS_OPTIONS.map((option) => ({
                  value: option.value,
                  label: EQUIPMENT_STATUS_LABELS[option.value],
                })),
              ]}
            />

            <Select
              value={filterCalibration}
              onValueChange={(value) =>
                setFilterCalibration(value as 'all' | 'valid' | 'due_soon' | 'expired')
              }
              aria-label="Filtrer par conformité étalonnage"
              className="col-span-2 min-w-0 md:col-span-1 md:w-48"
              options={[
                { value: 'all', label: 'Tous les contrôles' },
                { value: 'valid', label: 'Étalonnage conforme' },
                { value: 'due_soon', label: 'Échéance sous 30 jours' },
                { value: 'expired', label: 'Étalonnage expiré' },
              ]}
            />

            {list.length > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={handleExportCsv}
                title="Exporter le matériel en CSV"
                className="min-h-touch col-span-2 cursor-pointer gap-2 text-xs md:col-span-1 md:min-h-0"
              >
                <Download className="size-4" />
                <span className="hidden sm:inline">Exporter CSV</span>
              </Button>
            )}

            {canManage && (
              <Button
                variant="primary"
                onClick={() => setIsAddOpen(true)}
                className="min-h-touch col-span-2 cursor-pointer gap-2 text-xs md:col-span-1 md:min-h-0"
              >
                <Plus className="size-4" />
                Nouveau matériel
              </Button>
            )}
          </div>
        </div>

        {calibrationAlertsCount > 0 && (
          <div className="bg-warning/10 border-warning/30 text-warning mt-3 flex items-center gap-2.5 rounded-xl border p-3 text-xs font-semibold">
            <AlertTriangle className="text-warning size-4 shrink-0" />
            <span>
              <strong>Alerte Réglementaire :</strong> {calibrationAlertsCount} appareil(s) de mesure
              nécessite(nt) un étalonnage ou un contrôle périodique urgent pour rester conformes aux
              exigences des donneurs d'ordre.
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
                <Badge
                  variant="outline"
                  className="border-success/30 bg-success/10 text-success text-2xs"
                >
                  Attribué{assigneeName !== null ? ` · ${assigneeName}` : ''}
                </Badge>
              ) : eq.status === 'available' ? (
                <Badge
                  variant="outline"
                  className="border-primary/30 bg-primary/10 text-primary text-2xs"
                >
                  Stock Disponible
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-warning/30 bg-warning/10 text-warning text-2xs"
                >
                  En Révision / Étalonnage
                </Badge>
              );

            const calibration = calibrationState(eq.next_calibration);

            return (
              <Card
                key={eq.id}
                className="hover:border-primary/25 hover:shadow-raised focus-within:border-primary/30 p-4 transition-[border-color,box-shadow,transform] motion-reduce:hover:translate-y-0 sm:hover:-translate-y-0.5"
              >
                <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                  <div className="flex items-start gap-3.5">
                    <div className="bg-surface-raised text-primary border-border-strong mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl border">
                      <Wrench className="size-5" />
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h3 className="text-foreground text-sm font-semibold">{eq.name}</h3>
                        {eq.brand !== null && eq.brand !== '' && (
                          <span className="bg-surface-raised text-2xs text-muted-foreground rounded px-2 py-0.5 font-mono">
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
                            {categories.find((c) => c.id === eq.category_id)?.label ??
                              (eq.category ? EQUIPMENT_CATEGORY_LABELS[eq.category] : 'Général')}
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
                        className="text-muted-foreground hover:text-primary cursor-pointer"
                        title="Modifier cet équipement"
                        aria-label={`Modifier ${eq.name}`}
                      >
                        <Pencil className="size-4" />
                      </Button>

                      <Button
                        variant="danger-outline"
                        size="icon-sm"
                        onClick={() => setDeleting(eq)}
                        className="cursor-pointer"
                        title="Supprimer"
                        aria-label={`Supprimer ${eq.name}`}
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

        {!equipmentQuery.isPending &&
          list.length === 0 &&
          (totalCount === 0 ? (
            <EmptyState
              illustration={<AtelierIllustration subject="equipment" />}
              title="Votre parc matériel est prêt à démarrer"
              description="Ajoutez votre premier appareil de mesure pour suivre son affectation, son état et sa prochaine vérification."
              {...(canManage
                ? {
                    action: (
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => setIsAddOpen(true)}
                      >
                        <Plus className="size-4" aria-hidden="true" />
                        Ajouter un équipement
                      </Button>
                    ),
                  }
                : {})}
            />
          ) : (
            <Card className="text-muted-foreground p-8 text-center">
              <p className="text-sm">Aucun équipement ne correspond à votre recherche.</p>
            </Card>
          ))}
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
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="w-full sm:w-auto"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              form="add-equipment-form"
              variant="primary"
              disabled={createEquipment.isPending}
              isLoading={createEquipment.isPending}
              loadingLabel="Enregistrement de l’équipement"
              className="w-full sm:w-auto"
            >
              Enregistrer l'équipement
            </Button>
          </div>
        }
      >
        <form id="add-equipment-form" onSubmit={handleAddSubmit} className="space-y-4">
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
            <Select
              id="new-eq-category"
              label="Catégorie technique"
              value={newEq.categoryId || undefined}
              onValueChange={(value) => setNewEq({ ...newEq, categoryId: value })}
              placeholder="Choisir une catégorie"
              options={categories.map((option) => ({ value: option.id, label: option.label }))}
            />

            <Select
              id="new-eq-member"
              label="Affecter à un technicien"
              value={newEq.assignedMemberId || 'unassigned'}
              onValueChange={(value) =>
                setNewEq({ ...newEq, assignedMemberId: value === 'unassigned' ? '' : value })
              }
              options={[
                { value: 'unassigned', label: 'Aucun — laisser en stock' },
                ...members.map((member) => ({
                  value: member.id,
                  label: memberDisplayName(member),
                })),
              ]}
            />
          </div>

          <Input
            label="Date du prochain étalonnage"
            type="date"
            value={newEq.nextCalibration}
            onChange={(e) => setNewEq({ ...newEq, nextCalibration: e.target.value })}
          />
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
          footer={
            <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                type="button"
                onClick={() => setEditing(null)}
                className="w-full sm:w-auto"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                form="edit-equipment-form"
                variant="primary"
                disabled={updateEquipment.isPending}
                isLoading={updateEquipment.isPending}
                loadingLabel="Enregistrement des modifications"
                className="w-full sm:w-auto"
              >
                Enregistrer les modifications
              </Button>
            </div>
          }
        >
          <form id="edit-equipment-form" onSubmit={handleEditSubmit} className="space-y-4">
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
              <Select
                id="edit-eq-category"
                label="Catégorie technique"
                value={editing.category_id ?? undefined}
                onValueChange={(value) => setEditing({ ...editing, category_id: value })}
                placeholder="Choisir une catégorie"
                options={categories.map((option) => ({ value: option.id, label: option.label }))}
              />

              <Select
                id="edit-eq-status"
                label="Statut du matériel"
                value={editing.status}
                onValueChange={(value) =>
                  setEditing({ ...editing, status: value as EquipmentStatus })
                }
                options={STATUS_OPTIONS.map((option) => ({
                  value: option.value,
                  label: EQUIPMENT_STATUS_LABELS[option.value],
                }))}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select
                id="edit-eq-member"
                label="Attribué au technicien"
                value={editing.assigned_member_id ?? 'unassigned'}
                onValueChange={(value) =>
                  setEditing({
                    ...editing,
                    assigned_member_id: value === 'unassigned' ? null : value,
                  })
                }
                options={[
                  { value: 'unassigned', label: 'Aucun — retour en stock' },
                  ...members.map((member) => ({
                    value: member.id,
                    label: memberDisplayName(member),
                  })),
                ]}
              />

              <Input
                label="Date du prochain étalonnage"
                type="date"
                value={toFormDate(editing.next_calibration)}
                onChange={(e) =>
                  setEditing({ ...editing, next_calibration: toPatchDate(e.target.value) })
                }
              />
            </div>
          </form>
        </Modal>
      )}

      <Modal
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Supprimer l’équipement"
        description={
          deleting
            ? `« ${deleting.name} » sera retiré définitivement du parc.`
            : 'Confirmez la suppression de cet équipement.'
        }
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              disabled={removeEquipment.isPending}
              onClick={() => setDeleting(null)}
              className="w-full sm:w-auto"
            >
              Annuler
            </Button>
            <Button
              variant="danger"
              disabled={removeEquipment.isPending}
              isLoading={removeEquipment.isPending}
              loadingLabel="Suppression de l’équipement"
              onClick={() => {
                if (deleting) {
                  removeEquipment.mutate(deleting.id, {
                    onSuccess: () => setDeleting(null),
                  });
                }
              }}
              className="w-full sm:w-auto"
            >
              Supprimer définitivement
            </Button>
          </div>
        }
      >
        <p className="text-muted-foreground text-sm">
          Cette action ne peut pas être annulée. Vérifiez que le matériel n’est plus affecté à un
          technicien avant de continuer.
        </p>
      </Modal>
    </PageShell>
  );
}
