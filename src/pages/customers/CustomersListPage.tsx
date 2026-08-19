import { Archive, Building2, Download, MapPin, Phone, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
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
      list
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((customer) => (
            <Link
              key={customer.id}
              to={ROUTES.customer(customer.id)}
              className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Card className="h-full cursor-pointer transition-all duration-150 group-hover:border-primary/50 group-hover:shadow-md hover:border-primary/50 hover:shadow-md">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-hover text-foreground/80 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                        <Building2 className="size-4" />
                      </div>
                      <span className="text-foreground truncate text-sm font-semibold group-hover:text-primary transition-colors">
                        {customer.name}
                      </span>
                    </div>
                    <Badge variant="outline" className="font-mono text-xs shrink-0">
                      {customer.reference}
                    </Badge>
                  </div>

                  <div className="space-y-1 pt-1 text-xs">
                    <p className="text-muted-foreground flex items-center gap-1.5 truncate">
                      <MapPin className="text-subtle-foreground size-3.5 shrink-0" aria-hidden="true" />
                      {[customer.postal_code, customer.city]
                        .filter((part) => part !== null && part !== '')
                        .join(' ') || 'Ville non renseignée'}
                    </p>

                    {customer.phone !== null && customer.phone !== '' ? (
                      <p className="text-subtle-foreground flex items-center gap-1.5 font-mono">
                        <Phone className="text-subtle-foreground size-3.5 shrink-0" aria-hidden="true" />
                        {customer.phone}
                      </p>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
