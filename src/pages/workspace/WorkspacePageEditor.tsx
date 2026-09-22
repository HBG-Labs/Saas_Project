import {
  Bell,
  BookOpen,
  Download,
  Ellipsis,
  FileText,
  ImagePlus,
  Languages,
  LockKeyhole,
  Printer,
  Share2,
  Sparkles,
  Star,
  Trash2,
} from 'lucide-react';
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
  usePagePreference,
  usePageRevisions,
  usePages,
  useRemovePageCover,
  useSaveAsTemplate,
  useSavePage,
  useSetPageNotificationLevel,
  useSetPageIcon,
  useToggleFavorite,
  useTouchPage,
  useTasks,
  useUpdatePagePresentation,
  useUploadPageCover,
  WorkspacePageOptionsPanel,
  type WorkspacePage,
} from '@/features/workspace';
import { cn } from '@/lib/cn';

import { WorkspaceRecorder } from './WorkspaceRecorder';

const PAGE_ACCENT_STYLES = {
  blue: { soft: 'bg-primary-subtle', line: 'bg-primary', text: 'text-primary' },
  violet: {
    soft: 'bg-accent-subtle',
    line: 'bg-accent',
    text: 'text-accent',
  },
  emerald: {
    soft: 'bg-success-subtle',
    line: 'bg-success',
    text: 'text-success',
  },
  amber: {
    soft: 'bg-warning-subtle',
    line: 'bg-warning',
    text: 'text-warning',
  },
  rose: { soft: 'bg-error-subtle', line: 'bg-error', text: 'text-error' },
  slate: {
    soft: 'bg-surface-sunken',
    line: 'bg-muted-foreground',
    text: 'text-muted-foreground',
  },
} as const;

