import { zodResolver } from '@hookform/resolvers/zod';
import { UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { FormError } from '@/components/feedback/FormError';
import type { OrgRole } from '@/types/database';
import type { OrganizationInvitation } from '@/types/domain';

import { useInviteMember } from '../hooks/useInvitations';
import { inviteMemberSchema, type InviteMemberValues } from '../schemas/organization.schema';

import { InvitationLink } from './InvitationLink';
import { RoleSelect } from './RoleSelect';

export interface InviteMemberDialogProps {
  organizationId: string;
  /** Seul un propriétaire peut en inviter un autre. */
  viewerIsOwner: boolean;
  /** Quota atteint : l'invitation serait refusée par le trigger. */
  quotaReached: boolean;
}

export function InviteMemberDialog({
  organizationId,
  viewerIsOwner,
  quotaReached,
}: InviteMemberDialogProps) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<OrgRole>('technician');
  const [submitError, setSubmitError] = useState<unknown>(null);
  /**
   * L'invitation créée reste affichée après soumission : c'est le seul moment
   * où le lien est présenté. Refermer aussitôt la fenêtre ferait perdre la
   * seule chose que l'utilisateur est venu chercher.
   */
  const [created, setCreated] = useState<OrganizationInvitation | null>(null);

  const inviteMember = useInviteMember(organizationId);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InviteMemberValues>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { email: '', role: 'technician' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      const invitation = await inviteMember.mutateAsync({ email: values.email, role });
      setCreated(invitation);
      reset();
    } catch (error) {
      setSubmitError(error);
    }
  });

  const close = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setCreated(null);
      setSubmitError(null);
      reset();
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={close}
      title={created === null ? 'Inviter un membre' : 'Invitation créée'}
      // Propriété omise plutôt que passée à `undefined` : `exactOptionalPropertyTypes`
      // distingue les deux, et la seconde forme est un type invalide.
      {...(created === null
        ? {
            description:
              'La personne rejoindra l’entreprise avec le rôle choisi, après avoir ouvert le lien.',
          }
        : {})}
      trigger={
        <Button variant="primary" size="sm" disabled={quotaReached}>
          <UserPlus className="size-4" />
          Inviter
        </Button>
      }
    >
      {created === null ? (
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <FormError error={submitError} />

          <Input
            label="Adresse e-mail"
            type="email"
            placeholder="collegue@entreprise.fr"
            hint="Elle devra correspondre exactement à celle du compte utilisé pour accepter."
            required
            {...(errors.email?.message ? { error: errors.email.message } : {})}
            {...register('email')}
          />

          <RoleSelect value={role} onChange={setRole} canAssignOwner={viewerIsOwner} />

          <Button type="submit" variant="primary" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Création…' : 'Créer l’invitation'}
          </Button>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="border-warning/40 bg-warning-subtle rounded-lg border p-3">
            <p className="text-foreground text-sm font-medium">Aucun e-mail n’a été envoyé</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Transmettez ce lien à <strong>{created.email}</strong> par le moyen de votre choix.
              Il expire dans 7 jours et ne fonctionnera que pour un compte utilisant cette adresse.
            </p>
          </div>

          <InvitationLink token={created.token} />

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setCreated(null);
              }}
            >
              Inviter quelqu’un d’autre
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={() => {
                close(false);
              }}
            >
              Terminé
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
