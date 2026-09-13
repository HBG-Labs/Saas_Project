import { Mail, MessageSquare, Send } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { FormError } from '@/components/feedback/FormError';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { SelectField } from '@/components/ui/SelectField';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { Textarea } from '@/components/ui/Textarea';
import { useCustomerContacts } from '@/features/customers';

import { useSendClientMessage } from '../hooks/useClientPortal';

export interface SendToClientDialogProps {
  customerId: string;
  /** Bouton d'ouverture ; absent = dialogue piloté par `open`. */
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: string;
  defaultSubject?: string;
  defaultBody?: string;
  /** Rattachement de la conversation : le client retrouvera le document depuis le fil. */
  link?: { quoteId?: string; invoiceId?: string; missionId?: string };
  onSent?: (conversationId: string) => void;
}

/**
 * Ouvre une conversation avec un interlocuteur du client et envoie le premier
 * message par e-mail (fonction `portal-message-send`). Un seul composant pour
 * la messagerie de la fiche client et pour « prévenir le client » depuis un
 * devis ou une facture : mêmes contacts éligibles, mêmes états.
 */
export function SendToClientDialog({
  customerId,
  trigger,
  open: controlledOpen,
  onOpenChange,
  title = 'Écrire au client',
  defaultSubject = '',
  defaultBody = '',
  link,
  onSent,
}: SendToClientDialogProps) {
  const [innerOpen, setInnerOpen] = useState(false);
  const open = controlledOpen ?? innerOpen;
  const setOpen = (next: boolean) => {
    setInnerOpen(next);
    onOpenChange?.(next);
  };

  const contacts = useCustomerContacts(customerId);
  const send = useSendClientMessage();
  const [contactId, setContactId] = useState('');
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [error, setError] = useState<unknown>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const eligible = (contacts.data ?? []).filter((c) => c.portal_enabled && c.email !== null && c.email !== '');
  // Un seul interlocuteur possible : pas la peine de le demander.
  const effectiveContactId = contactId || (eligible.length === 1 ? eligible[0]!.id : '');

  const reset = () => {
    setContactId('');
    setSubject(defaultSubject);
    setBody(defaultBody);
    setError(null);
    setFailed(null);
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
      title={title}
      {...(trigger !== undefined ? { trigger } : {})}
    >
      {contacts.isPending ? (
        <ListSkeleton />
      ) : eligible.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="Aucun interlocuteur avec accès au portail"
          description="Ouvrez l’accès à un contact de ce client (fiche client → Contacts → « Accès au portail client ») avant de lui écrire."
        />
      ) : (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            setFailed(null);
            send.mutate(
              { contactId: effectiveContactId, subject: subject.trim(), body: body.trim(), ...link },
              {
                onSuccess: (result) => {
                  if (result.status === 'failed') {
                    setFailed(result.error ?? 'L’e-mail n’a pas pu être envoyé.');
                    onSent?.(result.conversationId);
                    return;
                  }
                  setOpen(false);
                  reset();
                  onSent?.(result.conversationId);
                },
                onError: (e) => {
                  setError(e);
                },
              },
            );
          }}
        >
          <FormError error={error} />
          {failed !== null ? (
            <p className="text-error text-xs" role="alert">
              Conversation créée, mais l’e-mail n’est pas parti : {failed}
            </p>
          ) : null}
          <SelectField
            label="Interlocuteur"
            required
            value={effectiveContactId}
            onChange={(event) => {
              setContactId(event.target.value);
            }}
          >
            <option value="">Choisir…</option>
            {eligible.map((c) => (
              <option key={c.id} value={c.id}>
                {[c.first_name, c.last_name].filter(Boolean).join(' ')} — {c.email ?? ''}
              </option>
            ))}
          </SelectField>
          <Input
            label="Objet"
            required
            maxLength={200}
            value={subject}
            onChange={(event) => {
              setSubject(event.target.value);
            }}
          />
          <Textarea
            label="Message"
            required
            rows={6}
            maxLength={20000}
            value={body}
            onChange={(event) => {
              setBody(event.target.value);
            }}
            hint="Le client reçoit ce message par e-mail et le retrouve dans son espace client. Il peut répondre depuis les deux."
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
                reset();
              }}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={send.isPending || effectiveContactId === '' || subject.trim() === '' || body.trim() === ''}
            >
              <Send className="size-4" />
              {send.isPending ? 'Envoi…' : 'Envoyer'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

/** Déclencheur standard : le bouton « Écrire au client » de la fiche. */
export function WriteToClientButton() {
  return (
    <Button variant="outline" size="sm">
      <MessageSquare className="size-4" />
      Écrire au client
    </Button>
  );
}
