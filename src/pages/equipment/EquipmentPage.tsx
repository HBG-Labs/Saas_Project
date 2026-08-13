import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Cpu,
  Pencil,
  Plus,
  Search,
  Trash2,
  User,
  Wrench,
} from 'lucide-react';
import { useState } from 'react';

import { ErrorState } from '@/components/feedback/ErrorState';
import { FormError } from '@/components/feedback/FormError';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
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
import { useDocumentTitle } from '@/lib/use-document-title';
import type { EquipmentCategory, EquipmentStatus } from '@/types/database';
import type { EquipmentWithAssignee } from '@/types/domain';

const CATEGORY_OPTIONS: { value: EquipmentCategory; label: string }[] = [
  { value: 'optique', label: 'Optique & Fibre FTTH' },
  { value: 'electricite', label: 'Électricité BT / HTA' },
  { value: 'radio', label: 'Réseaux IP & Radio' },
  { value: 'securite', label: 'Sécurité & EPI' },
  { value: 'autre', label: 'Autre' },
];

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
  const [filterCategory, setFilterCategory] = useState<'all' | EquipmentCategory>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | EquipmentStatus>('all');

  const equipmentQuery = useEquipmentList(organizationId, {
    ...(search.trim() !== '' ? { search: search.trim() } : {}),
    ...(filterCategory !== 'all' ? { category: filterCategory } : {}),
    ...(filterStatus !== 'all' ? { status: filterStatus } : {}),
  });

  // Le parc complet, non filtré, alimente les compteurs : afficher « 2 total »
  // parce qu'un filtre est actif n'aurait aucun sens sur un indicateur de parc.
  const parcQuery = useEquipmentList(organizationId);

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
    category: 'optique' as EquipmentCategory,
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
      category: 'optique',
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
        category: newEq.category,
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
          category: editing.category,
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

  const list = equipmentQuery.data ?? [];
  const parc = parcQuery.data ?? [];

  const totalCount = parc.length;
  const assignedCount = parc.filter((eq) => eq.status === 'assigned').length;
  const availableCount = parc.filter((eq) => eq.status === 'available').length;
  const maintenanceCount = parc.filter(
    (eq) => eq.status === 'maintenance' || eq.status === 'expired',
  ).length;

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

      {/* KPI Cards Header */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-blue-500/20 bg-surface p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Total Équipements</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{totalCount}</p>
            </div>
            <div className="flex size-10 items-center justify-center rounded-xl bg-blue-500/10 text-primary border border-blue-500/20">
              <Cpu className="size-5" />
            </div>
          </div>
        </Card>

        <Card className="border-emerald-500/20 bg-surface p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Attribués / Sur le terrain</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{assignedCount}</p>
            </div>
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <User className="size-5" />
            </div>
          </div>
        </Card>

        <Card className="border-border-strong bg-surface p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Disponibles en Stock</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{availableCount}</p>
            </div>
            <div className="flex size-10 items-center justify-center rounded-xl bg-surface-raised text-muted-foreground border border-border-strong">
              <CheckCircle2 className="size-5" />
            </div>
          </div>
        </Card>

        <Card className="border-amber-500/20 bg-surface p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">Étalonnage / Révision</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{maintenanceCount}</p>
            </div>
            <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
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
              className="w-full rounded-md border border-border-strong bg-surface py-2 pl-9 pr-4 text-xs text-foreground placeholder:text-subtle-foreground focus:border-primary focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as 'all' | EquipmentCategory)}
              aria-label="Filtrer par catégorie"
              className="rounded-md border border-border-strong bg-surface py-2 px-3 text-xs text-foreground focus:border-primary focus:outline-none"
            >
              <option value="all">Toutes catégories</option>
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as 'all' | EquipmentStatus)}
              aria-label="Filtrer par statut"
              className="rounded-md border border-border-strong bg-surface py-2 px-3 text-xs text-foreground focus:border-primary focus:outline-none"
            >
              <option value="all">Tous les statuts</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {EQUIPMENT_STATUS_LABELS[option.value]}
                </option>
              ))}
            </select>

            {canManage && (
              <Button
                variant="primary"
                onClick={() => setIsAddOpen(true)}
                className="cursor-pointer gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs"
              >
                <Plus className="size-4" />
                Nouveau matériel
              </Button>
            )}
          </div>
        </div>
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
                <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-2xs">
                  Attribué{assigneeName !== null ? ` · ${assigneeName}` : ''}
                </Badge>
              ) : eq.status === 'available' ? (
                <Badge variant="outline" className="border-blue-500/30 bg-blue-500/10 text-primary text-2xs">
                  Stock Disponible
                </Badge>
              ) : (
                <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-2xs">
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

                      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                        <span>
                          Matricule S/N :{' '}
                          <strong className="text-foreground font-mono">
                            {eq.serial_number ?? '—'}
                          </strong>
                        </span>
                        <span>•</span>
                        <span>
                          Catégorie :{' '}
                          <strong className="text-muted-foreground">
                            {EQUIPMENT_CATEGORY_LABELS[eq.category]}
                          </strong>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3" /> Prochain étalonnage :{' '}
                          <strong
                            className={
                              calibration === 'expired'
                                ? 'text-rose-600 dark:text-rose-400'
                                : calibration === 'due_soon'
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-muted-foreground'
                            }
                          >
                            {eq.next_calibration ?? 'Non spécifié'}
                          </strong>
                          {calibration === 'expired' && (
                            <span className="text-rose-600 dark:text-rose-400 font-semibold">— dépassé</span>
                          )}
                          {calibration === 'due_soon' && (
                            <span className="text-amber-600 dark:text-amber-400 font-semibold">— sous 30 jours</span>
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
                        onClick={() => removeEquipment.mutate(eq.id)}
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
              <select
                id="new-eq-category"
                value={newEq.category}
                onChange={(e) => setNewEq({ ...newEq, category: e.target.value as EquipmentCategory })}
                className="w-full rounded-md border border-border-strong bg-surface py-2 px-3 text-xs text-foreground focus:border-primary focus:outline-none"
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="new-eq-member" className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Affecter à un technicien
              </label>
              <select
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
              </select>
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
              className="cursor-pointer bg-blue-600 hover:bg-blue-500 text-white"
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
                <select
                  id="edit-eq-category"
                  value={editing.category}
                  onChange={(e) =>
                    setEditing({ ...editing, category: e.target.value as EquipmentCategory })
                  }
                  className="w-full rounded-md border border-border-strong bg-surface py-2 px-3 text-xs text-foreground focus:border-primary focus:outline-none"
                >
                  {CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="edit-eq-status" className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Statut du matériel
                </label>
                <select
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
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="edit-eq-member" className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Attribué au technicien
                </label>
                <select
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
                </select>
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
                className="cursor-pointer bg-blue-600 hover:bg-blue-500 text-white font-semibold"
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
