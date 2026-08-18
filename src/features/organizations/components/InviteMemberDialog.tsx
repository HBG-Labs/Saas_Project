import { zodResolver } from '@hookform/resolvers/zod';
import { Sparkles, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { FormError } from '@/components/feedback/FormError';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
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
  /** Quota bloquant (Free uniquement). */
  quotaReached: boolean;
  /** Indique si cette invitation correspond à un siège supplémentaire (+5 €/mois). */
  isExtraSeat?: boolean;
}

export function InviteMemberDialog({
  organizationId,
  viewerIsOwner,
  quotaReached,
  isExtraSeat = false,
}: InviteMemberDialogProps) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<OrgRole>('technician');
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [created, setCreated] = useState<OrganizationInvitation | null>(null);
  const [emailSent, setEmailSent] = useState(false);

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
      const { invitation, emailSent: sent } = await inviteMember.mutateAsync({
        email: values.email,
        role,
      });
      setCreated(invitation);
      setEmailSent(sent);
      reset();
    } catch (error) {
      setSubmitError(error);
    }
  });

  const close = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setCreated(null);
      setEmailSent(false);
      setSubmitError(null);
      reset();
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={close}
      title={created === null ? 'Inviter un membre' : emailSent ? 'Invitation envoyée' : 'Invitation créée'}
      {...(created === null
        ? {
            description:
              'La personne rejoindra l’entreprise avec le rôle choisi, après avoir ouvert le lien.',
          }
        : {})}
      trigger={
        <Button variant="primary" size="sm" disabled={quotaReached}>
          <UserPlus className="size-4" />
          <span>Inviter</span>
        </Button>
      }
    >
      {created === null ? (
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <FormError error={submitError} />

          {isExtraSeat ? (
            <div className="border-primary/40 bg-primary/10 rounded-xl border p-3 text-xs flex items-start gap-2.5">
              <Sparkles className="size-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-foreground font-semibold">
                  Siège supplémentaire à l’acceptation (+5,00 € / mois)
                </p>
                <p className="text-muted-foreground mt-0.5 text-2xs leading-relaxed">
                  Vous avez atteint les utilisateurs inclus dans votre formule.{' '}
                  <strong>Rien n’est facturé aujourd’hui</strong> : une invitation en attente ne
                  coûte rien. Le siège devient payable <strong>+5 € / mois</strong>, au prorata, le
                  jour où cette personne accepte.
                </p>
              </div>
            </div>
          ) : null}

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
            {isSubmitting
              ? 'Création…'
              : isExtraSeat
                ? 'Créer l’invitation (+5 €/mois à l’acceptation)'
                : 'Créer l’invitation'}
          </Button>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="border-warning/40 bg-warning-subtle rounded-lg border p-3">
            <p className="text-foreground text-sm font-medium">Aucun e-mail n’a été envoyé</p>
            <p className="text-muted-foreground mt-1 text-xs">
              {emailSent ? (
                <>
                  Le lien vient d’être envoyé à <strong>{created.email}</strong>. Le voici en
                  secours, si le courriel se perd ou atterrit dans les indésirables.
                </>
              ) : (
                <>
                  Le courriel n’a pas pu partir : transmettez ce lien à{' '}
                  <strong>{created.email}</strong> par le moyen de votre choix.
                </>
              )}
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
