import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TAILLE_MAX_OCTETS } from '../constants';

import { useFileTeleversement } from './useUploadQueue';

const api = vi.hoisted(() => ({ uploadDocument: vi.fn() }));

vi.mock('../api/documents.api', () => ({ uploadDocument: api.uploadDocument }));

function enveloppe({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function fichier(nom: string, type = 'application/pdf', taille = 1024): File {
  const f = new File(['x'], nom, { type });
  Object.defineProperty(f, 'size', { value: taille });
  return f;
}

const CONTEXTE = { organizationId: 'org-1', uploadedBy: 'u1', folderId: null };

beforeEach(() => {
  vi.clearAllMocks();
  api.uploadDocument.mockResolvedValue({ id: 'doc-1' });
});

describe('file de téléversement', () => {
  it('écarte un format interdit sans rien envoyer', async () => {
    const { result } = renderHook(() => useFileTeleversement(), { wrapper: enveloppe });

    act(() => {
      result.current.ajouter([fichier('virus.exe', 'application/x-msdownload')]);
    });

    expect(result.current.file[0]?.etat).toBe('echec');
    expect(result.current.enAttente).toBe(0);

    await act(async () => {
      await result.current.demarrer(CONTEXTE);
    });

    // Le contrôle sert à épargner une attente, pas à protéger : ce qui compte
    // est qu'aucun aller-retour n'ait été payé pour un refus connu d'avance.
    expect(api.uploadDocument).not.toHaveBeenCalled();
  });

  it('écarte un fichier trop lourd avant le réseau', () => {
    const { result } = renderHook(() => useFileTeleversement(), { wrapper: enveloppe });

    act(() => {
      result.current.ajouter([fichier('enorme.pdf', 'application/pdf', TAILLE_MAX_OCTETS + 1)]);
    });

    expect(result.current.file[0]?.etat).toBe('echec');
    expect(result.current.file[0]?.erreur).toContain('dépasse');
  });

  it('poursuit la file quand un fichier échoue', async () => {
    // LA règle de cet écran. Vingt photos déposées depuis un chantier ne doivent
    // pas être condamnées par la seule qui passe mal.
    api.uploadDocument.mockImplementation((input: { file: File }) =>
      input.file.name === 'casse.pdf'
        ? Promise.reject(new Error('refus serveur'))
        : Promise.resolve({ id: 'ok' }),
    );

    const { result } = renderHook(() => useFileTeleversement(), { wrapper: enveloppe });

    act(() => {
      result.current.ajouter([fichier('un.pdf'), fichier('casse.pdf'), fichier('trois.pdf')]);
    });

    let bilan = { reussis: 0, echoues: 0 };
    await act(async () => {
      bilan = await result.current.demarrer(CONTEXTE);
    });

    expect(bilan).toEqual({ reussis: 2, echoues: 1 });
    expect(api.uploadDocument).toHaveBeenCalledTimes(3);

    const etats = Object.fromEntries(
      result.current.file.map((entree) => [entree.fichier.name, entree.etat]),
    );
    expect(etats).toEqual({ 'un.pdf': 'reussi', 'casse.pdf': 'echec', 'trois.pdf': 'reussi' });
  });

  it('dépose dans le dossier courant', async () => {
    const { result } = renderHook(() => useFileTeleversement(), { wrapper: enveloppe });

    act(() => {
      result.current.ajouter([fichier('notice.pdf')]);
    });
    await act(async () => {
      await result.current.demarrer({ ...CONTEXTE, folderId: 'dossier-7' });
    });

    expect(api.uploadDocument).toHaveBeenCalledWith(
      expect.objectContaining({ folderId: 'dossier-7', organizationId: 'org-1' }),
    );
  });

  it('reprend le nom du fichier sans son extension', async () => {
    const { result } = renderHook(() => useFileTeleversement(), { wrapper: enveloppe });

    act(() => {
      result.current.ajouter([fichier('Procédure de raccordement.pdf')]);
    });
    await act(async () => {
      await result.current.demarrer(CONTEXTE);
    });

    expect(api.uploadDocument).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Procédure de raccordement' }),
    );
  });

  it('ne renvoie aucun fichier déjà traité à un second envoi', async () => {
    const { result } = renderHook(() => useFileTeleversement(), { wrapper: enveloppe });

    act(() => {
      result.current.ajouter([fichier('un.pdf')]);
    });
    await act(async () => {
      await result.current.demarrer(CONTEXTE);
    });

    await act(async () => {
      const second = await result.current.demarrer(CONTEXTE);
      expect(second).toEqual({ reussis: 0, echoues: 0 });
    });

    expect(api.uploadDocument).toHaveBeenCalledTimes(1);
  });

  it('retire une entrée de la file', () => {
    const { result } = renderHook(() => useFileTeleversement(), { wrapper: enveloppe });

    act(() => {
      result.current.ajouter([fichier('un.pdf'), fichier('deux.pdf')]);
    });
    const premier = result.current.file[0]?.id ?? '';
    act(() => {
      result.current.retirer(premier);
    });

    expect(result.current.file.map((e) => e.fichier.name)).toEqual(['deux.pdf']);
  });

  it('compte les fichiers traités au fil de l’envoi', async () => {
    const { result } = renderHook(() => useFileTeleversement(), { wrapper: enveloppe });

    act(() => {
      result.current.ajouter([fichier('un.pdf'), fichier('deux.pdf')]);
    });
    expect(result.current.traites).toBe(0);

    await act(async () => {
      await result.current.demarrer(CONTEXTE);
    });

    await waitFor(() => expect(result.current.traites).toBe(2));
    expect(result.current.enCours).toBe(false);
  });
});
