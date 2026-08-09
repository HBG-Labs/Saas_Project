import { Building2, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { ROUTES } from '@/config/routes';
import { CustomerFormDialog, useCustomers } from '@/features/customers';
import { PERMISSIONS, useCurrentOrganization, usePermission } from '@/features/organizations';
import { useDocumentTitle } from '@/lib/use-document-title';

export default function CustomersListPage() {
  useDocumentTitle('Clients');

  const { organization } = useCurrentOrganization();
  const { can } = usePermission();
  const organizationId = organization?.id ?? null;

  const [search, setSearch] = useState('');
  const customers = useCustomers(organizationId, search.trim() === '' ? {} : { search });

  const canCreate = can(PERMISSIONS.customerCreate);
  const canViewAll = can(PERMISSIONS.customerView);
  const list = customers.data ?? [];

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
          canCreate && organizationId !== null ? (
            <CustomerFormDialog
              organizationId={organizationId}
              trigger={
                <Button variant="primary" size="sm">
                  <Plus className="size-4" />
                  Nouveau client
                </Button>
              }
            />
          ) : null
        }
      />

      {canViewAll ? (
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
          icon={Building2}
          title={search.trim() === '' ? 'Aucun client' : 'Aucun résultat'}
          description={
            search.trim() !== ''
              ? 'Aucun client ne correspond à cette recherche.'
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((customer) => (
            <Card key={customer.id} className="transition-colors hover:border-border-strong">
              <CardContent className="pt-5">
                <Link to={ROUTES.customer(customer.id)} className="block space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-foreground text-sm font-semibold">{customer.name}</span>
                    <Badge variant="outline">{customer.reference}</Badge>
                  </div>

                  <p className="text-muted-foreground text-xs">
                    {[customer.postal_code, customer.city]
                      .filter((part) => part !== null && part !== '')
                      .join(' ') || 'Ville non renseignée'}
                  </p>

                  {customer.phone !== null && customer.phone !== '' ? (
                    <p className="text-subtle-foreground font-mono text-xs">{customer.phone}</p>
                  ) : null}
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
