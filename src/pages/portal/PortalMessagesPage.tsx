import { ArrowLeft, Lock, MessageSquare, Paperclip, Plus, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { FormError } from '@/components/feedback/FormError';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ListSkeleton, Skeleton } from '@/components/ui/Skeleton';
import { Textarea } from '@/components/ui/Textarea';
import {
  FileOpenButton,
  formatDateFr,
  PortalPageHeader,
  useMarkReadByClient,
  usePortalConversations,
  usePortalMessages,
  useSendPortalMessage,
  type PortalConversation,
} from '@/features/portal';
import { cn } from '@/lib/cn';
import { useDocumentTitle } from '@/lib/use-document-title';
import type { PortalContext } from '@/types/database';

/**
 * Messagerie côté client. Même disposition que côté entreprise — liste puis
 * fil sur téléphone, les deux côte à côte sur écran large — mais sans aucun
 * statut de distribution : le client n'a pas à savoir par quel chemin
 * technique son message est parti.
 */
export default function PortalMessagesPage() {
  useDocumentTitle('Messagerie — Espace client');
  const context = useOutletContext<PortalContext>();
  const conversations = usePortalConversations();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const list = conversations.data ?? [];
  const selected = list.find((c) => c.id === selectedId) ?? null;

  return (
    <div>
      <div className={cn(selected !== null && 'hidden lg:block')}>
        <PortalPageHeader
          title="Messagerie"
          description={`Retrouvez vos échanges avec ${context.organization_name} et répondez depuis un fil unique.`}
          icon={MessageSquare}
          tone="accent"
          summary={
            conversations.isSuccess ? (
              <Badge variant="neutral" size="button">
                {list.length} conversation{list.length > 1 ? 's' : ''}
              </Badge>
            ) : null
          }
          action={
            context.allow_client_initiated ? (
              <NewConversationDialog onCreated={setSelectedId} />
            ) : null
          }
        />
      </div>

      {conversations.isPending ? (
        <ListSkeleton />
      ) : conversations.isError ? (
        <ErrorState
          error={conversations.error}
          onRetry={() => {
            void conversations.refetch();
          }}
        />
      ) : list.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="Aucun échange pour le moment"
          description={
            context.allow_client_initiated
              ? 'Écrivez-nous : votre message arrive directement à l’équipe.'
              : 'Les messages que vous recevrez apparaîtront ici. Vous pourrez y répondre.'
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
          <ul
            className={cn(
              'divide-border border-border bg-surface divide-y overflow-hidden rounded-2xl border shadow-xs',
              selected !== null && 'hidden lg:block',
            )}
          >
            {list.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(c.id);
                  }}
                  className={cn(
                    'group focus-visible:ring-primary flex min-h-[4.75rem] w-full items-start gap-3 px-3 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset',
                    c.id === selectedId ? 'bg-primary-subtle' : 'hover:bg-surface-hover',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors',
                      c.unread_count > 0
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-surface-sunken text-muted-foreground group-hover:text-foreground',
                    )}
                  >
                    <MessageSquare className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={cn(
                          'text-foreground line-clamp-2 text-sm',
                          c.unread_count > 0 && 'font-semibold',
                        )}
                      >
                        {c.subject}
                      </span>
                      {c.unread_count > 0 ? (
                        <span
                          className="bg-primary text-primary-foreground min-w-5 rounded-full px-1.5 text-center text-xs leading-5 font-bold"
                          aria-label={`${c.unread_count} non lu(s)`}
                        >
                          {c.unread_count}
                        </span>
                      ) : c.status === 'closed' ? (
                        <Badge variant="neutral">
                          <Lock aria-hidden="true" />
                          Clos
                        </Badge>
                      ) : null}
                    </div>
                    <span className="text-muted-foreground mt-1 block text-xs">
                      {formatDateFr(c.last_message_at, true)}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>

          {selected === null ? (
            <div className="border-border bg-surface hidden min-h-[30rem] flex-col items-center justify-center rounded-2xl border p-8 text-center shadow-xs lg:flex">
              <span className="bg-accent-subtle text-accent flex size-12 items-center justify-center rounded-2xl">
                <MessageSquare className="size-6" aria-hidden="true" />
              </span>
              <p className="text-foreground mt-3 text-sm font-semibold">Ouvrez une conversation</p>
              <p className="text-muted-foreground mt-1 max-w-xs text-xs">
                Sélectionnez un échange dans la liste pour lire les messages et répondre.
              </p>
            </div>
          ) : (
            <Thread
              conversation={selected}
              organizationName={context.organization_name}
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

function Thread({
  conversation,
  organizationName,
  onBack,
}: {
  conversation: PortalConversation & { unread_count: number };
  organizationName: string;
  onBack: () => void;
}) {
  const messages = usePortalMessages(conversation.id);
  const markRead = useMarkReadByClient();
  const send = useSendPortalMessage();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (conversation.unread_count > 0 && !markRead.isPending) markRead.mutate(conversation.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une seule fois par ouverture de fil
  }, [conversation.id]);

  const isClosed = conversation.status === 'closed';

  return (
    <section className="border-border bg-surface flex h-[calc(100dvh-9.5rem)] min-h-[28rem] flex-col overflow-hidden rounded-2xl border shadow-xs lg:h-[40rem]">
      <header className="border-border bg-surface-sunken/40 flex items-center gap-2 border-b px-3 py-2.5 sm:px-4">
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
          <h2 className="text-foreground truncate text-sm font-semibold">{conversation.subject}</h2>
          <p className="text-muted-foreground truncate text-xs">Échange avec {organizationName}</p>
        </div>
        {isClosed ? (
          <Badge variant="neutral">
            <Lock aria-hidden="true" />
            Conversation close
          </Badge>
        ) : null}
      </header>

      <div className="bg-background/40 flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
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
          <div className="flex h-full flex-col items-center justify-center text-center">
            <span className="bg-surface-sunken text-muted-foreground flex size-10 items-center justify-center rounded-xl">
              <MessageSquare className="size-5" aria-hidden="true" />
            </span>
            <p className="text-foreground mt-2 text-sm font-semibold">Aucun message</p>
            <p className="text-muted-foreground mt-1 text-xs">Le premier message apparaîtra ici.</p>
          </div>
        ) : (
          (messages.data ?? []).map((m) => {
            const mine = m.direction === 'inbound';
            return (
              <article
                key={m.id}
                className={cn('flex', mine ? 'justify-end' : 'justify-start')}
                aria-label={mine ? 'Votre message' : `Message de ${organizationName}`}
              >
                <div
                  className={cn(
                    'max-w-[88%] space-y-1.5 rounded-2xl px-3 py-2.5 text-sm shadow-xs sm:max-w-[75%]',
                    mine
                      ? 'bg-primary text-primary-foreground rounded-tr-md'
                      : 'border-border bg-surface text-foreground rounded-tl-md border',
                  )}
                >
                  {!mine ? (
                    <p className="text-muted-foreground text-[11px] font-semibold">
                      {organizationName}
                    </p>
                  ) : null}
                  <p className="break-words whitespace-pre-wrap">{m.body_text}</p>
                  {m.attachments.length > 0 ? (
                    <ul className="space-y-1">
                      {m.attachments.map((piece) => (
                        <li key={piece.id} className="flex min-w-0 items-center gap-1 text-xs">
                          <Paperclip className="size-3" aria-hidden="true" />
                          <FileOpenButton
                            bucket="client-message-attachments"
                            path={piece.storage_path}
                            label={piece.file_name}
                            className="max-w-full min-w-0"
                          />
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <p
                    className={cn(
                      'text-[11px]',
                      mine ? 'text-primary-foreground/80' : 'text-muted-foreground',
                    )}
                  >
                    {formatDateFr(m.created_at, true)}
                  </p>
                </div>
              </article>
            );
          })
        )}
      </div>

      <form
        className="border-border bg-surface space-y-2 border-t p-3 sm:p-4"
        onSubmit={(event) => {
          event.preventDefault();
          const body = draft.trim();
          if (body.length === 0) return;
          setError(null);
          setSent(false);
          send.mutate(
            { conversationId: conversation.id, body },
            {
              onSuccess: () => {
                setDraft('');
                setSent(true);
              },
              onError: (e) => {
                setError(e);
              },
            },
          );
        }}
      >
        <FormError error={error} />
        {sent ? (
          <p className="text-success text-xs" role="status">
            Message envoyé.
          </p>
        ) : null}
        <Textarea
          label="Votre message"
          hideLabel
          rows={3}
          placeholder={isClosed ? 'Cette conversation est close.' : 'Votre réponse…'}
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
            loadingLabel="Envoi du message"
            leadingIcon={<Send className="size-4" />}
            className="w-full min-[380px]:w-auto"
          >
            {send.isPending ? 'Envoi…' : 'Envoyer'}
          </Button>
        </div>
      </form>
    </section>
  );
}

function NewConversationDialog({ onCreated }: { onCreated: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const send = useSendPortalMessage();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<unknown>(null);

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Nouveau message"
      trigger={
        <Button size="sm" className="w-full min-[380px]:w-auto">
          <Plus className="size-4" />
          Nous écrire
        </Button>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          send.mutate(
            { subject: subject.trim(), body: body.trim() },
            {
              onSuccess: (result) => {
                setOpen(false);
                setSubject('');
                setBody('');
                onCreated(result.conversationId);
              },
              onError: (e) => {
                setError(e);
              },
            },
          );
        }}
      >
        <FormError error={error} />
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
          rows={5}
          maxLength={20000}
          value={body}
          onChange={(event) => {
            setBody(event.target.value);
          }}
        />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setOpen(false);
            }}
            className="w-full sm:w-auto"
          >
            Annuler
          </Button>
          <Button
            type="submit"
            disabled={send.isPending || subject.trim() === '' || body.trim() === ''}
            isLoading={send.isPending}
            loadingLabel="Envoi du nouveau message"
            leadingIcon={<Send className="size-4" />}
            className="w-full sm:w-auto"
          >
            {send.isPending ? 'Envoi…' : 'Envoyer'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