const PAGE_ACCENT_LABELS: Record<keyof typeof PAGE_ACCENT_STYLES, string> = {
  blue: 'Bleu',
  violet: 'Violet',
  emerald: 'Émeraude',
  amber: 'Ambre',
  rose: 'Rose',
  slate: 'Ardoise',
};

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
  const connectedTasks = useTasks(loaded.space_id, { pageId });
  const revisions = usePageRevisions(pageId);
  const pagePreference = usePagePreference(pageId);
  const setNotificationLevel = useSetPageNotificationLevel();
  const coverUrl = useCoverUrl(loaded.cover_path);
  const removeCover = useRemovePageCover();

  const [title, setTitle] = useState(loaded.title);
  const [text, setText] = useState(loaded.search_text ?? '');
  const [icon, setIconValue] = useState(loaded.icon ?? '');
  // L'`updated_at` que la base comparera à l'enregistrement : celui de
  // l'ouverture, puis celui de chaque écriture réussie depuis ce formulaire.
  const [loadedAt, setLoadedAt] = useState(loaded.updated_at);
  const [message, setMessage] = useState<string | null>(null);
  // Le texte tel que le serveur le connaît : ce contre quoi on mesure ce qui
  // a changé ailleurs (une transcription écrite pendant que la page est ouverte).
  const [serverText, setServerText] = useState(loaded.search_text ?? '');
  const serveur = loaded.search_text ?? '';
  if (loaded.updated_at !== loadedAt && serveur !== serverText) {
    // La page a bougé sur le serveur pendant qu'elle est ouverte — le cas
    // courant : la transcription d'un enregistrement vient d'y être ajoutée.
    // On la prend sans perdre ce qui est tapé ici : si le serveur n'a fait
    // qu'ajouter à la suite, on ajoute la même chose ; sinon on prévient.
    const delta = serveur.startsWith(serverText) ? serveur.slice(serverText.length) : null;
    setServerText(serveur);
    setLoadedAt(loaded.updated_at);
    if (text === serverText) setText(serveur);
    else if (delta !== null)
      setText((courant) =>
        courant.endsWith('\n') || delta.startsWith('\n') ? courant + delta : `${courant}\n${delta}`,
      );
    else
      setMessage(
        "Cette page a été modifiée ailleurs pendant votre saisie : rechargez-la avant d'enregistrer.",
      );
  }
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [translateOpen, setTranslateOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const [translationLanguage, setTranslationLanguage] = useState('Anglais');
  const [parentPageId, setParentPageId] = useState(loaded.parent_page_id ?? 'root');
  const importInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const assistantSectionRef = useRef<HTMLElement>(null);

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
      setServerText(saved.search_text ?? '');
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

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const key = event.key.toLocaleLowerCase('fr');
      if (event.ctrlKey && event.altKey && key === 'l') {
        event.preventDefault();
        void copyLink();
      }
      if (event.ctrlKey && !event.altKey && key === 'd' && canEdit) {
        event.preventDefault();
        void handleDuplicate();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  });

  const downloadPage = (content: string, extension: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${
      title
        .trim()
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-|-$/g, '') || 'page'
    }.${extension}`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportMarkdown = () =>
    downloadPage(`# ${title}\n\n${text}`, 'md', 'text/markdown;charset=utf-8');
  const exportText = () => downloadPage(`${title}\n\n${text}`, 'txt', 'text/plain;charset=utf-8');
  const exportHtml = () => {
    const escape = (value: string) =>
      value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
    downloadPage(
      `<!doctype html><html lang="fr"><meta charset="utf-8"><title>${escape(title)}</title><body><main><h1>${escape(title)}</h1><div style="white-space:pre-wrap">${escape(text)}</div></main></body></html>`,
      'html',
      'text/html;charset=utf-8',
    );
  };

  const handlePresentationChange = async (
    patch: Partial<
      Pick<
        WorkspacePage,
        'font_family' | 'small_text' | 'full_width' | 'locked' | 'accent_color' | 'wiki_mode'
      >
    >,
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

  const accent = PAGE_ACCENT_STYLES[loaded.accent_color ?? 'blue'];
  const childPages = (pages.data ?? []).filter((page) => page.parent_page_id === pageId);
  const notificationLevel = pagePreference.data?.notification_level ?? 'mentions';

  const focusAssistant = (prompt?: string) => {
    if (prompt) setQuestion(prompt);
    assistantSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => document.getElementById('workspace-ai-question')?.focus(), 250);
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
        <div className={cn('h-1 w-full', accent.line)} aria-hidden="true" />

        <header className="border-border flex min-h-12 items-center gap-2 border-b px-3 sm:px-5">
          <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
            {icon || '📄'} {title || 'Sans titre'} {loaded.locked ? '· Verrouillée' : '· Privée'}
            {loaded.wiki_mode ? ' · Wiki' : ''}
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

          {loaded.wiki_mode ? (
            <section className={cn('mt-8 rounded-2xl p-4 sm:p-5', accent.soft)}>
              <div className="mb-4 flex items-center gap-2">
                <BookOpen className={cn('size-5', accent.text)} aria-hidden />
                <div>
                  <h2 className="text-sm font-bold">Base de connaissances</h2>
                  <p className="text-muted-foreground text-xs">
                    Les sous-pages deviennent les articles de ce wiki.
                  </p>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {childPages.map((child) => (
                  <button
                    key={child.id}
                    type="button"
                    onClick={() => void navigate(ROUTES.workspacePage(child.id))}
                    className="bg-surface/85 border-border hover:border-primary/40 flex min-h-14 items-center gap-3 rounded-xl border px-3 text-left transition"
                  >
                    <span className="text-xl">{child.icon ?? '📄'}</span>
                    <span className="min-w-0 truncate text-sm font-semibold">{child.title}</span>
                  </button>
                ))}
                {childPages.length === 0 ? (
                  <p className="text-muted-foreground col-span-full py-3 text-sm">
                    Aucune sous-page pour l’instant. Créez un article depuis la navigation Pages.
                  </p>
                ) : null}
              </div>
            </section>
          ) : null}

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
          canAi={canAi}
          notificationLevel={notificationLevel}
          connectionCount={connectedTasks.data?.length ?? 0}
          onClose={() => setOptionsOpen(false)}
          onPresentationChange={(patch) => void handlePresentationChange(patch)}
          onCopyLink={() => void copyLink()}
          onCopyContent={() => void copyContent()}
          onDuplicate={() => void handleDuplicate()}
          onMove={() => setMoveOpen(true)}
          onArchive={() => void handleArchive()}
          onCustomize={() => setCustomizeOpen(true)}
          onUseAi={() => focusAssistant()}
          onTranslate={() => setTranslateOpen(true)}
          onImport={() => importInputRef.current?.click()}
          onExport={() => setExportOpen(true)}
          onToggleWiki={() => void handlePresentationChange({ wiki_mode: !loaded.wiki_mode })}
          onHistory={() => setHistoryOpen(true)}
          onNotifications={() => setNotificationsOpen(true)}
          onConnections={() => setConnectionsOpen(true)}
        />
      ) : null}

      <Modal
        open={customizeOpen}
        onOpenChange={setCustomizeOpen}
        title="Personnaliser la page"
        description="Donnez à la page une identité claire sans alourdir sa lecture."
        size="lg"
      >
        <div className="space-y-6">
          <section>
            <p className="mb-3 text-sm font-bold">Icône</p>
            <div className="flex flex-wrap gap-2">
              {['✏️', '📘', '🛠️', '📋', '💡', '🧭'].map((candidate) => (
                <button
                  key={candidate}
                  type="button"
                  aria-label={`Utiliser l’icône ${candidate}`}
                  onClick={() => {
                    setIconValue(candidate);
                    setIcon.mutate(
                      { pageId, icon: candidate },
                      { onSuccess: (saved) => setLoadedAt(saved.updated_at) },
                    );
                  }}
                  className={cn(
                    'hover:bg-surface-hover flex size-12 items-center justify-center rounded-xl border text-2xl',
                    icon === candidate ? 'border-primary bg-primary/5' : 'border-border',
                  )}
                >
                  {candidate}
                </button>
              ))}
            </div>
          </section>

          <section>
            <p className="mb-3 text-sm font-bold">Couleur d’accent</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {(Object.keys(PAGE_ACCENT_STYLES) as (keyof typeof PAGE_ACCENT_STYLES)[]).map(
                (color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Couleur ${PAGE_ACCENT_LABELS[color]}`}
                    aria-pressed={loaded.accent_color === color}
                    onClick={() => void handlePresentationChange({ accent_color: color })}
                    className={cn(
                      'border-border hover:border-primary/50 text-2xs flex flex-col items-center gap-2 rounded-xl border p-2',
                      loaded.accent_color === color && 'border-primary ring-primary/20 ring-2',
                    )}
                  >
                    <span
                      className={cn(
                        'block size-6 rounded-full shadow-sm',
                        PAGE_ACCENT_STYLES[color].line,
                      )}
                    />
                    {PAGE_ACCENT_LABELS[color]}
                  </button>
                ),
              )}
            </div>
          </section>

          <section>
            <p className="mb-3 text-sm font-bold">Couverture</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => coverInputRef.current?.click()}
              >
                <ImagePlus className="size-4" />
                {loaded.cover_path ? 'Changer la couverture' : 'Ajouter une couverture'}
              </Button>
              {loaded.cover_path ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-error"
                  isLoading={removeCover.isPending}
                  onClick={() =>
                    removeCover.mutate(loaded, {
                      onSuccess: (saved) => setLoadedAt(saved.updated_at),
                    })
                  }
                >
                  <Trash2 className="size-4" /> Retirer
                </Button>
              ) : null}
            </div>
          </section>
        </div>
      </Modal>

      <Modal
        open={exportOpen}
        onOpenChange={setExportOpen}
        title="Exporter la page"
        description="Choisissez un format réutilisable ou ouvrez la mise en page d’impression."
        size="lg"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              exportMarkdown();
              setExportOpen(false);
            }}
            className="border-border hover:border-primary/40 hover:bg-surface-hover flex items-center gap-3 rounded-xl border p-4 text-left"
          >
            <Download className="text-primary size-5" />
            <span>
              <strong className="block text-sm">Markdown</strong>
              <span className="text-muted-foreground text-xs">
                Pour les outils de notes et wikis.
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              exportText();
              setExportOpen(false);
            }}
            className="border-border hover:border-primary/40 hover:bg-surface-hover flex items-center gap-3 rounded-xl border p-4 text-left"
          >
            <FileText className="text-primary size-5" />
            <span>
              <strong className="block text-sm">Texte brut</strong>
              <span className="text-muted-foreground text-xs">
                Compatible avec toutes les applications.
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              exportHtml();
              setExportOpen(false);
            }}
            className="border-border hover:border-primary/40 hover:bg-surface-hover flex items-center gap-3 rounded-xl border p-4 text-left"
          >
            <FileText className="text-primary size-5" />
            <span>
              <strong className="block text-sm">Page HTML</strong>
              <span className="text-muted-foreground text-xs">À ouvrir dans un navigateur.</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setExportOpen(false);
              window.print();
            }}
            className="border-border hover:border-primary/40 hover:bg-surface-hover flex items-center gap-3 rounded-xl border p-4 text-left"
          >
            <Printer className="text-primary size-5" />
            <span>
              <strong className="block text-sm">Imprimer / PDF</strong>
              <span className="text-muted-foreground text-xs">
                Utilise le dialogue d’impression système.
              </span>
            </span>
          </button>
        </div>
      </Modal>

      <Modal
        open={translateOpen}
        onOpenChange={setTranslateOpen}
        title="Traduire avec l’Assistant"
        description="La traduction apparaîtra dans l’assistant afin que vous puissiez la relire avant de l’insérer."
        footer={
          <Button
            type="button"
            disabled={!canAi || ai.isGenerating}
            onClick={() => {
              const prompt = `Traduis l’intégralité de cette page en ${translationLanguage}. Conserve la structure, les listes, les termes techniques et n’ajoute aucun commentaire.`;
              setTranslateOpen(false);
              focusAssistant();
              void ai.sendMessage(prompt);
            }}
          >
            <Languages className="size-4" /> Lancer la traduction
          </Button>
        }
      >
        <Select
          label="Langue cible"
          value={translationLanguage}
          onValueChange={setTranslationLanguage}
          options={[
            { value: 'Anglais', label: 'Anglais' },
            { value: 'Espagnol', label: 'Espagnol' },
            { value: 'Allemand', label: 'Allemand' },
            { value: 'Italien', label: 'Italien' },
            { value: 'Portugais', label: 'Portugais' },
            { value: 'Néerlandais', label: 'Néerlandais' },
          ]}
        />
      </Modal>

      <Modal
        open={notificationsOpen}
        onOpenChange={setNotificationsOpen}
        title="Notifications de la page"
        description="Ce réglage vous est personnel et ne modifie pas les préférences de l’équipe."
      >
        <Select
          label="Me notifier"
          value={notificationLevel}
          onValueChange={(value) =>
            setNotificationLevel.mutate({
              pageId,
              notificationLevel: value as 'off' | 'mentions' | 'all',
            })
          }
          options={[
            { value: 'all', label: 'Pour toutes les modifications' },
            { value: 'mentions', label: 'Uniquement pour les mentions' },
            { value: 'off', label: 'Jamais' },
          ]}
        />
        <p className="text-muted-foreground mt-3 flex items-start gap-2 text-xs">
          <Bell className="mt-0.5 size-3.5 shrink-0" />
          Les notifications seront exploitées par le centre de notifications de REZO360.
        </p>
      </Modal>

      <Modal
        open={connectionsOpen}
        onOpenChange={setConnectionsOpen}
        title="Connexions"
        description="Tâches et missions qui utilisent directement cette page."
        size="lg"
      >
        <div className="space-y-2">
          {(connectedTasks.data ?? []).map((task) => (
            <div key={task.id} className="border-border rounded-xl border p-3">
              <p className="text-sm font-semibold">{task.title}</p>
              <p className="text-muted-foreground mt-1 text-xs">
                {task.status === 'done'
                  ? 'Terminée'
                  : task.status === 'in_progress'
                    ? 'En cours'
                    : 'À faire'}
                {task.mission_id ? ' · Reliée à une mission' : ''}
                {task.due_date
                  ? ` · Échéance ${new Date(task.due_date).toLocaleDateString('fr-FR')}`
                  : ''}
              </p>
            </div>
          ))}
          {!connectedTasks.isLoading && (connectedTasks.data?.length ?? 0) === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              Cette page n’est encore reliée à aucune tâche ni mission.
            </p>
          ) : null}
        </div>
      </Modal>

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
        <section
          ref={assistantSectionRef}
          className="border-border bg-surface scroll-mt-20 overflow-hidden rounded-xl border"
        >
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
                  id="workspace-ai-question"
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
