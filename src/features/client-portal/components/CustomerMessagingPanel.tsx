import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCheck,
  Lock,
  LockOpen,
  Mail,
  Paperclip,
  Send,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { AtelierIllustration } from '@/components/feedback/AtelierIllustration';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { FormError } from '@/components/feedback/FormError';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ListSkeleton, Skeleton } from '@/components/ui/Skeleton';
import { Textarea } from '@/components/ui/Textarea';
import { cn } from '@/lib/cn';
import type { ClientMessageStatus } from '@/types/database';

import {
  getMessageAttachmentUrl,
  type ClientConversationWithContact,
  type ClientMessageAttachment,
} from '../api/client-portal.api';
import {
  useClientConversations,
  useClientMessages,
  useClientPortalAccess,
  useCloseConversation,
  useMarkConversationRead,
  useSendClientMessage,
} from '../hooks/useClientPortal';
import { SendToClientDialog, WriteToClientButton } from './SendToClientDialog';

export interface CustomerMessagingPanelProps {
  organizationId: string;
  customerId: string;
}

const STATUS_LABELS: Record<
  ClientMessageStatus,
  { label: string; tone: 'muted' | 'success' | 'error' }
> = {
  queued: { label: 'En attente', tone: 'muted' },
  sent: { label: 'Envoyé', tone: 'muted' },
  delivered: { label: 'Distribué', tone: 'success' },
  failed: { label: 'Échec d’envoi', tone: 'error' },
  bounced: { label: 'Adresse refusée', tone: 'error' },
  complained: { label: 'Signalé indésirable', tone: 'error' },
  received: { label: 'Reçu', tone: 'muted' },
};

