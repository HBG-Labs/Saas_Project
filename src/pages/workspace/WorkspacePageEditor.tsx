import { Sparkles, Star, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import { ErrorState } from '@/components/feedback/ErrorState';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { Textarea } from '@/components/ui/Textarea';
import { ROUTES } from '@/config/routes';
import { useAiAssistant } from '@/features/ai';
import { PERMISSIONS, usePermission } from '@/features/organizations';
import {
  textToTiptapDocument,
  useCreatePage,
  useDeletePage,
  useFavorites,
  usePage,
  useSaveAsTemplate,
  useSavePage,
  useSetPageIcon,
  useToggleFavorite,
  useTouchPage,
  type WorkspacePage,
} from '@/features/workspace';

import { WorkspaceRecorder } from './WorkspaceRecorder';

/*
  ÉCHAFAUDAGE — éditeur provisoire.

  Le contenu d'une page est un document TipTap (JSON). Sans l'éditeur (à venir
  avec les écrans de Codex), on édite le TEXTE extrait par la base
  (`search_text`) et on le réenregistre en document minimal : titres `#`,
  listes `-`/`1.`, paragraphes. La mise en forme riche d'une page créée par
  l'éditeur final serait perdue ici — c'est pourquoi cet écran n'est pas un
  livrable.
*/

export function WorkspacePageEditor({
  pageId,
  organizationId,
}: {
  pageId: string;
  organizationId: string | null;
}) {
  const page = usePage(pageId);
  if (page.isLoading) return <ListSkeleton rows={6} />;
  if (page.isError) return <ErrorState error={page.error} title="Page inaccessible" />;
  if (!page.data) return <ErrorState error={null} title="Page introuvable" />;
  // Le formulaire naît avec la page chargée : son état initial vient des
  // props, sans effet. Le parent le remonte à chaque changement de page (`key`).
  return <PageForm page={page.data} organizationId={organizationId} />;
}

function PageForm({
  page: loaded,
  organizationId,
}: {
  page: WorkspacePage;
  organizationId: string | null;
}) {
  const pageId = loaded.id;
  const navigate = useNavigate();
  const { can } = usePermission();
  const canEdit = can(PERMISSIONS.workspaceEdit);
  const canManage = can(PERMISSIONS.workspaceManage);
  const canAi = can(PERMISSIONS.aiWorkspace);

  const favorites = useFavorites(organizationId);
  const touch = useTouchPage();
  const save = useSavePage();
  const setIcon = useSetPageIcon();
  const toggleFavorite = useToggleFavorite();
  const saveAsTemplate = useSaveAsTemplate();
  const deletePage = useDeletePage();
  const createPage = useCreatePage();

  const [title, setTitle] = useState(loaded.title);
  const [text, setText] = useState(loaded.search_text ?? '');
  const [icon, setIconValue] = useState(loaded.icon ?? '');
  // L'`updated_at` que la base comparera à l'enregistrement : celui de
  // l'ouverture, puis celui de chaque écriture réussie depuis ce formulaire.
  const [loadedAt, setLoadedAt] = useState(loaded.updated_at);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (organizationId) touch.mutate({ pageId, organizationId });
    // À l'ouverture seulement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId, organizationId]);

  const isFavorite = useMemo(
    () => (favorites.data ?? []).some((f) => f.page_id === pageId),
    [favorites.data, pageId],
  );

  const ai = useAiAssistant({ pageId });
  const [question, setQuestion] = useState('');
  const lastAnswer = [...ai.messages]
    .reverse()
    .find((m) => m.role === 'assistant' && m.id !== 'msg-init');

  const handleSave = async () => {
    setMessage(null);
    try {
      const saved = await save.mutateAsync({
        pageId,
        expectedUpdatedAt: loadedAt,
        title,
        content: textToTiptapDocument(text),
      });
      setLoadedAt(saved.updated_at);
      setMessage('Enregistré.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Échec de l'enregistrement.");
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Supprimer cette page ? Ses révisions sont conservées.')) return;
    await deletePage.mutateAsync({ pageId, spaceId: loaded.space_id });
    await navigate(ROUTES.workspacePages);
  };

  const handleCreateFromAnswer = async () => {
    if (!lastAnswer) return;
    const created = await createPage.mutateAsync({
      spaceId: loaded.space_id,
      parentPageId: loaded.id,
      title: `${loaded.title} — brouillon IA`,
    });
    await save.mutateAsync({
      pageId: created.id,
      expectedUpdatedAt: created.updated_at,
      title: created.title,
      content: textToTiptapDocument(lastAnswer.content),
    });
    await navigate(ROUTES.workspacePage(created.id));
  };

  return (
    <div className="workspace-editor min-w-0 space-y-5">
      <section className="border-border bg-surface overflow-hidden rounded-xl border">
        <div className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-wrap items-end gap-2">
            <Input
              label="Icône"
              className="w-20"
              value={icon}
              maxLength={40}
              placeholder="Page"
              disabled={!canEdit}
              onChange={(e) => setIconValue(e.target.value)}
              onBlur={() => {
                const next = icon.trim() === '' ? null : icon.trim();
                if (next !== (loaded.icon ?? null)) {
                  setIcon.mutate(
                    { pageId, icon: next },
                    { onSuccess: (saved) => setLoadedAt(saved.updated_at) },
                  );
                }
              }}
            />
            <div className="min-w-0 flex-1 basis-48">
              <Input
                label="Titre"
                value={title}
                disabled={!canEdit}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <Button
              type="button"
              variant={isFavorite ? 'primary' : 'outline'}
              size="icon"
              aria-label={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              aria-pressed={isFavorite}
              disabled={!organizationId}
              onClick={() =>
                organizationId &&
                toggleFavorite.mutate({ pageId, favorite: !isFavorite, organizationId })
              }
            >
              <Star aria-hidden />
            </Button>
          </div>

          <Textarea
            label="Contenu de la page"
            className="workspace-page-text"
            rows={8}
            value={text}
            disabled={!canEdit}
            onChange={(e) => setText(e.target.value)}
            hint="Édition texte : # titre, - liste, 1. liste numérotée. Les autres mises en forme ne sont pas prises en charge."
          />

          <div className="border-border flex flex-wrap items-center gap-2 border-t pt-4">
            {canEdit ? (
              <Button type="button" onClick={() => void handleSave()} isLoading={save.isPending}>
                Enregistrer
              </Button>
            ) : null}
            {canManage && organizationId ? (
              <Button
                type="button"
                variant="secondary"
                isLoading={saveAsTemplate.isPending}
                onClick={() =>
                  saveAsTemplate.mutate(
                    {
                      organizationId,
                      page: { title, content: textToTiptapDocument(text), icon: icon || null },
                    },
                    { onSuccess: () => setMessage('Modèle enregistré.') },
                  )
                }
              >
                Enregistrer comme modèle
              </Button>
            ) : null}
            {canEdit ? (
              <Button
                type="button"
                variant="danger-outline"
                onClick={() => void handleDelete()}
                isLoading={deletePage.isPending}
              >
                <Trash2 aria-hidden /> Supprimer
              </Button>
            ) : null}
            {message ? (
              <span role="status" className="text-muted-foreground text-sm">
                {message}
              </span>
            ) : null}
            <span className="text-muted-foreground ml-auto text-xs">
              Modifiée le {new Date(loadedAt).toLocaleString('fr-FR')}
            </span>
          </div>
        </div>
      </section>

      {canAi ? <WorkspaceRecorder page={loaded} /> : null}

      {canAi ? (
        <section className="border-border bg-surface overflow-hidden rounded-xl border">
          <div className="space-y-4 p-4 sm:p-6">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="size-4" aria-hidden /> Assistant sur cette page
            </p>
            {ai.isQuotaExceeded ? (
              <p className="text-error text-xs">Quota mensuel de l'Assistant IA épuisé.</p>
            ) : null}
            {ai.isDegraded ? (
              <p className="text-muted-foreground text-xs">
                L'assistant a répondu sans accès au serveur : la page n'a pas été lue.
              </p>
            ) : null}
            {ai.error ? <p className="text-error text-xs">{ai.error}</p> : null}
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {ai.messages
                .filter((m) => m.id !== 'msg-init')
                .map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-lg px-3 py-3 text-sm leading-relaxed break-words whitespace-pre-wrap ${
                      m.role === 'user' ? 'bg-surface-sunken' : 'bg-surface-hover'
                    }`}
                  >
                    {m.content}
                  </div>
                ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="min-w-0 flex-1">
                <Input
                  aria-label="Question à l'assistant"
                  placeholder="Résume cette page… / Rédige une section sur…"
                  value={question}
                  disabled={ai.isGenerating || ai.isQuotaExceeded}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && question.trim()) {
                      void ai.sendMessage(question);
                      setQuestion('');
                    }
                  }}
                />
              </div>
              <Button
                type="button"
                isLoading={ai.isGenerating}
                disabled={!question.trim() || ai.isQuotaExceeded}
                onClick={() => {
                  void ai.sendMessage(question);
                  setQuestion('');
                }}
              >
                Envoyer
              </Button>
            </div>
            {lastAnswer && canEdit ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setText((t) => `${t.trimEnd()}\n\n${lastAnswer.content}`)}
                >
                  Insérer dans la page
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  isLoading={createPage.isPending}
                  onClick={() => void handleCreateFromAnswer()}
                >
                  Créer une sous-page avec cette réponse
                </Button>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
