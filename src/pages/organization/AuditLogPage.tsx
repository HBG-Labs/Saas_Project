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

  const rawList = useMemo(() => logs.data ?? [], [logs.data]);

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
  const activeFilterCount = [action, entityType, search.trim()].filter(Boolean).length;

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
            leadingIcon={<Filter />}
            className="sm:hidden"
            aria-expanded={showMobileFilters}
          >
            <span>Filtres</span>
            {hasActiveFilters && (
              <Badge variant="primary" className="ml-1 min-w-5 justify-center px-1.5">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        }
      />

      <OrganizationNavTabs />

      {/* Barre de Filtres & Recherche */}
      <Card className="border-border/80 bg-surface-raised shadow-xs">
        <CardContent className="space-y-3 p-3.5 sm:p-4">
          <div className="grid items-center gap-3 sm:grid-cols-12">
            {/* Recherche textuelle */}
            <div className="relative sm:col-span-4">
              <Input
                value={search}
                onChange={handleSearchChange}
                placeholder="Rechercher une action, un auteur..."
                leadingIcon={<Search className="text-muted-foreground size-4" />}
                className="text-xs"
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
            <div
              className={cn(
                'flex items-center justify-between gap-2 sm:col-span-2 sm:justify-end',
                !showMobileFilters && 'hidden sm:flex',
              )}
            >
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
                  className="text-subtle-foreground hover:text-foreground shrink-0 px-2"
                  title="Réinitialiser les filtres"
                  aria-label="Réinitialiser les filtres"
                >
                  <RotateCcw className="size-3.5" />
                </Button>
              )}
            </div>
          </div>
          {hasActiveFilters ? (
            <div className="border-border text-muted-foreground flex flex-col gap-2 border-t pt-3 text-xs sm:flex-row sm:items-center sm:justify-between">
              <span>
                {totalItems} résultat{totalItems > 1 ? 's' : ''} avec {activeFilterCount} filtre
                {activeFilterCount > 1 ? 's' : ''} actif{activeFilterCount > 1 ? 's' : ''}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                leadingIcon={<RotateCcw />}
                className="text-primary self-start sm:self-auto"
              >
                Tout effacer
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Contenu du Journal */}
      <Card className="border-border/80 shadow-raised overflow-hidden">
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
          <div className="divide-border/60 divide-y">
            <div className="border-border/60 bg-surface-raised flex items-center justify-between gap-3 border-b px-4 py-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-lg">
                  <ScrollText className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-foreground text-sm font-semibold">Activité récente</p>
                  <p className="text-muted-foreground text-xs">
                    {totalItems} événement{totalItems > 1 ? 's' : ''} consultable
                    {totalItems > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="hidden sm:inline-flex">
                Lecture seule
              </Badge>
            </div>
            {/* Entête du tableau sur grands écrans */}
            <div className="border-border/60 bg-surface-sunken/80 text-2xs text-muted-foreground hidden gap-3 border-b px-4 py-2.5 font-bold tracking-wider uppercase sm:grid sm:grid-cols-12">
              <span className="col-span-2">Date & Heure</span>
              <span className="col-span-6">Action Réalisée</span>
              <span className="col-span-2">Auteur</span>
              <span className="col-span-2 text-right">Objet</span>
            </div>

            {/* Liste des entrées */}
            <ul className="divide-border/40 divide-y">
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
                    className="hover:bg-surface-hover/50 relative p-4 transition-colors sm:px-4 sm:py-3"
                  >
                    <div className="grid gap-2.5 sm:grid-cols-12 sm:items-center sm:gap-3">
                      {/* Date & Heure */}
                      <div className="flex items-center gap-2 pr-24 sm:col-span-2 sm:pr-0">
                        <div className="text-2xs text-subtle-foreground flex items-center gap-1.5 font-mono tabular-nums">
                          <span className="text-foreground/80 font-semibold">{formattedDate}</span>
                          <span>{formattedTime}</span>
                        </div>
                      </div>

                      {/* Libellé d'action */}
                      <div className="text-foreground min-w-0 text-sm font-medium sm:col-span-6">
                        <span>{describeAuditAction(entry.action)}</span>
                      </div>

                      {/* Auteur */}
                      <div className="text-muted-foreground flex items-center gap-1.5 text-xs sm:col-span-2">
                        <User className="text-subtle-foreground size-3.5 shrink-0" />
                        <span className="truncate">{entry.actor_label ?? 'Système'}</span>
                      </div>

                      {/* Type d'entité Badge */}
                      <div className="absolute top-3.5 right-4 flex justify-end sm:static sm:col-span-2">
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
            <div className="bg-surface-sunken/40 text-muted-foreground flex flex-col items-stretch justify-between gap-3 p-3.5 text-xs sm:flex-row sm:items-center sm:p-4">
              <div>
                Affichage de <span className="text-foreground font-bold">{startIndex + 1}</span> à{' '}
                <span className="text-foreground font-bold">{endIndex}</span> sur{' '}
                <span className="text-foreground font-bold">{totalItems}</span> action
                {totalItems > 1 ? 's' : ''}
              </div>

              {totalPages > 1 && (
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 sm:flex">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={safeCurrentPage === 1}
                    leadingIcon={<ChevronLeft />}
                    className="px-2.5 text-xs"
                    title="Page précédente"
                  >
                    <span>Précédent</span>
                  </Button>

                  <div className="border-border/80 bg-surface text-foreground flex h-11 items-center rounded-md border px-2 py-1 font-mono text-xs font-bold sm:h-8">
                    Page {safeCurrentPage} / {totalPages}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safeCurrentPage === totalPages}
                    trailingIcon={<ChevronRight />}
                    className="px-2.5 text-xs"
                    title="Page suivante"
                  >
                    <span>Suivant</span>
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
