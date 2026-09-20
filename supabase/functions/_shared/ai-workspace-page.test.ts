import { assertEquals } from 'jsr:@std/assert@1';

import {
  WORKSPACE_PAGE_MAX_CHARS,
  loadWorkspacePageContext,
  workspacePageBlock,
} from './ai-workspace-page.ts';

/*
  Ce qui est vérifié : la visibilité rejouée hors RLS. Une page d'un espace
  personnel ne se lit que par son propriétaire ; sans `workspace.view`, rien ;
  une page archivée n'existe plus ; une page trop longue est coupée et le dit.
*/

type Row = Record<string, unknown> | null;

function fauxAdmin(tables: Record<string, Row>) {
  return {
    from(table: string) {
      const chaine = {
        select: () => chaine,
        eq: () => chaine,
        maybeSingle: () => Promise.resolve({ data: tables[table] ?? null, error: null }),
      };
      return chaine;
    },
  } as unknown as Parameters<typeof loadWorkspacePageContext>[0]['admin'];
}

const base = {
  organizationId: '00000000-0000-4000-8000-000000000001',
  userId: 'user-a',
  role: 'technician',
  pageId: '00000000-0000-4000-8000-000000000010',
};

Deno.test('une page partagée se lit avec workspace.view', async () => {
  const admin = fauxAdmin({
    role_permissions: { permission: 'workspace.view' },
    workspace_pages: {
      id: base.pageId,
      title: 'Procédure',
      search_text: 'Vérifier la continuité.\n',
      archived_at: null,
      space: { owner_member_id: null },
    },
  });
  const page = await loadWorkspacePageContext({ admin, ...base });
  assertEquals(page?.title, 'Procédure');
  assertEquals(page?.truncated, false);
});

Deno.test('sans workspace.view, rien', async () => {
  const admin = fauxAdmin({
    role_permissions: null,
    workspace_pages: {
      id: base.pageId,
      title: 'P',
      search_text: '',
      archived_at: null,
      space: null,
    },
  });
  assertEquals(await loadWorkspacePageContext({ admin, ...base }), null);
});

Deno.test('une page privée ne se lit que par son propriétaire', async () => {
  const tables = {
    role_permissions: { permission: 'workspace.view' },
    workspace_pages: {
      id: base.pageId,
      title: 'Mes notes',
      search_text: 'secret',
      archived_at: null,
      space: { owner_member_id: 'member-b' },
    },
    organization_members: { user_id: 'user-b' },
  };
  assertEquals(await loadWorkspacePageContext({ admin: fauxAdmin(tables), ...base }), null);
  const page = await loadWorkspacePageContext({
    admin: fauxAdmin(tables),
    ...base,
    userId: 'user-b',
  });
  assertEquals(page?.text, 'secret');
});

Deno.test('une page archivée n’existe plus', async () => {
  const admin = fauxAdmin({
    role_permissions: { permission: 'workspace.view' },
    workspace_pages: {
      id: base.pageId,
      title: 'Vieille',
      search_text: 'x',
      archived_at: '2026-09-01T00:00:00Z',
      space: { owner_member_id: null },
    },
  });
  assertEquals(await loadWorkspacePageContext({ admin, ...base }), null);
});

Deno.test('une page trop longue est coupée, et le bloc le dit', async () => {
  const admin = fauxAdmin({
    role_permissions: { permission: 'workspace.view' },
    workspace_pages: {
      id: base.pageId,
      title: 'Longue',
      search_text: 'a'.repeat(WORKSPACE_PAGE_MAX_CHARS + 10),
      archived_at: null,
      space: { owner_member_id: null },
    },
  });
  const page = await loadWorkspacePageContext({ admin, ...base });
  assertEquals(page?.truncated, true);
  assertEquals(page?.text.length, WORKSPACE_PAGE_MAX_CHARS);
  const bloc = workspacePageBlock(page);
  assertEquals(bloc.includes('[Page tronquée'), true);
  assertEquals(bloc.startsWith('<WORKSPACE_PAGE_UNTRUSTED title="Longue">'), true);
});

Deno.test('sans page, pas de bloc', () => {
  assertEquals(workspacePageBlock(null), '');
});
