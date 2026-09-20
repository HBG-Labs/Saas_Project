import { Archive, Building2, Download, MapPin, Phone, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataView } from '@/components/ui/DataView';
import { TableCell, TableHeaderCell } from '@/components/ui/Table';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { ROUTES } from '@/config/routes';
import { CustomerFormDialog, useCustomers } from '@/features/customers';
import { PERMISSIONS, useCurrentOrganization, usePermission } from '@/features/organizations';
import { exportToCsv } from '@/lib/csv-export';
import { useDocumentTitle } from '@/lib/use-document-title';
import type { ContentStatus } from '@/types/database';

export default function CustomersListPage() {
  useDocumentTitle('Clients');

  const { organization } = useCurrentOrganization();
  const { can } = usePermission();
  const organizationId = organization?.id ?? null;

  const [search, setSearch] = useState('');
  /**
   * L'archivage était à sens unique : la fiche disparaissait sans retour
   * possible, la liste filtrant `status = 'active'` sans alternative. Archiver
   * doit pouvoir se défaire — sinon c'est une suppression déguisée.
   */
  const [status, setStatus] = useState<ContentStatus>('active');

  const customers = useCustomers(organizationId, {
    status,
    ...(search.trim() !== '' ? { search } : {}),
  });

  const canCreate = can(PERMISSIONS.customerCreate);
  const canViewAll = can(PERMISSIONS.customerView);
  const list = customers.data ?? [];

  const handleExportCsv = () => {
    exportToCsv(
      `clients-${new Date().toISOString().slice(0, 10)}`,
      [
        { header: 'Nom', accessor: (c) => c.name },
        { header: 'Raison sociale', accessor: (c) => c.legal_name ?? '' },
        { header: 'Numéro SIREN/SIRET', accessor: (c) => c.registration_number ?? '' },
        { header: 'Numéro TVA', accessor: (c) => c.vat_number ?? '' },
        { header: 'Email', accessor: (c) => c.email ?? '' },
        { header: 'Téléphone', accessor: (c) => c.phone ?? '' },
        { header: 'Adresse', accessor: (c) => c.address_line1 ?? '' },
        { header: 'Code postal', accessor: (c) => c.postal_code ?? '' },
        { header: 'Ville', accessor: (c) => c.city ?? '' },
        { header: 'Pays', accessor: (c) => c.country ?? 'FR' },
        { header: 'Statut', accessor: (c) => c.status },
      ],
      list,
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description={
          canViewAll
            ? 'Vos donneurs d’ordre, leurs interlocuteurs et leurs sites d’intervention.'
            : 'Les clients chez qui vous intervenez.'
        }
        actions={
          <div className="flex items-center gap-2">
            {list.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleExportCsv}
                title="Exporter les clients en CSV"
              >
                <Download className="size-4" />
                <span className="hidden sm:inline">Exporter CSV</span>
              </Button>
            )}
            {canCreate && organizationId !== null && (
              <CustomerFormDialog
                organizationId={organizationId}
                trigger={
                  <Button variant="primary" size="sm">
                    <Plus className="size-4" />
                    Nouveau client
                  </Button>
                }
              />
            )}
          </div>
        }
      />

      {canViewAll ? (
        <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
          <Input
            label="Rechercher"
            hideLabel
            placeholder="Rechercher par nom, référence ou ville…"
            leadingIcon={<Search className="size-4" aria-hidden="true" />}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
            }}
          />

          <Select
            options={[
              { value: 'active', label: 'Clients actifs' },
              { value: 'archived', label: 'Clients archivés' },
            ]}
            value={status}
            onValueChange={(value) => {
              setStatus(value as ContentStatus);
            }}
            label="Statut"
            hideLabel
          />
        </div>
      ) : null}

      {customers.isPending ? (
        <ListSkeleton />
      ) : customers.isError ? (
        <ErrorState
          error={customers.error}
          onRetry={() => {
            void customers.refetch();
          }}
        />
      ) : list.length === 0 ? (
        <EmptyState
          icon={status === 'archived' ? Archive : Building2}
          title={
            search.trim() !== ''
              ? 'Aucun résultat'
              : status === 'archived'
                ? 'Aucun client archivé'
                : 'Aucun client'
          }
          description={
            search.trim() !== ''
              ? 'Aucun client ne correspond à cette recherche.'
              : status === 'archived'
                ? 'Les fiches archivées se retrouvent ici, et peuvent être réactivées à tout moment.'
                : canCreate
                  ? 'Créez une fiche client pour rattacher ses sites, ses interlocuteurs et l’historique de vos interventions.'
                  : /*
                     Un technicien ne voit que les clients de SES missions : une
                     liste vide signifie qu'il n'en a aucune en cours, pas qu'il
                     manque un droit. Le dire évite de faire chercher une panne.
                   */
                    'Les clients apparaîtront ici dès que vous serez affecté à une mission chez eux.'
          }
        />
      ) : (
        <DataView
          items={list}
          getKey={(customer) => customer.id}
          label="Liste des clients"
          breakpoint="lg"
          columnCount={4}
          head={
            <>
              <TableHeaderCell>Client</TableHeaderCell>
              <TableHeaderCell>Référence</TableHeaderCell>
              <TableHeaderCell>Ville</TableHeaderCell>
              <TableHeaderCell>Contact</TableHeaderCell>
            </>
          }
          empty={{ title: 'Aucun client', description: 'Les clients apparaîtront ici.' }}
          renderRow={(customer) => (
            <>
              <TableCell className="py-2.5">
                <Link
                  className="text-foreground hover:text-primary block py-1 text-sm font-bold"
                  to={ROUTES.customer(customer.id)}
                >
                  {customer.name}
                </Link>
                {customer.legal_name && customer.legal_name !== customer.name && (
                  <span className="text-muted-foreground">{customer.legal_name}</span>
                )}
              </TableCell>
              <TableCell className="py-2.5">
                <span className="text-muted-foreground tabular-nums">{customer.reference}</span>
              </TableCell>
              <TableCell className="py-2.5">
                {[customer.postal_code, customer.city].filter(Boolean).join(' ') ||
                  'Non renseignée'}
              </TableCell>
              <TableCell className="py-2.5">
                <div className="space-y-1">
                  {customer.phone && (
                    <a className="hover:text-primary block" href={'tel:' + customer.phone}>
                      {customer.phone}
                    </a>
                  )}
                  {customer.email && (
                    <a
                      className="hover:text-primary block break-all"
                      href={'mailto:' + customer.email}
                    >
                      {customer.email}
                    </a>
                  )}
                  {!customer.phone && !customer.email && (
                    <span className="text-muted-foreground">Non renseigné</span>
                  )}
                </div>
              </TableCell>
            </>
          )}
          renderCard={(customer) => (
            <>
              <Link className="group block min-w-0" to={ROUTES.customer(customer.id)}>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-foreground group-hover:text-primary min-w-0 text-base font-bold break-words">
                    {customer.name}
                  </span>
                  <Badge variant="outline" className="shrink-0">
                    {customer.reference}
                  </Badge>
                </div>
                {customer.legal_name && customer.legal_name !== customer.name && (
                  <p className="text-muted-foreground mt-1 text-sm">{customer.legal_name}</p>
                )}
                <p className="text-muted-foreground mt-2 flex items-center gap-2 text-sm">
                  <MapPin className="size-4 shrink-0" aria-hidden="true" />
                  {[customer.postal_code, customer.city].filter(Boolean).join(' ') ||
                    'Ville non renseignée'}
                </p>
                <span className="text-primary min-h-touch mt-2 inline-flex items-center text-sm font-semibold">
                  Ouvrir la fiche →
                </span>
              </Link>
              {customer.phone && (
                <Button asChild variant="outline" size="sm">
                  <a href={'tel:' + customer.phone}>
                    <Phone className="size-4" aria-hidden="true" />
                    {customer.phone}
                  </a>
                </Button>
              )}
            </>
          )}
        />
      )}
    </div>
  );
}
