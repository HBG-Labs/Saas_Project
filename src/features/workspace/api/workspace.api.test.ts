import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
  Ce qui est vérifié : la REQUÊTE ENVOYÉE. Pour `save_workspace_page`, les
  quatre paramètres et leur nom SQL ; pour la création d'une page, qu'aucune
  colonne absente ne parte en `undefined` — PostgREST la sérialiserait en NULL
  et la base refuserait un titre nul là où elle aurait posé « Sans titre ».
*/
const rpc = vi.hoisted(() => vi.fn());
const insertions = vi.hoisted(() => [] as unknown[]);
const from = vi.hoisted(() => vi.fn());

async function deballer(q: PromiseLike<{ data: unknown; error: unknown }>) {
  const { data, error } = await q;
  if (error) {
    const e = error as { message?: string; code?: string };
    throw Object.assign(new Error(e.message ?? 'Erreur'), { code: e.code });
  }
  return data;
}

vi.mock('@/services/supabase', () => ({
  supabase: { rpc, from },
  unwrap: deballer,
  unwrapMaybe: deballer,
}));

import { createPage, savePage } from './workspace.api';

const PAGE = {
  id: 'p-1',
  organization_id: 'org-1',
  space_id: 's-1',
  parent_page_id: null,
  title: 'Sans titre',
  content: { type: 'doc', content: [] },
  position: 0,
  created_by: 'u-1',
  updated_by: 'u-1',
  archived_at: null,
  created_at: '2026-09-20T10:00:00Z',
  updated_at: '2026-09-20T10:00:00Z',
};

describe('workspace.api', () => {
  beforeEach(() => {
    rpc.mockReset();
    from.mockReset();
    insertions.length = 0;
    rpc.mockResolvedValue({ data: PAGE, error: null });
    from.mockReturnValue({
      insert: (valeurs: unknown) => {
        insertions.push(valeurs);
        return { select: () => ({ single: () => Promise.resolve({ data: PAGE, error: null }) }) };
      },
    });
  });

  it('enregistre une page avec les quatre paramètres, sous leur nom SQL', async () => {
    const content = { type: 'doc' as const, content: [{ type: 'paragraph' }] };

    await savePage({
      pageId: 'p-1',
      expectedUpdatedAt: '2026-09-20T10:00:00Z',
      title: 'Compte rendu',
      content,
    });

    expect(rpc).toHaveBeenCalledWith('save_workspace_page', {
      p_page_id: 'p-1',
      p_expected_updated_at: '2026-09-20T10:00:00Z',
      p_title: 'Compte rendu',
      p_content: content,
    });
  });

  it('laisse remonter le conflit d’enregistrement tel quel', async () => {
    // C'est l'écran qui annonce « quelqu'un d'autre a modifié la page » et
    // propose de recharger. Le service ne réessaie pas, n'écrase pas.
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'Cette page a été modifiée par quelqu’un d’autre', code: '40001' },
    });

    await expect(
      savePage({ pageId: 'p-1', expectedUpdatedAt: 'x', title: 't', content: { type: 'doc' } }),
    ).rejects.toMatchObject({ code: '40001' });
  });

  it('crée une page sans envoyer les colonnes non renseignées', async () => {
    await createPage({ spaceId: 's-1' });

    expect(insertions[0]).toEqual({ space_id: 's-1' });
  });

  it('transmet le parent et la position quand ils sont donnés', async () => {
    await createPage({ spaceId: 's-1', title: 'Annexe', parentPageId: 'p-0', position: 2 });

    expect(insertions[0]).toEqual({
      space_id: 's-1',
      title: 'Annexe',
      parent_page_id: 'p-0',
      position: 2,
    });
  });
});
