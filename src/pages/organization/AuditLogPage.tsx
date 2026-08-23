import {
  ChevronLeft,
  ChevronRight,
  Filter,
  RotateCcw,
  ScrollText,
  Search,
  User,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { AUDIT_ACTION_LABELS, describeAuditAction, useAuditLogs } from '@/features/audit';
import { OrganizationNavTabs, useCurrentOrganization } from '@/features/organizations';
import { cn } from '@/lib/cn';
import { useDocumentTitle } from '@/lib/use-document-title';

const ENTITY_LABELS: Record<string, string> = {
  mission: 'Mission',
  report: 'Compte rendu',
  member: 'Membre',
  organization_member: 'Membre',
  team: 'Équipe',
  customer: 'Client',
  supplier: 'Fournisseur',
  purchase_order: 'Achat',
  stock_consumable: 'Stock',
  stock_movement: 'Mouvement',
  leave_request: 'Congé',
  organization: 'Organisation',
};

const ENTITY_VARIANTS: Record<
  string,
  'neutral' | 'primary' | 'info' | 'success' | 'warning' | 'outline'
> = {
  mission: 'primary',
  report: 'info',
  member: 'neutral',
  organization_member: 'neutral',
  team: 'neutral',
  customer: 'info',
  supplier: 'warning',
  purchase_order: 'warning',
  stock_consumable: 'success',
  stock_movement: 'success',
  leave_request: 'warning',
  organization: 'neutral',
};

const PAGE_SIZE_OPTIONS = [
  { value: '15', label: '15 par page' },
  { value: '25', label: '25 par page' },
  { value: '50', label: '50 par page' },
  { value: '100', label: '100 par page' },
];

/**
 * Journal d'audit avec pagination réactive et filtres rapides.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUE CE JOURNAL VAUT
 *
 * Il est écrit exclusivement par des triggers PostgreSQL, et un trigger
 * d'immuabilité refuse toute modification ou suppression — y compris à un rôle
 * privilégié.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export default function AuditLogPage() {
  useDocumentTitle('Journal d’audit');

  const { organization } = useCurrentOrganization();
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const logs = useAuditLogs(organization?.id ?? null, {
    ...(action !== '' ? { action } : {}),
    ...(entityType !== '' ? { entityType } : {}),
  });

  const rawList = logs.data ?? [];

  // Filtrage local supplémentaire (recherche textuelle sur acteur ou description)
  const filteredList = useMemo(() => {
    if (!search.trim()) return rawList;
    const q = search.toLowerCase().trim();

    return rawList.filter((item) => {
      const actionDesc = describeAuditAction(item.action).toLowerCase();
      const entityLabel = (ENTITY_LABELS[item.entity_type] ?? item.entity_type).toLowerCase();
      const metadataStr = item.metadata ? JSON.stringify(item.metadata).toLowerCase() : '';
      const actorStr = item.actor_label ? item.actor_label.toLowerCase() : '';

      return (
        actionDesc.includes(q) ||
        entityLabel.includes(q) ||
        metadataStr.includes(q) ||
        actorStr.includes(q)
      );
    });
  }, [rawList, search]);

  // Pagination calculée sur la liste filtrée
  const totalItems = filteredList.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  const paginatedList = useMemo(() => {
    return filteredList.slice(startIndex, endIndex);
  }, [filteredList, startIndex, endIndex]);

  const handleActionChange = (val: string) => {
    setAction(val);
    setCurrentPage(1);
  };

  const handleEntityChange = (val: string) => {
    setEntityType(val);
    setCurrentPage(1);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setCurrentPage(1);
  };

  const handlePageSizeChange = (val: string) => {
    setPageSize(Number(val));
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setAction('');
    setEntityType('');
    setSearch('');
    setCurrentPage(1);
  };

  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const hasActiveFilters = action !== '' || entityType !== '' || search.trim() !== '';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Journal d'audit"
        description="Traçabilité inaltérable des actions de l’entreprise. Écrit par la base de données, accessible en lecture seule."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMobileFilters((prev) => !prev)}
            className="sm:hidden text-xs gap-1.5 cursor-pointer"
          >
            <Filter className="size-3.5" />
            <span>Filtres</span>
            {hasActiveFilters && (
              <span className="size-1.5 rounded-full bg-primary" />
            )}
          </Button>
        }
      />

      <OrganizationNavTabs />

      {/* Barre de Filtres & Recherche */}
      <Card className="border-border/80 shadow-xs">
        <CardContent className="p-3.5 sm:p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-12 items-center">
            {/* Recherche textuelle */}
            <div className="sm:col-span-4 relative">
              <Input
                value={search}
                onChange={handleSearchChange}
                placeholder="Rechercher une action, un auteur..."
                leadingIcon={<Search className="size-4 text-muted-foreground" />}
                className="h-9 text-xs"
                label="Rechercher"
                hideLabel
              />
            </div>

            {/* Filtre Action (visible sur desktop ou quand déplié sur mobile) */}
            <div className={cn('sm:col-span-3', !showMobileFilters && 'hidden sm:block')}>
              <Select
                options={[
                  { value: '', label: 'Toutes les actions' },
                  ...Object.entries(AUDIT_ACTION_LABELS).map(([value, label]) => ({
                    value,
                    label,
                  })),
                ]}
                value={action}
                onValueChange={handleActionChange}
                label="Action"
                hideLabel
              />
            </div>

            {/* Filtre Objet (visible sur desktop ou quand déplié sur mobile) */}
            <div className={cn('sm:col-span-3', !showMobileFilters && 'hidden sm:block')}>
              <Select
                options={[
                  { value: '', label: 'Tous les types d’objets' },
                  ...Object.entries(ENTITY_LABELS).map(([value, label]) => ({ value, label })),
                ]}
                value={entityType}
                onValueChange={handleEntityChange}
                label="Type d’objet"
                hideLabel
              />
            </div>

            {/* Taille de page & Réinitialisation */}
            <div className={cn('sm:col-span-2 flex items-center justify-between sm:justify-end gap-2', !showMobileFilters && 'hidden sm:flex')}>
              <Select
                options={PAGE_SIZE_OPTIONS}
                value={String(pageSize)}
                onValueChange={handlePageSizeChange}
                label="Nombre par page"
                hideLabel
              />

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetFilters}
                  className="h-9 px-2 text-xs text-subtle-foreground hover:text-foreground shrink-0"
                  title="Réinitialiser les filtres"
                >
                  <RotateCcw className="size-3.5" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contenu du Journal */}
      <Card className="border-border/80 shadow-modal overflow-hidden">
        {logs.isPending ? (
          <div className="p-6">
            <ListSkeleton />
          </div>
        ) : logs.isError ? (
          <div className="p-6">
            <ErrorState
              error={logs.error}
              onRetry={() => {
                void logs.refetch();
              }}
            />
          </div>
        ) : filteredList.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={ScrollText}
              title={hasActiveFilters ? 'Aucun événement correspondant' : 'Journal vide'}
              description={
                hasActiveFilters
                  ? 'Aucune action ne correspond à vos filtres actuels.'
                  : 'Les actions engageantes — création de mission, validation de compte rendu, modifications — apparaîtront ici.'
              }
              action={
                hasActiveFilters ? (
                  <Button variant="outline" size="sm" onClick={handleResetFilters}>
                    Effacer les filtres
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {/* Entête du tableau sur grands écrans */}
            <div className="hidden sm:grid sm:grid-cols-12 gap-3 px-4 py-2.5 bg-surface-sunken/80 text-2xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/60">
              <span className="col-span-2">Date & Heure</span>
              <span className="col-span-6">Action Réalisée</span>
              <span className="col-span-2">Auteur</span>
              <span className="col-span-2 text-right">Objet</span>
            </div>

            {/* Liste des entrées */}
            <ul className="divide-y divide-border/40">
              {paginatedList.map((entry) => {
                const dateObj = new Date(entry.created_at);
                const formattedDate = dateObj.toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                });
                const formattedTime = dateObj.toLocaleTimeString('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                const badgeVariant = ENTITY_VARIANTS[entry.entity_type] ?? 'outline';
                const entityLabel = ENTITY_LABELS[entry.entity_type] ?? entry.entity_type;

                return (
                  <li
                    key={entry.id}
                    className="p-3.5 sm:px-4 sm:py-3 hover:bg-surface-hover/50 transition-colors"
                  >
                    <div className="sm:grid sm:grid-cols-12 gap-3 items-center">
                      {/* Date & Heure */}
                      <div className="sm:col-span-2 flex items-center gap-1.5 text-subtle-foreground font-mono text-2xs tabular-nums mb-1 sm:mb-0">
                        <span className="font-semibold text-foreground/80">{formattedDate}</span>
                        <span>{formattedTime}</span>
                      </div>

                      {/* Libellé d'action */}
                      <div className="sm:col-span-6 text-foreground font-medium text-xs sm:text-sm min-w-0">
                        <span>{describeAuditAction(entry.action)}</span>
                      </div>

                      {/* Auteur */}
                      <div className="sm:col-span-2 flex items-center gap-1.5 text-xs text-muted-foreground mt-1 sm:mt-0">
                        <User className="size-3.5 shrink-0 text-subtle-foreground" />
                        <span className="truncate">{entry.actor_label ?? 'Système'}</span>
                      </div>

                      {/* Type d'entité Badge */}
                      <div className="sm:col-span-2 flex justify-end mt-1 sm:mt-0">
                        <Badge variant={badgeVariant} className="text-2xs font-semibold">
                          {entityLabel}
                        </Badge>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Barre de Pagination inférieure */}
            <div className="p-3.5 sm:p-4 bg-surface-sunken/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
              <div>
                Affichage de{' '}
                <span className="font-bold text-foreground">{startIndex + 1}</span> à{' '}
                <span className="font-bold text-foreground">{endIndex}</span> sur{' '}
                <span className="font-bold text-foreground">{totalItems}</span> action
                {totalItems > 1 ? 's' : ''}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={safeCurrentPage === 1}
                    className="h-8 px-2.5 text-xs"
                    title="Page précédente"
                  >
                    <ChevronLeft className="size-3.5 mr-1" />
                    <span>Précédent</span>
                  </Button>

                  <div className="flex items-center px-2 py-1 rounded-md bg-surface border border-border/80 text-xs font-mono font-bold text-foreground">
                    Page {safeCurrentPage} / {totalPages}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safeCurrentPage === totalPages}
                    className="h-8 px-2.5 text-xs"
                    title="Page suivante"
                  >
                    <span>Suivant</span>
                    <ChevronRight className="size-3.5 ml-1" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
