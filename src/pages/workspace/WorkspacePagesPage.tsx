import {
  BookOpen,
  ChevronDown,
  FileText,
  Plus,
  RotateCcw,
  Search,
  Star,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { AtelierIllustration } from '@/components/feedback/AtelierIllustration';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { ROUTES } from '@/config/routes';
import { PERMISSIONS, useCurrentOrganization, usePermission } from '@/features/organizations';
import {
  isPersonalSpace,
  useArchivedPages,
  useCreatePage,
  useCreatePageFromTemplate,
  useDeletePage,
  useFavorites,
  useMovePage,
  usePages,
  usePersonalSpace,
  useRecentPages,
  useSearchPages,
  useSpaces,
  useTemplates,
  type WorkspacePage,
  type WorkspaceSpace,
} from '@/features/workspace';
import { useDocumentTitle } from '@/lib/use-document-title';

import { WorkspacePageEditor } from './WorkspacePageEditor';

/* Le lot visuel conserve les hooks, les permissions et le parcours de création v2. */

function SpacePages({
  space,
  activePageId,
  onSelect,
}: {
  space: WorkspaceSpace;
  activePageId: string | undefined;
  onSelect: () => void;
}) {
  const { data: pages = [], isLoading } = usePages(space.id);

  // Arbre aplati : les enfants sous leur parent, indentés. Suffisant pour
  // vérifier la hiérarchie ; l'écran final aura ses chevrons.
  const ordered = useMemo(() => {
    const byParent = new Map<string | null, WorkspacePage[]>();
    for (const page of pages) {
      const key = page.parent_page_id;
      byParent.set(key, [...(byParent.get(key) ?? []), page]);
    }
    const out: Array<{ page: WorkspacePage; depth: number }> = [];
    const walk = (parent: string | null, depth: number) => {
      for (const page of byParent.get(parent) ?? []) {
        out.push({ page, depth });
        if (depth < 6) walk(page.id, depth + 1);
      }
    };
    walk(null, 0);
    return out;
  }, [pages]);

  if (isLoading) return <ListSkeleton rows={2} />;
  if (ordered.length === 0) {
    return <p className="text-muted-foreground px-2 text-xs">Aucune page.</p>;
  }
  return (
    <ul className="space-y-0.5">
      {ordered.map(({ page, depth }) => (
        <li key={page.id}>
          <Link
            to={ROUTES.workspacePage(page.id)}
            onClick={onSelect}
            aria-current={page.id === activePageId ? 'page' : undefined}
            style={{ paddingLeft: `${String(8 + depth * 14)}px` }}
            className={`hover:bg-surface-hover flex min-h-11 items-center gap-2 rounded-lg py-2 pr-2 text-sm lg:min-h-9 ${
              page.id === activePageId ? 'bg-nav-selected text-nav-foreground font-bold' : ''
            }`}
          >
            <span className="w-5 shrink-0 text-center">
              {page.icon ?? <FileText className="inline size-4" aria-hidden />}
            </span>
            <span className="truncate">{page.title}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function WorkspacePagesPage() {
  useDocumentTitle('Pages');
  const { pageId } = useParams<{ pageId?: string }>();
  const navigate = useNavigate();
  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? null;
  const { can } = usePermission();
  const canEdit = can(PERMISSIONS.workspaceEdit);
  const canManage = can(PERMISSIONS.workspaceManage);

  const personal = usePersonalSpace(canEdit ? organizationId : null);
  const spaces = useSpaces(organizationId);
  const recents = useRecentPages(organizationId, 6);
  const favorites = useFavorites(organizationId);
  const templates = useTemplates(organizationId);
  const archivedPages = useArchivedPages(organizationId);
  const createPage = useCreatePage();
  const createFromTemplate = useCreatePageFromTemplate();
  const movePage = useMovePage();
  const deletePage = useDeletePage();

  const [query, setQuery] = useState('');
  const [browserOpen, setBrowserOpen] = useState(false);
  const search = useSearchPages(organizationId, query);
  const [targetSpaceId, setTargetSpaceId] = useState<string>('');
  const [templateId, setTemplateId] = useState<string>('');
  const [trashOpen, setTrashOpen] = useState(false);
  const [trashMessage, setTrashMessage] = useState<string | null>(null);

  const allSpaces = useMemo(() => {
    const list = spaces.data ?? [];
    // L'espace personnel arrive par sa propre requête : il peut manquer de la
    // liste tant que celle-ci n'a pas été rafraîchie après sa création.
    if (personal.data && !list.some((s) => s.id === personal.data?.id)) {
      return [personal.data, ...list];
    }
    return [...list].sort((a, b) => Number(isPersonalSpace(b)) - Number(isPersonalSpace(a)));
  }, [spaces.data, personal.data]);

  // Sans choix explicite, le premier espace (le personnel, s'il existe).
  const effectiveSpaceId = targetSpaceId || (allSpaces[0]?.id ?? '');

  const pagesById = useMemo(() => {
    const map = new Map<string, { title: string; icon: string | null }>();
    for (const r of recents.data ?? [])
      map.set(r.page.id, { title: r.page.title, icon: r.page.icon });
    return map;
  }, [recents.data]);

  const handleNewPage = async () => {
    if (!effectiveSpaceId) return;
    const page = await createPage.mutateAsync({ spaceId: effectiveSpaceId });
    setBrowserOpen(false);
    await navigate(ROUTES.workspacePage(page.id));
  };

  const handleFromTemplate = async () => {
    if (!effectiveSpaceId || !templateId) return;
    const page = await createFromTemplate.mutateAsync({
      templateId,
      spaceId: effectiveSpaceId,
    });
    setBrowserOpen(false);
    await navigate(ROUTES.workspacePage(page.id));
  };

  const restorePage = async (page: WorkspacePage) => {
    setTrashMessage(null);
    try {
      await movePage.mutateAsync({
        pageId: page.id,
        // Une page restaurée revient toujours à la racine : son ancien parent
        // peut lui-même se trouver dans la corbeille.
        patch: { archived_at: null, parent_page_id: null },
      });
      setTrashMessage(`« ${page.title} » a été restaurée.`);
    } catch (error) {
      setTrashMessage(error instanceof Error ? error.message : 'La restauration a échoué.');
    }
  };

  const permanentlyDeletePage = async (page: WorkspacePage) => {
    if (
      !window.confirm(`Supprimer définitivement « ${page.title} » ? Cette action est irréversible.`)
    )
      return;
    setTrashMessage(null);
    try {
      await deletePage.mutateAsync({ pageId: page.id, spaceId: page.space_id });
      setTrashMessage(`« ${page.title} » a été supprimée définitivement.`);
    } catch (error) {
      setTrashMessage(error instanceof Error ? error.message : 'La suppression a échoué.');
    }
  };

  if (spaces.isError) return <ErrorState error={spaces.error} title="Workspace indisponible" />;

  return (
    <div className="workspace-atelier space-y-5">
      <PageHeader
        title="Pages"
        description="Vos idées, vos comptes rendus et les connaissances de votre équipe, réunis au même endroit."
      />

      <Button
        type="button"
        variant="secondary"
        className="w-full justify-between lg:hidden"
        aria-expanded={browserOpen}
        aria-controls="workspace-browser"
        onClick={() => setBrowserOpen(!browserOpen)}
      >
        <BookOpen aria-hidden /> Espaces et pages <ChevronDown aria-hidden />
      </Button>
      <div className="grid items-start gap-6 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[256px_minmax(0,1fr)]">
        <aside
          id="workspace-browser"
          aria-label="Espaces et pages"
          className={
            'workspace-browser min-w-0 space-y-5 lg:block ' + (browserOpen ? '' : 'hidden')
          }
        >
          <Input
            aria-label="Rechercher dans les pages"
            placeholder="Rechercher…"
            leadingIcon={<Search className="size-4" aria-hidden />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query.trim().length >= 2 ? (
            <div className="border-border border-b pb-4">
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs font-medium uppercase">Résultats</p>
                {search.isLoading ? <ListSkeleton rows={2} /> : null}
                {search.data?.length === 0 ? (
                  <p className="text-muted-foreground text-xs">Rien trouvé.</p>
                ) : null}
                {(search.data ?? []).map((hit) => (
                  <Link
                    key={hit.id}
                    onClick={() => setBrowserOpen(false)}
                    to={ROUTES.workspacePage(hit.id)}
                    className="hover:bg-surface-hover block min-h-11 rounded-lg px-2 py-2 text-sm lg:min-h-9"
                  >
                    <span className="font-medium">
                      {hit.icon ? `${hit.icon} ` : ''}
                      {hit.title}
                    </span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {hit.snippet}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          {canEdit ? (
            <div className="border-border border-b pb-4">
              <div className="space-y-3">
                <Select
                  aria-label="Espace de destination"
                  value={effectiveSpaceId}
                  onValueChange={setTargetSpaceId}
                  options={allSpaces.map((s) => ({
                    value: s.id,
                    label: isPersonalSpace(s) ? `${s.name} (personnel)` : s.name,
                  }))}
                />
                <Button
                  type="button"
                  className="w-full"
                  onClick={() => void handleNewPage()}
                  isLoading={createPage.isPending}
                  disabled={!effectiveSpaceId}
                >
                  <Plus aria-hidden /> Nouvelle page
                </Button>
                <div className="flex gap-2">
                  <Select
                    aria-label="Modèle"
                    placeholder="Depuis un modèle…"
                    value={templateId}
                    onValueChange={setTemplateId}
                    options={[
                      ...(templates.data ?? []).map((t) => ({
                        value: t.id,
                        label: `${t.name}${t.organization_id ? '' : ' (système)'}`,
                      })),
                    ]}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void handleFromTemplate()}
                    isLoading={createFromTemplate.isPending}
                    disabled={!templateId || !effectiveSpaceId}
                  >
                    Créer
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {(recents.data?.length ?? 0) > 0 ? (
            <div className="border-border border-b pb-4">
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs font-medium uppercase">Récentes</p>
                {(recents.data ?? []).map((r) => (
                  <Link
                    key={r.page.id}
                    onClick={() => setBrowserOpen(false)}
                    to={ROUTES.workspacePage(r.page.id)}
                    className="hover:bg-surface-hover block min-h-11 truncate rounded-lg px-2 py-2 text-sm lg:min-h-9"
                  >
                    {r.page.icon ? `${r.page.icon} ` : ''}
                    {r.page.title}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          {(favorites.data?.length ?? 0) > 0 ? (
            <div className="border-border border-b pb-4">
              <div className="space-y-1">
                <p className="text-muted-foreground flex items-center gap-1 text-xs font-medium uppercase">
                  <Star className="size-3" aria-hidden /> Favoris
                </p>
                {(favorites.data ?? []).map((f) => (
                  <Link
                    key={f.page_id}
                    onClick={() => setBrowserOpen(false)}
                    to={ROUTES.workspacePage(f.page_id)}
                    className="hover:bg-surface-hover block min-h-11 truncate rounded-lg px-2 py-2 text-sm lg:min-h-9"
                  >
                    {pagesById.get(f.page_id)?.title ?? 'Page'}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          {spaces.isLoading ? <ListSkeleton rows={3} /> : null}
          {allSpaces.map((space) => (
            <div key={space.id}>
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs font-medium uppercase">
                  {space.icon ? `${space.icon} ` : ''}
                  {space.name}
                  {isPersonalSpace(space) ? ' · personnel' : ''}
                </p>
                <SpacePages
                  space={space}
                  activePageId={pageId}
                  onSelect={() => setBrowserOpen(false)}
                />
              </div>
            </div>
          ))}

          <div className="border-border border-t pt-4">
            <button
              type="button"
              className="hover:bg-surface-hover flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-sm lg:min-h-9"
              onClick={() => {
                setTrashMessage(null);
                setTrashOpen(true);
              }}
            >
              <Trash2 className="size-4" aria-hidden />
              <span className="flex-1">Corbeille</span>
              {(archivedPages.data?.length ?? 0) > 0 ? (
                <span className="bg-surface-sunken text-muted-foreground rounded-full px-2 py-0.5 text-xs tabular-nums">
                  {archivedPages.data?.length}
                </span>
              ) : null}
            </button>
          </div>
        </aside>

        <section aria-label="Page de travail" className="min-w-0">
          {pageId ? (
            <WorkspacePageEditor key={pageId} pageId={pageId} organizationId={organizationId} />
          ) : (
            <EmptyState
              illustration={<AtelierIllustration subject="pages" />}
              title="Un espace pour vos idées"
              description={
                canEdit
                  ? 'Retrouvez une page dans vos espaces, ou commencez une nouvelle page à partir de vos idées ou d’un modèle.'
                  : 'Retrouvez les pages de votre équipe dans vos espaces.'
              }
              className="border-border min-h-96 border lg:min-h-[520px]"
              action={
                canEdit ? (
                  <Button
                    type="button"
                    onClick={() => void handleNewPage()}
                    disabled={!effectiveSpaceId}
                    isLoading={createPage.isPending}
                  >
                    <Plus aria-hidden /> Nouvelle page
                  </Button>
                ) : undefined
              }
            />
          )}
        </section>
      </div>

      <Modal
        open={trashOpen}
        onOpenChange={setTrashOpen}
        title="Corbeille des pages"
        description="Restaurez une page supprimée ou effacez-la définitivement."
        size="lg"
      >
        <div className="space-y-3">
          {trashMessage ? (
            <p
              role="status"
              className="border-info-border bg-info-subtle text-info rounded-xl border px-3 py-2 text-sm"
            >
              {trashMessage}
            </p>
          ) : null}
          {archivedPages.isLoading ? <ListSkeleton rows={3} /> : null}
          {archivedPages.isError ? (
            <ErrorState error={archivedPages.error} title="Corbeille inaccessible" />
          ) : null}
          {(archivedPages.data ?? []).map((page) => (
            <div
              key={page.id}
              className="border-border flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {page.icon ? `${page.icon} ` : ''}
                  {page.title || 'Sans titre'}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Supprimée le{' '}
                  {page.archived_at
                    ? new Date(page.archived_at).toLocaleString('fr-FR')
                    : 'récemment'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {canEdit ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={movePage.isPending || deletePage.isPending}
                    onClick={() => void restorePage(page)}
                  >
                    <RotateCcw className="size-4" aria-hidden /> Restaurer
                  </Button>
                ) : null}
                {canManage ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-error"
                    disabled={movePage.isPending || deletePage.isPending}
                    onClick={() => void permanentlyDeletePage(page)}
                  >
                    <Trash2 className="size-4" aria-hidden /> Supprimer
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
          {!archivedPages.isLoading && (archivedPages.data?.length ?? 0) === 0 ? (
            <div className="py-8 text-center">
              <Trash2 className="text-muted-foreground mx-auto mb-2 size-8" aria-hidden />
              <p className="text-sm font-semibold">La corbeille est vide.</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Les pages déplacées dans la corbeille apparaîtront ici.
              </p>
            </div>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
