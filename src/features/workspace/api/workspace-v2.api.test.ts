import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
  Ce qui est vérifié : ce que le client ENVOIE. La recherche ne part pas
  vide ; une page depuis un modèle porte ses quatre paramètres SQL ; le texte
  de l'assistant devient un document TipTap qui tient debout.
*/
const rpc = vi.hoisted(() => vi.fn());
const from = vi.hoisted(() => vi.fn());

async function deballer(q: PromiseLike<{ data: unknown; error: unknown }>) {
  const { data, error } = await q;
  if (error) throw new Error(String((error as { message?: string }).message ?? 'Erreur'));
  return data;
}

vi.mock('@/services/supabase', () => ({
  supabase: { rpc, from, storage: { from: vi.fn() } },
  unwrap: deballer,
  unwrapMaybe: deballer,
}));

import {
  createPageFromTemplate,
  retryRecordingTranscription,
  searchPages,
  textToTiptapDocument,
} from './workspace.api';

describe('workspace.api — v2', () => {
  beforeEach(() => {
    rpc.mockReset();
    from.mockReset();
    rpc.mockResolvedValue({ data: [], error: null });
  });

  it('ne cherche pas avec une requête vide', async () => {
    expect(await searchPages('org-1', '   ')).toEqual([]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('envoie la requête nettoyée et la limite, sous leur nom SQL', async () => {
    await searchPages('org-1', '  raccordement boîtier ', 5);
    expect(rpc).toHaveBeenCalledWith('search_workspace_pages', {
      p_organization_id: 'org-1',
      p_query: 'raccordement boîtier',
      p_limit: 5,
    });
  });

  it("crée une page depuis un modèle sans envoyer d'`undefined`", async () => {
    rpc.mockResolvedValue({ data: { id: 'p-1' }, error: null });
    await createPageFromTemplate({ templateId: 't-1', spaceId: 's-1' });
    expect(rpc).toHaveBeenCalledWith('create_page_from_template', {
      p_template_id: 't-1',
      p_space_id: 's-1',
    });
    await createPageFromTemplate({
      templateId: 't-1',
      spaceId: 's-1',
      parentPageId: null,
      title: 'X',
    });
    expect(rpc).toHaveBeenLastCalledWith('create_page_from_template', {
      p_template_id: 't-1',
      p_space_id: 's-1',
      p_parent_page_id: null,
      p_title: 'X',
    });
  });

  it('relance une transcription existante sans recréer l’enregistrement', async () => {
    rpc.mockResolvedValue({ data: { id: 'rec-1', status: 'pending' }, error: null });

    await retryRecordingTranscription('rec-1');

    expect(rpc).toHaveBeenCalledWith('retry_workspace_recording_transcription', {
      p_recording_id: 'rec-1',
    });
  });
});

describe('textToTiptapDocument', () => {
  it('convertit titres, listes et paragraphes, et ferme une liste au changement de type', () => {
    const doc = textToTiptapDocument(
      '# Compte rendu\r\n\r\nTravaux réalisés :\n- Tirage du câble\n- Soudure\n1. Tester\n2. Nettoyer\n\nRAS.',
    );
    expect(doc.type).toBe('doc');
    expect((doc.content ?? []).map((n) => (n as { type: string }).type)).toEqual([
      'heading',
      'paragraph',
      'bulletList',
      'orderedList',
      'paragraph',
    ]);
    const heading = doc.content?.[0] as { attrs: { level: number }; content: { text: string }[] };
    expect(heading.attrs.level).toBe(1);
    expect(heading.content[0]?.text).toBe('Compte rendu');
    const liste = doc.content?.[2] as { content: unknown[] };
    expect(liste.content).toHaveLength(2);
  });

  it('rend un document vide pour un texte vide', () => {
    expect(textToTiptapDocument('   \n ')).toEqual({ type: 'doc', content: [] });
  });
});
