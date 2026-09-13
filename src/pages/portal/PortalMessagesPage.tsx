import { ArrowLeft, Lock, MessageSquare, Paperclip, Plus, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { FormError } from '@/components/feedback/FormError';
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
      <div className="flex flex-wrap items-start justify-between gap-2">
        <PortalPageHeader title="Messagerie" description={`Vos échanges avec ${context.organization_name}.`} />
        {context.allow_client_initiated ? <NewConversationDialog onCreated={setSelectedId} /> : null}
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
          <ul className={cn('divide-border border-border divide-y rounded-xl border', selected !== null && 'hidden lg:block')}>
            {list.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(c.id);
                  }}
                  className={cn(
                    'flex w-full flex-col gap-1 px-3 py-3 text-left transition-colors',
                    c.id === selectedId ? 'bg-primary-subtle' : 'hover:bg-surface-hover',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn('truncate text-sm', c.unread_count > 0 ? 'text-foreground font-semibold' : 'text-foreground')}>
                      {c.subject}
                    </span>
                    {c.unread_count > 0 ? (
                      <span className="bg-primary text-primary-foreground rounded-full px-2 text-xs font-bold" aria-label={`${c.unread_count} non lu(s)`}>
                        {c.unread_count}
                      </span>
                    ) : c.status === 'closed' ? (
                      <Lock className="text-muted-foreground size-3.5 shrink-0" aria-label="Conversation close" />
                    ) : null}
                  </div>
                  <span className="text-muted-foreground text-xs">{formatDateFr(c.last_message_at, true)}</span>
                </button>
              </li>
            ))}
          </ul>

          {selected === null ? (
            <p className="text-muted-foreground hidden self-center text-center text-xs lg:block">Sélectionnez une conversation.</p>
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
    <div className="border-border flex min-h-[24rem] flex-col rounded-xl border">
      <div className="border-border flex items-center gap-2 border-b px-3 py-2">
        <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={onBack} aria-label="Retour aux conversations">
          <ArrowLeft className="size-4" />
        </Button>
        <p className="text-foreground min-w-0 flex-1 truncate text-sm font-semibold">{conversation.subject}</p>
        {isClosed ? <Lock className="text-muted-foreground size-4" aria-label="Conversation close" /> : null}
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
        ) : (
          (messages.data ?? []).map((m) => {
            const mine = m.direction === 'inbound';
            return (
              <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[85%] space-y-1 rounded-2xl px-3 py-2 text-sm sm:max-w-[75%]',
                    mine ? 'bg-primary text-primary-foreground' : 'bg-surface-sunken text-foreground',
                  )}
                >
                  {!mine ? <p className="text-muted-foreground text-[11px] font-semibold">{organizationName}</p> : null}
                  <p className="break-words whitespace-pre-wrap">{m.body_text}</p>
                  {m.attachments.length > 0 ? (
                    <ul className="space-y-1">
                      {m.attachments.map((piece) => (
                        <li key={piece.id} className="flex items-center gap-1 text-xs">
                          <Paperclip className="size-3" aria-hidden="true" />
                          <FileOpenButton bucket="client-message-attachments" path={piece.storage_path} label={piece.file_name} />
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <p className={cn('text-[11px]', mine ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                    {formatDateFr(m.created_at, true)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form
        className="border-border space-y-2 border-t p-3"
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
          <Button type="submit" size="sm" disabled={isClosed || send.isPending || draft.trim().length === 0}>
            <Send className="size-4" />
            {send.isPending ? 'Envoi…' : 'Envoyer'}
          </Button>
        </div>
      </form>
    </div>
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
        <Button size="sm">
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
          <Button type="submit" disabled={send.isPending || subject.trim() === '' || body.trim() === ''}>
            <Send className="size-4" />
            {send.isPending ? 'Envoi…' : 'Envoyer'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
