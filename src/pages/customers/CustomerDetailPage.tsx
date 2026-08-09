import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ClipboardList,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Users,
} from 'lucide-react';
import { Link, useParams } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { ListSkeleton, Skeleton } from '@/components/ui/Skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { ROUTES } from '@/config/routes';
import {
  ContactsPanel,
  CustomerFormDialog,
  SitesPanel,
  useArchiveCustomer,
  useCustomer,
  useCustomerHistory,
  useRestoreCustomer,
} from '@/features/customers';
import { MISSION_STATUS_LABELS } from '@/features/missions';
import { PERMISSIONS, useCurrentOrganization, usePermission } from '@/features/organizations';
import { useDocumentTitle } from '@/lib/use-document-title';

export default function CustomerDetailPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const { organization } = useCurrentOrganization();
  const { can } = usePermission();

  const customer = useCustomer(customerId);
  const archiveCustomer = useArchiveCustomer();
  const restoreCustomer = useRestoreCustomer();

  useDocumentTitle(customer.data?.name ?? 'Client');

  const canEdit = can(PERMISSIONS.customerUpdate);
  const canDelete = can(PERMISSIONS.customerDelete);
  const organizationId = organization?.id ?? null;

  if (customer.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (customer.isError) {
    return (
      <ErrorState
        error={customer.error}
        onRetry={() => {
          void customer.refetch();
        }}
      />
    );
  }

  /**
   * `null` couvre deux cas indistinguables côté client : la fiche n'existe pas,
   * ou la policy la masque. Le serveur ne les sépare pas — dire « vous n'avez
   * pas le droit » confirmerait l'existence de la fiche à qui essaie des
   * identifiants.
   */
  if (customer.data === null || customerId === undefined) {
    return (
      <EmptyState
        icon={Users}
        title="Client introuvable"
        description="Cette fiche n’existe pas, ou ne fait pas partie de votre entreprise."
        action={
          <Button asChild variant="outline" size="sm">
            <Link to={ROUTES.customers}>Retour aux clients</Link>
          </Button>
        }
      />
    );
  }

  const data = customer.data;
  const isArchived = data.status === 'archived';

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to={ROUTES.customers}>
          <ArrowLeft className="size-4" />
          Clients
        </Link>
      </Button>

      <PageHeader
        title={data.name}
        description={
          [data.address_line1, data.postal_code, data.city]
            .filter((part) => part !== null && part !== '')
            .join(', ') || 'Adresse non renseignée'
        }
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline">{data.reference}</Badge>
            {isArchived ? <Badge variant="warning">Archivé</Badge> : null}

            {canEdit && organizationId !== null ? (
              <CustomerFormDialog
                organizationId={organizationId}
                customer={data}
                trigger={
                  <Button variant="outline" size="sm">
                    <Pencil className="size-4" />
                    Modifier
                  </Button>
                }
              />
            ) : null}

            {canDelete && !isArchived ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  archiveCustomer.mutate(data.id);
                }}
                disabled={archiveCustomer.isPending}
                className="text-muted-foreground hover:text-foreground"
              >
                <Archive className="size-4" />
                Archiver
              </Button>
            ) : null}

            {/*
              Réactiver relève de `customer.update`, et non de `customer.delete` :
              côté serveur, la restauration est un UPDATE de plus, soumis à
              `customers_update`. Le bouton reprend donc la permission que le
              serveur exigera, pas celle qui a permis d'archiver.
            */}
            {canEdit && isArchived ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  restoreCustomer.mutate(data.id);
                }}
                disabled={restoreCustomer.isPending}
              >
                <ArchiveRestore className="size-4" />
                Réactiver
              </Button>
            ) : null}
          </div>
        }
      />

      <Tabs defaultValue="fiche">
        <TabsList>
          <TabsTrigger value="fiche">Fiche</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="sites">Sites</TabsTrigger>
          <TabsTrigger value="historique">Historique</TabsTrigger>
        </TabsList>

        <TabsContent value="fiche">
          <Card>
            <CardContent className="pt-6">
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <Field label="Raison sociale" value={data.legal_name} />
                <Field label="N° TVA" value={data.vat_number} />
                <Field label="SIRET" value={data.registration_number} />
                <Field label="Pays" value={data.country} />
                <Field
                  label="Téléphone"
                  value={data.phone}
                  icon={<Phone className="size-3.5" aria-hidden="true" />}
                />
                <Field
                  label="Adresse e-mail"
                  value={data.email}
                  icon={<Mail className="size-3.5" aria-hidden="true" />}
                />
              </dl>

              {data.notes !== null && data.notes !== '' ? (
                <div className="border-border mt-6 border-t pt-4">
                  <p className="text-muted-foreground mb-1 text-xs">Notes</p>
                  <p className="text-foreground text-sm whitespace-pre-line">{data.notes}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contacts">
          {organizationId !== null ? (
            <ContactsPanel
              customerId={customerId}
              organizationId={organizationId}
              canEdit={canEdit}
            />
          ) : null}
        </TabsContent>

        <TabsContent value="sites">
          {organizationId !== null ? (
            <SitesPanel customerId={customerId} organizationId={organizationId} canEdit={canEdit} />
          ) : null}
        </TabsContent>

        <TabsContent value="historique">
          <CustomerHistory customerId={customerId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | null;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-foreground flex items-center gap-1.5">
        {value !== null && value !== '' ? (
          <>
            {icon}
            {value}
          </>
        ) : (
          <span className="text-subtle-foreground">—</span>
        )}
      </dd>
    </div>
  );
}

/**
 * Historique des interventions chez ce client.
 *
 * C'est la vue qui donne sa valeur au module — sans elle, un client n'est qu'un
 * carnet d'adresses. La policy `missions_select_scoped` s'applique : un
 * technicien n'y verra que SES interventions, un responsable toutes.
 */
function CustomerHistory({ customerId }: { customerId: string }) {
  const history = useCustomerHistory(customerId);

  if (history.isPending) return <ListSkeleton />;
  if (history.isError) {
    return (
      <ErrorState
        error={history.error}
        onRetry={() => {
          void history.refetch();
        }}
      />
    );
  }

  const missions = history.data ?? [];

  if (missions.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Aucune intervention"
        description="Les missions créées pour ce client apparaîtront ici, avec leur site, leur date et leur état."
      />
    );
  }

  return (
    <ul className="divide-border divide-y">
      {missions.map((mission) => (
        <li key={mission.id} className="flex flex-wrap items-center gap-3 py-3">
          <Badge variant="outline">{mission.reference}</Badge>

          <div className="min-w-0 flex-1">
            <p className="text-foreground truncate text-sm font-medium">{mission.title}</p>
            {mission.site !== null ? (
              <p className="text-muted-foreground flex items-center gap-1 text-xs">
                <MapPin className="size-3" aria-hidden="true" />
                {mission.site.name}
              </p>
            ) : null}
          </div>

          <span className="text-subtle-foreground font-mono text-xs tabular-nums">
            {mission.scheduled_start !== null
              ? new Date(mission.scheduled_start).toLocaleDateString('fr-FR')
              : '—'}
          </span>

          <Badge variant="neutral">{MISSION_STATUS_LABELS[mission.status]}</Badge>
        </li>
      ))}
    </ul>
  );
}
