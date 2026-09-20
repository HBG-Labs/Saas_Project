import { FileText, Plus, Search, Star } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { ROUTES } from '@/config/routes';
import { PERMISSIONS, useCurrentOrganization, usePermission } from '@/features/organizations';
import {
  isPersonalSpace,
  useCreatePage,
  useCreatePageFromTemplate,
  useFavorites,
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

/*
  ÉCHAFAUDAGE — pas un livrable.

  Cet écran existe pour VOIR FONCTIONNER le socle Workspace v2 (espace
  personnel, récentes, favoris, modèles, recherche, IA sur une page) avant que
  Codex ne livre les écrans de la direction artistique retenue. Composants
  existants, aucune décision de design : tout ici a vocation à être remplacé.
*/

function SpacePages({
  space,
  activePageId,
}: {
  space: WorkspaceSpace;
  activePageId: string | undefined;
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
            style={{ paddingLeft: `${String(8 + depth * 14)}px` }}
            className={`hover:bg-surface-hover flex items-center gap-2 rounded-md py-1.5 pr-2 text-sm ${
              page.id === activePageId ? 'bg-surface-sunken font-medium' : ''
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

  const personal = usePersonalSpace(canEdit ? organizationId : null);
  const spaces = useSpaces(organizationId);
  const recents = useRecentPages(organizationId, 6);
  const favorites = useFavorites(organizationId);
  const templates = useTemplates(organizationId);
  const createPage = useCreatePage();
  const createFromTemplate = useCreatePageFromTemplate();

  const [query, setQuery] = useState('');
  const search = useSearchPages(organizationId, query);
  const [targetSpaceId, setTargetSpaceId] = useState<string>('');
  const [templateId, setTemplateId] = useState<string>('');

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
    await navigate(ROUTES.workspacePage(page.id));
  };

  const handleFromTemplate = async () => {
    if (!effectiveSpaceId || !templateId) return;
    const page = await createFromTemplate.mutateAsync({
      templateId,
      spaceId: effectiveSpaceId,
    });
    await navigate(ROUTES.workspacePage(page.id));
  };

  if (spaces.isError) return <ErrorState error={spaces.error} title="Workspace indisponible" />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Pages"
        description="Écran provisoire : le socle du Workspace, sans direction artistique. Les écrans définitifs viendront avec Codex."
      />

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <aside className="space-y-4">
          <Input
            aria-label="Rechercher dans les pages"
            placeholder="Rechercher…"
            leadingIcon={<Search className="size-4" aria-hidden />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query.trim().length >= 2 ? (
            <Card>
              <CardContent className="space-y-1 p-3">
                <p className="text-muted-foreground text-xs font-medium uppercase">Résultats</p>
                {search.isLoading ? <ListSkeleton rows={2} /> : null}
                {search.data?.length === 0 ? (
                  <p className="text-muted-foreground text-xs">Rien trouvé.</p>
                ) : null}
                {(search.data ?? []).map((hit) => (
                  <Link
                    key={hit.id}
                    to={ROUTES.workspacePage(hit.id)}
                    className="hover:bg-surface-hover block rounded-md px-2 py-1.5 text-sm"
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
              </CardContent>
            </Card>
          ) : null}

          {canEdit ? (
            <Card>
              <CardContent className="space-y-2 p-3">
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
                    value={templateId}
                    onValueChange={setTemplateId}
                    options={[
                      { value: '', label: 'Depuis un modèle…' },
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
              </CardContent>
            </Card>
          ) : null}

          {(recents.data?.length ?? 0) > 0 ? (
            <Card>
              <CardContent className="space-y-1 p-3">
                <p className="text-muted-foreground text-xs font-medium uppercase">Récentes</p>
                {(recents.data ?? []).map((r) => (
                  <Link
                    key={r.page.id}
                    to={ROUTES.workspacePage(r.page.id)}
                    className="hover:bg-surface-hover block truncate rounded-md px-2 py-1.5 text-sm"
                  >
                    {r.page.icon ? `${r.page.icon} ` : ''}
                    {r.page.title}
                  </Link>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {(favorites.data?.length ?? 0) > 0 ? (
            <Card>
              <CardContent className="space-y-1 p-3">
                <p className="text-muted-foreground flex items-center gap-1 text-xs font-medium uppercase">
                  <Star className="size-3" aria-hidden /> Favoris
                </p>
                {(favorites.data ?? []).map((f) => (
                  <Link
                    key={f.page_id}
                    to={ROUTES.workspacePage(f.page_id)}
                    className="hover:bg-surface-hover block truncate rounded-md px-2 py-1.5 text-sm"
                  >
                    {pagesById.get(f.page_id)?.title ?? 'Page'}
                  </Link>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {spaces.isLoading ? <ListSkeleton rows={3} /> : null}
          {allSpaces.map((space) => (
            <Card key={space.id}>
              <CardContent className="space-y-1 p-3">
                <p className="text-muted-foreground text-xs font-medium uppercase">
                  {space.icon ? `${space.icon} ` : ''}
                  {space.name}
                  {isPersonalSpace(space) ? ' · personnel' : ''}
                </p>
                <SpacePages space={space} activePageId={pageId} />
              </CardContent>
            </Card>
          ))}
        </aside>

        <section>
          {pageId ? (
            <WorkspacePageEditor key={pageId} pageId={pageId} organizationId={organizationId} />
          ) : (
            <EmptyState
              icon={FileText}
              title="Choisissez une page"
              description="Ou créez-en une, vide ou depuis un modèle."
            />
          )}
        </section>
      </div>
    </div>
  );
}
