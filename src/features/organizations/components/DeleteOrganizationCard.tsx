import { AlertTriangle, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { FormError } from '@/components/feedback/FormError';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ROUTES } from '@/config/routes';
import type { Organization } from '@/types/domain';

import { useDeleteOrganization } from '../hooks/useOrganizations';
import { usePermission } from '../hooks/usePermission';
import { PERMISSIONS } from '../rbac';

export function DeleteOrganizationCard({ organization }: { organization: Organization }) {
  const navigate = useNavigate();
  const { can } = usePermission();
  const deleteOrganization = useDeleteOrganization();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<unknown>(null);

  if (!can(PERMISSIONS.organizationDelete)) return null;

  const confirmed = confirmation.trim() === organization.name;

  function closeModal() {
    if (deleteOrganization.isPending) return;
    setOpen(false);
    setConfirmation('');
    setError(null);
  }

  async function handleDelete() {
    if (!confirmed || deleteOrganization.isPending) return;

    setError(null);
    try {
      await deleteOrganization.mutateAsync(organization.id);
      setOpen(false);
      await navigate(ROUTES.dashboard, { replace: true });
    } catch (deleteError) {
      setError(deleteError);
    }
  }

  return (
    <>
      <Card className="border-error-border">
        <CardHeader className="flex-row items-start gap-3">
          <span className="bg-error-subtle text-error flex size-10 shrink-0 items-center justify-center rounded-lg">
            <AlertTriangle className="size-5" aria-hidden="true" />
          </span>
          <div>
            <CardTitle>Supprimer l’entreprise</CardTitle>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              Cette opération ferme définitivement cette entreprise et supprime ses données de
              travail. Elle est réservée au propriétaire.
            </p>
          </div>
        </CardHeader>
        <CardContent className="border-border/60 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground text-xs leading-relaxed sm:max-w-xl">
            Les documents soumis à une obligation légale de conservation ou un abonnement externe
            encore actif peuvent empêcher la suppression.
          </p>
          <Button
            type="button"
            variant="danger-outline"
            className="w-full shrink-0 gap-2 sm:w-auto"
            onClick={() => setOpen(true)}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Supprimer l’entreprise
          </Button>
        </CardContent>
      </Card>

      <Modal
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) closeModal();
        }}
        title="Supprimer définitivement l’entreprise"
        description="Cette action est irréversible. Aucun membre ne pourra ensuite accéder à cette entreprise."
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={closeModal}
              disabled={deleteOrganization.isPending}
              className="w-full sm:w-auto"
            >
              Conserver l’entreprise
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => void handleDelete()}
              disabled={!confirmed || deleteOrganization.isPending}
              isLoading={deleteOrganization.isPending}
              loadingLabel="Suppression de l’entreprise"
              className="w-full sm:w-auto"
            >
              Supprimer définitivement
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="bg-error-subtle border-error-border rounded-lg border p-3">
            <p className="text-error text-sm font-semibold">
              Toutes les données de travail seront supprimées.
            </p>
            <p className="text-error/90 mt-1 text-xs leading-relaxed">
              Membres, clients, missions, interventions, planning et réglages associés ne pourront
              pas être restaurés depuis l’application.
            </p>
          </div>

          <FormError error={error} />

          <Input
            label={`Saisissez « ${organization.name} » pour confirmer`}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
            disabled={deleteOrganization.isPending}
          />
        </div>
      </Modal>
    </>
  );
}