function dateHeure(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

function nomContact(c: ClientConversationWithContact['contact']): string {
  if (c === null) return 'Contact';
  return (
    [c.first_name, c.last_name].filter((p) => p !== null && p !== '').join(' ') ||
    c.email ||
    'Contact'
  );
}

/**
 * Messagerie d'un client, vue entreprise.
 *
 * Mobile d'abord : une seule colonne — la liste des conversations, puis le
 * fil quand on en ouvre une. Sur écran large, les deux côte à côte.
 */
export function CustomerMessagingPanel({
  organizationId,
  customerId,
}: CustomerMessagingPanelProps) {
  const access = useClientPortalAccess();
  const conversations = useClientConversations(organizationId, customerId, access.canView);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!access.canView) return null;
  if (conversations.isPending) return <ListSkeleton />;
  if (conversations.isError) {
    return (
      <ErrorState
        error={conversations.error}
        onRetry={() => {
          void conversations.refetch();
        }}
      />
    );
  }

  const list = conversations.data ?? [];
  const selected = list.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      {!access.isEnabled ? (
        <p className="border-warning-border bg-warning-subtle text-warning rounded-xl border p-3 text-xs">
          Le portail client est désactivé pour votre entreprise : les messages envoyés partent par
          e-mail, mais le client ne pourra pas consulter l’échange en ligne.
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <h3 className="text-foreground text-sm font-semibold">Conversations</h3>
        {access.canSend ? (
          <SendToClientDialog
            customerId={customerId}
            trigger={<WriteToClientButton />}
            onSent={setSelectedId}
          />
        ) : null}
      </div>

      {list.length === 0 ? (
        <EmptyState
          illustration={<AtelierIllustration subject="messages" />}
          title="Aucune conversation"
          description="Écrivez à un interlocuteur ayant accès au portail : il reçoit un e-mail et peut répondre directement, ou depuis son espace client."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
          <ul
            className={cn(
              'divide-border border-border divide-y rounded-xl border',
              selected !== null && 'hidden lg:block',
            )}
          >
            {list.map((conversation) => {
              const isActive = conversation.id === selectedId;
              return (
                <li key={conversation.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(conversation.id);
                    }}
                    className={cn(
                      'flex w-full flex-col gap-1 px-3 py-3 text-left transition-colors',
                      isActive ? 'bg-primary-subtle' : 'hover:bg-surface-hover',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          'truncate text-sm',
                          conversation.unread_count > 0
                            ? 'text-foreground font-semibold'
                            : 'text-foreground',
                        )}
                      >
                        {conversation.subject}
                      </span>
                      {conversation.unread_count > 0 ? (
                        <Badge
                          variant="primary"
                          aria-label={`${conversation.unread_count} non lu(s)`}
                        >
                          {conversation.unread_count}
                        </Badge>
                      ) : conversation.status === 'closed' ? (
                        <Lock
                          className="text-muted-foreground size-3.5 shrink-0"
                          aria-label="Close"
                        />
                      ) : null}
                    </div>
                    <span className="text-muted-foreground truncate text-xs">
                      {nomContact(conversation.contact)}
                      {conversation.last_message_at !== null
                        ? ` · ${dateHeure(conversation.last_message_at)}`
                        : ''}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {selected === null ? (
            <p className="text-muted-foreground hidden self-center text-center text-xs lg:block">
              Sélectionnez une conversation.
            </p>
          ) : (
            <ConversationThread
              conversation={selected}
              canSend={access.canSend}
              onBack={() => {
                setSelectedId(null);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ConversationThread({
  conversation,
  canSend,
  onBack,
}: {
  conversation: ClientConversationWithContact;
  canSend: boolean;
  onBack: () => void;
}) {
  const messages = useClientMessages(conversation.id);
  const markRead = useMarkConversationRead();
  const close = useCloseConversation();
  const send = useSendClientMessage();
  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState<unknown>(null);
  const [lastOutcome, setLastOutcome] = useState<'sent' | 'failed' | null>(null);

  // Ouvrir le fil, c'est lire : les non-lus s'effacent côté entreprise.
  useEffect(() => {
    if (conversation.unread_count > 0 && !markRead.isPending) markRead.mutate(conversation.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une seule fois par ouverture de fil
  }, [conversation.id]);

  const isClosed = conversation.status === 'closed';

  const submit = () => {
    const body = draft.trim();
    if (body.length === 0) return;
    setSendError(null);
    setLastOutcome(null);
    send.mutate(
      { conversationId: conversation.id, body },
      {
        onSuccess: (result) => {
          setLastOutcome(result.status === 'failed' ? 'failed' : 'sent');
          if (result.status !== 'failed') setDraft('');
        },
        onError: (e) => {
          setSendError(e);
        },
      },
    );
  };

  return (
    <div className="border-border flex min-h-[24rem] flex-col rounded-xl border">
      <div className="border-border flex items-center gap-2 border-b px-3 py-2">
        <Button
          variant="ghost"
          size="icon-sm"
          className="lg:hidden"
          onClick={onBack}
          aria-label="Retour aux conversations"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="text-foreground truncate text-sm font-semibold">{conversation.subject}</p>
          <p className="text-muted-foreground truncate text-xs">
            {nomContact(conversation.contact)}
            {conversation.contact?.email ? ` · ${conversation.contact.email}` : ''}
          </p>
        </div>
        {canSend ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={close.isPending}
            isLoading={close.isPending}
            loadingLabel={
              isClosed ? 'Réouverture de la conversation' : 'Clôture de la conversation'
            }
            leadingIcon={isClosed ? <LockOpen className="size-4" /> : <Lock className="size-4" />}
            onClick={() => {
              close.mutate({ conversationId: conversation.id, closed: !isClosed });
            }}
          >
            {isClosed ? 'Rouvrir' : 'Clore'}
          </Button>
        ) : null}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {messages.isPending ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-3/4" />
            <Skeleton className="ml-auto h-16 w-3/4" />
          </div>
        ) : messages.isError ? (
          <ErrorState
            error={messages.error}
            onRetry={() => {
              void messages.refetch();
            }}
          />
        ) : (messages.data ?? []).length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-xs">Aucun message.</p>
        ) : (
          (messages.data ?? []).map((message) => {
            const mine = message.direction === 'outbound';
            const status = STATUS_LABELS[message.status];
            return (
              <div key={message.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[85%] space-y-1 rounded-2xl px-3 py-2 text-sm sm:max-w-[75%]',
                    mine
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-surface-sunken text-foreground',
                  )}
                >
                  <p className="break-words whitespace-pre-wrap">{message.body_text}</p>
                  {message.attachments.length > 0 ? (
                    <ul className="space-y-1">
                      {message.attachments.map((piece) => (
                        <AttachmentLink key={piece.id} piece={piece} light={mine} />
                      ))}
                    </ul>
                  ) : null}
                  <p
                    className={cn(
                      'flex items-center gap-1 text-xs',
                      mine ? 'text-primary-foreground/80' : 'text-muted-foreground',
                    )}
                  >
                    {message.channel === 'email' && !mine ? (
                      <Mail className="size-3" aria-label="Reçu par e-mail" />
                    ) : null}
                    {dateHeure(message.created_at)}
                    {mine ? (
                      <span
                        className={cn(
                          'ml-1 inline-flex items-center gap-0.5',
                          status.tone === 'error' && 'text-warning font-semibold',
                        )}
                      >
                        {status.tone === 'error' ? (
                          <AlertTriangle className="size-3" />
                        ) : message.status === 'delivered' ? (
                          <CheckCheck className="size-3" />
                        ) : (
                          <Check className="size-3" />
                        )}
                        {status.label}
                      </span>
                    ) : null}
                  </p>
                  {mine && message.error !== null ? (
                    <p className="text-primary-foreground/90 text-xs italic">{message.error}</p>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>

      {canSend ? (
        <form
          className="border-border space-y-2 border-t p-3"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <FormError error={sendError} />
          {lastOutcome === 'failed' ? (
            <p className="text-error text-xs" role="alert">
              Le message est enregistré mais l’e-mail n’est pas parti. Le motif est affiché sous le
              message.
            </p>
          ) : lastOutcome === 'sent' ? (
            <p className="text-success text-xs" role="status">
              Message envoyé.
            </p>
          ) : null}
          <Textarea
            label="Votre message"
            hideLabel
            rows={3}
            placeholder={
              isClosed ? 'Conversation close — rouvrez-la pour écrire.' : 'Écrire au client…'
            }
            value={draft}
            maxLength={20000}
            disabled={isClosed || send.isPending}
            onChange={(event) => {
              setDraft(event.target.value);
            }}
          />
          <div className="flex justify-end">
            <Button
              type="submit"
              size="sm"
              disabled={isClosed || send.isPending || draft.trim().length === 0}
              isLoading={send.isPending}
              loadingLabel="Envoi du message au client"
              leadingIcon={<Send className="size-4" />}
            >
              {send.isPending ? 'Envoi…' : 'Envoyer'}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function AttachmentLink({ piece, light }: { piece: ClientMessageAttachment; light: boolean }) {
  return (
    <li>
      <button
        type="button"
        className={cn(
          'inline-flex items-center gap-1 text-xs underline',
          light ? 'text-primary-foreground' : 'text-primary',
        )}
        onClick={() => {
          void getMessageAttachmentUrl(piece.storage_path).then((url) => {
            if (url !== null) window.open(url, '_blank', 'noopener');
          });
        }}
      >
        <Paperclip className="size-3" aria-hidden="true" />
        {piece.file_name}
      </button>
    </li>
  );
}
