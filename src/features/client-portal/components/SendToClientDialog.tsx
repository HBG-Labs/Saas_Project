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
  /** Joindre le PDF de la facture `link.invoiceId` au courriel. */
  attachInvoicePdf?: boolean;
  /** Préparation bloquante exécutée au vrai clic d'envoi, jamais à l'ouverture. */
  beforeSend?: (() => Promise<void>) | undefined;
  /** Conversation créée, y compris si le fournisseur de courriel l'a refusée. */
  onSent?: (conversationId: string) => void;
  /** Courriel effectivement accepté par le fournisseur. */
  onDelivered?: (conversationId: string) => void;
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
  attachInvoicePdf = false,
  beforeSend,
  onSent,
  onDelivered,
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
  const [preparing, setPreparing] = useState(false);

  const eligible = (contacts.data ?? []).filter(
    (c) => c.portal_enabled && c.email !== null && c.email !== '',
  );
  // Un seul interlocuteur possible : pas la peine de le demander.
  const effectiveContactId = contactId || (eligible.length === 1 ? eligible[0]!.id : '');

  const reset = () => {
    setContactId('');
    setSubject(defaultSubject);
    setBody(defaultBody);
    setError(null);
    setFailed(null);
    setPreparing(false);
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
            void (async () => {
              setError(null);
              setFailed(null);
              setPreparing(true);
              try {
                await beforeSend?.();
                const result = await send.mutateAsync({
                  contactId: effectiveContactId,
                  subject: subject.trim(),
                  body: body.trim(),
                  ...link,
                  ...(attachInvoicePdf && link?.invoiceId
                    ? { attachInvoiceId: link.invoiceId }
                    : {}),
                });
                onSent?.(result.conversationId);
                if (result.status === 'failed') {
                  setFailed(result.error ?? 'L’e-mail n’a pas pu être envoyé.');
                  return;
                }
                setOpen(false);
                reset();
                onDelivered?.(result.conversationId);
              } catch (cause) {
                setError(cause);
              } finally {
                setPreparing(false);
              }
            })();
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
            hint={
              attachInvoicePdf
                ? 'Le PDF de la facture est joint à l’e-mail. Le client le retrouve aussi dans son espace client, rubrique « Mes factures ».'
                : 'Le client reçoit ce message par e-mail et le retrouve dans son espace client. Il peut répondre depuis les deux.'
            }
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
              disabled={
                send.isPending ||
                preparing ||
                effectiveContactId === '' ||
                subject.trim() === '' ||
                body.trim() === ''
              }
            >
              <Send className="size-4" />
              {preparing ? 'Préparation…' : send.isPending ? 'Envoi…' : 'Envoyer'}
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
