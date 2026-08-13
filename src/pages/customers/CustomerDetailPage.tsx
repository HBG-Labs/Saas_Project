import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ClipboardList,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Trash2,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
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
  useDeleteCustomer,
  useRestoreCustomer,
} from '@/features/customers';
import { MISSION_STATUS_LABELS } from '@/features/missions';
import { PERMISSIONS, useCurrentOrganization, usePermission } from '@/features/organizations';
import { useDocumentTitle } from '@/lib/use-document-title';

export default function CustomerDetailPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const { organization } = useCurrentOrganization();
  const { can } = usePermission();

  const customer = useCustomer(customerId);
  const archiveCustomer = useArchiveCustomer();
  const restoreCustomer = useRestoreCustomer();
  const deleteCustomer = useDeleteCustomer();

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

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

  const handleDelete = async () => {
    await deleteCustomer.mutateAsync(data.id);
    setIsDeleteModalOpen(false);
    // `navigate` renvoie une promesse depuis React Router 7 : sans `await`, une
    // erreur de navigation passerait inaperçue.
    await navigate(ROUTES.customers);
  };

   return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to={ROUTES.customers}>
          <ArrowLeft className="size-4" />
          Clients
        </Link>
      </Button>

      {/* Hero Header Card */}
      <Card className="overflow-hidden border-border bg-surface-raised/50 backdrop-blur-xs">
        <CardContent className="p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-foreground text-2xl font-bold tracking-tight">{data.name}</h1>
                <Badge variant="outline" className="font-mono text-xs">
                  {data.reference}
                </Badge>
                {isArchived ? (
                  <Badge variant="warning">Archivé</Badge>
                ) : (
                  <Badge variant="success">Actif</Badge>
                )}
              </div>

              <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-xs">
                {[data.address_line1, data.postal_code, data.city]
                  .filter((part) => part !== null && part !== '')
                  .join(', ') ? (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="text-subtle-foreground size-3.5" aria-hidden="true" />
                    {[data.address_line1, data.postal_code, data.city]
                      .filter((part) => part !== null && part !== '')
                      .join(', ')}
                  </span>
                ) : null}

                {data.phone ? (
                  <span className="flex items-center gap-1.5 font-mono">
                    <Phone className="text-subtle-foreground size-3.5" aria-hidden="true" />
                    {data.phone}
                  </span>
                ) : null}

                {data.email ? (
                  <span className="flex items-center gap-1.5">
                    <Mail className="text-subtle-foreground size-3.5" aria-hidden="true" />
                    {data.email}
                  </span>
                ) : null}
              </div>
            </div>

            {/* Action Toolbar */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border lg:border-0 lg:pt-0">
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
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    archiveCustomer.mutate(data.id);
                  }}
                  disabled={archiveCustomer.isPending}
                >
                  <Archive className="size-4" />
                  Archiver
                </Button>
              ) : null}

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

              {canDelete ? (
                <>
                  <div className="hidden h-5 w-px bg-border lg:block" aria-hidden="true" />
                  <Button
                    variant="danger-outline"
                    size="sm"
                    onClick={() => {
                      setIsDeleteModalOpen(true);
                    }}
                  >
                    <Trash2 className="size-4" />
                    Supprimer
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <Modal
        open={isDeleteModalOpen}
        onOpenChange={setIsDeleteModalOpen}
        title="Supprimer le client"
        description={`Êtes-vous sûr de vouloir supprimer définitivement le client "${data.name}" (${data.reference}) ?`}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsDeleteModalOpen(false);
              }}
              disabled={deleteCustomer.isPending}
            >
              Annuler
            </Button>
            <Button
              variant="danger-outline"
              size="sm"
              onClick={() => {
                void handleDelete();
              }}
              disabled={deleteCustomer.isPending}
            >
              {deleteCustomer.isPending ? 'Suppression…' : 'Supprimer définitivement'}
            </Button>
          </div>
        }
      >
        <p className="text-muted-foreground text-sm">
          Cette action est <strong className="text-foreground font-semibold">définitive et irréversible</strong>.
          Toutes les informations associées à ce client (contacts et sites d'intervention) seront supprimées.
        </p>
      </Modal>

      <Tabs defaultValue="fiche" className="space-y-4">
        <TabsList>
          <TabsTrigger value="fiche">Fiche générale</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="sites">Sites d'intervention</TabsTrigger>
          <TabsTrigger value="historique">Historique des missions</TabsTrigger>
        </TabsList>

        <TabsContent value="fiche" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Coordonnées */}
            <Card>
              <CardContent className="space-y-4 pt-6">
                <h3 className="text-foreground text-xs font-semibold uppercase tracking-wider">
                  Coordonnées & Contact
                </h3>
                <dl className="grid gap-3 text-sm">
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
                  <Field
                    label="Adresse postale"
                    value={[data.address_line1, data.address_line2, data.postal_code, data.city]
                      .filter((part) => part !== null && part !== '')
                      .join(', ')}
                    icon={<MapPin className="size-3.5" aria-hidden="true" />}
                  />
                  <Field label="Pays" value={data.country} />
                </dl>
              </CardContent>
            </Card>

            {/* Informations légales */}
            <Card>
              <CardContent className="space-y-4 pt-6">
                <h3 className="text-foreground text-xs font-semibold uppercase tracking-wider">
                  Informations Légales & Fiscales
                </h3>
                <dl className="grid gap-3 text-sm">
                  <Field label="Raison sociale" value={data.legal_name} />
                  <Field label="SIRET / SIREN" value={data.registration_number} />
                  <Field label="N° de TVA Intracommunautaire" value={data.vat_number} />
                  <Field label="Référence interne" value={data.reference} />
                </dl>
              </CardContent>
            </Card>
          </div>

          {/* Notes */}
          {data.notes !== null && data.notes !== '' ? (
            <Card>
              <CardContent className="space-y-2 pt-6">
                <h3 className="text-foreground text-xs font-semibold uppercase tracking-wider">
                  Notes & Remarques
                </h3>
                <p className="text-muted-foreground text-sm whitespace-pre-line leading-relaxed">
                  {data.notes}
                </p>
              </CardContent>
            </Card>
          ) : null}
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
