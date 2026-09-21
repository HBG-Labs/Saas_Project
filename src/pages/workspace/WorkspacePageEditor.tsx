import { Ellipsis, ImagePlus, LockKeyhole, Share2, Sparkles, Star } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { ErrorState } from '@/components/feedback/ErrorState';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { Textarea } from '@/components/ui/Textarea';
import { ROUTES } from '@/config/routes';
import { useAiAssistant } from '@/features/ai';
import { PERMISSIONS, usePermission } from '@/features/organizations';
import {
  textToTiptapDocument,
  useCreatePage,
  useCoverUrl,
  useFavorites,
  useMovePage,
  usePage,
  usePageRevisions,
  usePages,
  useSaveAsTemplate,
  useSavePage,
  useSetPageIcon,
  useToggleFavorite,
  useTouchPage,
  useUpdatePagePresentation,
  useUploadPageCover,
  WorkspacePageOptionsPanel,
  type WorkspacePage,
} from '@/features/workspace';
import { cn } from '@/lib/cn';

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
  const movePage = useMovePage();
  const updatePresentation = useUpdatePagePresentation();
  const uploadCover = useUploadPageCover();
  const createPage = useCreatePage();
  const pages = usePages(loaded.space_id);
  const revisions = usePageRevisions(pageId);
  const coverUrl = useCoverUrl(loaded.cover_path);

  const [title, setTitle] = useState(loaded.title);
  const [text, setText] = useState(loaded.search_text ?? '');
  const [icon, setIconValue] = useState(loaded.icon ?? '');
  // L'`updated_at` que la base comparera à l'enregistrement : celui de
  // l'ouverture, puis celui de chaque écriture réussie depuis ce formulaire.
  const [loadedAt, setLoadedAt] = useState(loaded.updated_at);
  const [message, setMessage] = useState<string | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [parentPageId, setParentPageId] = useState(loaded.parent_page_id ?? 'root');
  const importInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

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

  const handleArchive = async () => {
    if (!window.confirm('Déplacer cette page dans la corbeille ?')) return;
    await movePage.mutateAsync({ pageId, patch: { archived_at: new Date().toISOString() } });
    await navigate(ROUTES.workspacePages);
  };

  const handleDuplicate = async () => {
    const created = await createPage.mutateAsync({
      spaceId: loaded.space_id,
      parentPageId: loaded.parent_page_id,
      title: `${title || 'Sans titre'} — copie`,
    });
    await save.mutateAsync({
      pageId: created.id,
      expectedUpdatedAt: created.updated_at,
      title: created.title,
      content: textToTiptapDocument(text),
    });
    await navigate(ROUTES.workspacePage(created.id));
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setMessage('Lien copié.');
  };

  const copyContent = async () => {
    await navigator.clipboard.writeText(`${title}\n\n${text}`.trim());
    setMessage('Contenu copié.');
  };

  const exportMarkdown = () => {
    const blob = new Blob([`# ${title}\n\n${text}`], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${
      title
        .trim()
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-|-$/g, '') || 'page'
    }.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handlePresentationChange = async (
    patch: Partial<Pick<WorkspacePage, 'font_family' | 'small_text' | 'full_width' | 'locked'>>,
  ) => {
    const saved = await updatePresentation.mutateAsync({ pageId, patch });
    setLoadedAt(saved.updated_at);
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
    <div
      className={cn(
        'workspace-editor min-w-0 space-y-5 transition-all',
        loaded.full_width ? 'w-full' : 'mx-auto max-w-5xl',
        loaded.font_family === 'serif' && 'font-serif',
        loaded.font_family === 'mono' && 'font-mono',
      )}
    >
      <section className="bg-surface min-h-[36rem] overflow-hidden rounded-xl">
        {coverUrl.data ? (
          <div className="h-44 w-full overflow-hidden sm:h-56">
            <img
              src={coverUrl.data}
              alt="Couverture de la page"
              className="h-full w-full object-cover"
            />
          </div>
        ) : null}

        <header className="border-border flex min-h-12 items-center gap-2 border-b px-3 sm:px-5">
          <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
            {icon || '📄'} {title || 'Sans titre'} {loaded.locked ? '· Verrouillée' : '· Privée'}
          </span>
          <span className="text-muted-foreground hidden text-xs md:inline">
            Dernière modification : {new Date(loadedAt).toLocaleString('fr-FR')}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={() => void copyLink()}
          >
            <Share2 className="size-4" aria-hidden /> Partager
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            aria-pressed={isFavorite}
            disabled={!organizationId}
            onClick={() =>
              organizationId &&
              toggleFavorite.mutate({ pageId, favorite: !isFavorite, organizationId })
            }
          >
            <Star className={cn('size-4', isFavorite && 'fill-current')} aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Options de la page"
            aria-expanded={optionsOpen}
            onClick={() => setOptionsOpen((open) => !open)}
          >
            <Ellipsis className="size-5" aria-hidden />
          </Button>
        </header>

        <div
          className={cn(
            'mx-auto px-5 pt-10 pb-12 sm:px-10',
            loaded.full_width ? 'max-w-none' : 'max-w-3xl',
          )}
        >
          {canEdit && !loaded.locked ? (
            <div className="text-muted-foreground mb-4 flex flex-wrap gap-3 text-xs">
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                className="hover:text-foreground flex items-center gap-1.5"
              >
                <ImagePlus className="size-3.5" />
                {loaded.cover_path ? 'Changer la couverture' : 'Ajouter une couverture'}
              </button>
              {loaded.locked ? (
                <span className="flex items-center gap-1">
                  <LockKeyhole className="size-3.5" />
                  Page verrouillée
                </span>
              ) : null}
            </div>
          ) : null}
          <div className="flex items-start gap-3">
            <input
              aria-label="Icône de la page"
              value={icon}
              maxLength={40}
              placeholder="✏️"
              disabled={!canEdit || loaded.locked}
              onChange={(event) => setIconValue(event.target.value)}
              onBlur={() => {
                const next = icon.trim() === '' ? null : icon.trim();
                if (next !== (loaded.icon ?? null))
                  setIcon.mutate(
                    { pageId, icon: next },
                    { onSuccess: (saved) => setLoadedAt(saved.updated_at) },
                  );
              }}
              className="w-14 border-0 bg-transparent text-4xl outline-none disabled:opacity-70"
            />
            <input
              aria-label="Titre de la page"
              value={title}
              disabled={!canEdit || loaded.locked}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Sans titre"
              className="text-foreground min-w-0 flex-1 border-0 bg-transparent text-3xl font-black tracking-tight outline-none disabled:opacity-70 sm:text-4xl"
            />
          </div>

          <Textarea
            aria-label="Contenu de la page"
            className={cn(
              'workspace-page-text mt-8 min-h-[20rem] resize-none border-0 bg-transparent px-0 leading-7 shadow-none focus-visible:border-transparent focus-visible:ring-0',
              loaded.small_text ? 'text-xs sm:text-xs' : 'text-base sm:text-base',
            )}
            rows={14}
            value={text}
            disabled={!canEdit || loaded.locked}
            onChange={(event) => setText(event.target.value)}
            placeholder="Cliquez ici et commencez à écrire…"
          />

          <div className="border-border mt-7 flex flex-wrap items-center gap-2 border-t pt-4">
            {canEdit && !loaded.locked ? (
              <Button type="button" onClick={() => void handleSave()} isLoading={save.isPending}>
                Enregistrer
              </Button>
            ) : null}
            {canManage && organizationId && !loaded.locked ? (
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
            {loaded.locked ? (
              <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
                <LockKeyhole className="size-4" />
                Cette page est verrouillée.
              </span>
            ) : null}
            {message ? (
              <span role="status" className="text-muted-foreground text-sm">
                {message}
              </span>
            ) : null}
          </div>
        </div>
      </section>

      <input
        ref={importInputRef}
        type="file"
        accept=".md,.txt,text/plain,text/markdown"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file && file.size <= 1024 * 1024)
            void file.text().then((content) => {
              setText(content);
              setMessage('Contenu importé. Enregistrez pour le conserver.');
            });
          else if (file) setMessage('Le fichier doit faire moins de 1 Mo.');
          event.target.value = '';
        }}
      />
      <input
        ref={coverInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file)
            uploadCover.mutate(
              { page: loaded, file },
              { onSuccess: (saved) => setLoadedAt(saved.updated_at) },
            );
          event.target.value = '';
        }}
      />

      {optionsOpen ? (
        <WorkspacePageOptionsPanel
          page={loaded}
          canEdit={canEdit}
          onClose={() => setOptionsOpen(false)}
          onPresentationChange={(patch) => void handlePresentationChange(patch)}
          onCopyLink={() => void copyLink()}
          onCopyContent={() => void copyContent()}
          onDuplicate={() => void handleDuplicate()}
          onMove={() => setMoveOpen(true)}
          onArchive={() => void handleArchive()}
          onImport={() => importInputRef.current?.click()}
          onExport={exportMarkdown}
          onHistory={() => setHistoryOpen(true)}
        />
      ) : null}

      <Modal
        open={moveOpen}
        onOpenChange={setMoveOpen}
        title="Déplacer la page"
        description="Choisissez sa position dans l’arborescence actuelle."
        footer={
          <Button
            type="button"
            onClick={() =>
              void movePage
                .mutateAsync({
                  pageId,
                  patch: { parent_page_id: parentPageId === 'root' ? null : parentPageId },
                })
                .then(() => setMoveOpen(false))
            }
          >
            Déplacer
          </Button>
        }
      >
        <Select
          label="Page parente"
          value={parentPageId}
          onValueChange={setParentPageId}
          options={[
            { value: 'root', label: 'Racine de l’espace' },
            ...(pages.data ?? [])
              .filter((page) => page.id !== pageId)
              .map((page) => ({ value: page.id, label: `${page.icon ?? '📄'} ${page.title}` })),
          ]}
        />
      </Modal>

      <Modal
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        title="Historique des versions"
        description="Chaque enregistrement remplace la version courante et conserve la précédente."
        size="lg"
      >
        <div className="space-y-2">
          {(revisions.data ?? []).map((revision) => (
            <div key={revision.id} className="border-border rounded-lg border p-3">
              <p className="text-sm font-semibold">{revision.title}</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Remplacée le {new Date(revision.replaced_at).toLocaleString('fr-FR')}
              </p>
            </div>
          ))}
          {!revisions.isLoading && (revisions.data?.length ?? 0) === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              Aucune version antérieure.
            </p>
          ) : null}
        </div>
      </Modal>

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
