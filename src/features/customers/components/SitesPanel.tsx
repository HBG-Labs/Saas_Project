import { zodResolver } from '@hookform/resolvers/zod';
import { Archive, KeyRound, MapPin, Plus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { FormError } from '@/components/feedback/FormError';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';

import { useArchiveSite, useCreateSite, useCustomerSites } from '../hooks/useCustomerChildren';
import { omitEmpty, siteSchema, type SiteValues } from '../schemas/customer.schema';

export interface SitesPanelProps {
  customerId: string;
  organizationId: string;
  canEdit: boolean;
}

export function SitesPanel({ customerId, organizationId, canEdit }: SitesPanelProps) {
  const sites = useCustomerSites(customerId);
  const archiveSite = useArchiveSite(customerId);

  if (sites.isPending) return <ListSkeleton />;
  if (sites.isError) {
    return (
      <ErrorState
        error={sites.error}
        onRetry={() => {
          void sites.refetch();
        }}
      />
    );
  }

  const list = sites.data ?? [];

  return (
    <div className="space-y-4">
      {canEdit ? (
        <div className="flex justify-end">
          <SiteFormDialog customerId={customerId} organizationId={organizationId} />
        </div>
      ) : null}

      {list.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="Aucun site d’intervention"
          description="Un site porte l’adresse, les coordonnées GPS et les consignes d’accès. Une mission créée depuis un site en hérite automatiquement."
        />
      ) : (
        <ul className="space-y-3">
          {list.map((site) => (
            <li key={site.id} className="border-border rounded-lg border p-3">
              <div className="flex flex-wrap items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-foreground text-sm font-medium">{site.name}</span>
                    {site.code !== null && site.code !== '' ? (
                      <Badge variant="outline">{site.code}</Badge>
                    ) : null}
                  </div>

                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {[site.address_line1, site.postal_code, site.city]
                      .filter((part) => part !== null && part !== '')
                      .join(', ') || 'Adresse non renseignée'}
                  </p>
                </div>

                {canEdit ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      archiveSite.mutate(site.id);
                    }}
                    disabled={archiveSite.isPending}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={`Archiver le site ${site.name}`}
                  >
                    <Archive className="size-4" />
                  </Button>
                ) : null}
              </div>

              {/*
                Les consignes d'accès sont mises en évidence plutôt que noyées
                dans le reste : c'est l'information qui fait gagner une heure au
                technicien devant une grille fermée.
              */}
              {site.access_notes !== null && site.access_notes !== '' ? (
                <div className="bg-surface-sunken mt-2 flex gap-2 rounded-md p-2">
                  <KeyRound className="text-muted-foreground mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  <p className="text-muted-foreground text-xs whitespace-pre-line">
                    {site.access_notes}
                  </p>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SiteFormDialog({
  customerId,
  organizationId,
}: {
  customerId: string;
  organizationId: string;
}) {
  const [open, setOpen] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const createSite = useCreateSite(customerId);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SiteValues>({
    resolver: zodResolver(siteSchema),
    defaultValues: {
      name: '',
      code: '',
      addressLine1: '',
      postalCode: '',
      city: '',
      country: 'FR',
      accessNotes: '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      const code = omitEmpty(values.code);
      const addressLine1 = omitEmpty(values.addressLine1);
      const postalCode = omitEmpty(values.postalCode);
      const city = omitEmpty(values.city);
      const country = omitEmpty(values.country);
      const accessNotes = omitEmpty(values.accessNotes);

      await createSite.mutateAsync({
        customerId,
        organizationId,
        name: values.name,
        ...(code !== undefined ? { code } : {}),
        ...(addressLine1 !== undefined ? { addressLine1 } : {}),
        ...(postalCode !== undefined ? { postalCode } : {}),
        ...(city !== undefined ? { city } : {}),
        ...(country !== undefined ? { country } : {}),
        ...(accessNotes !== undefined ? { accessNotes } : {}),
      });
      reset();
      setOpen(false);
    } catch (error) {
      setSubmitError(error);
    }
  });

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Nouveau site d’intervention"
      trigger={
        <Button variant="outline" size="sm">
          <Plus className="size-4" />
          Ajouter un site
        </Button>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormError error={submitError} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Nom du site"
            placeholder="Annexe technique"
            required
            {...(errors.name?.message ? { error: errors.name.message } : {})}
            {...register('name')}
          />
          <Input
            label="Référence client"
            placeholder="PBO-1245"
            hint="La référence du client, pas la nôtre."
            {...register('code')}
          />
        </div>

        <Input label="Adresse" {...register('addressLine1')} />

        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="Code postal" {...register('postalCode')} />
          <Input label="Ville" {...register('city')} />
          <Input
            label="Pays"
            {...(errors.country?.message ? { error: errors.country.message } : {})}
            {...register('country')}
          />
        </div>

        <Textarea
          label="Consignes d’accès"
          rows={3}
          placeholder="Code portail 4412 — badge à retirer à l’accueil — accès interdit avant 8 h"
          hint="Codes, horaires, consignes de sécurité. C’est ce que le technicien lira sur place."
          {...register('accessNotes')}
        />

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setOpen(false);
            }}
          >
            Annuler
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? 'Ajout…' : 'Ajouter le site'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
