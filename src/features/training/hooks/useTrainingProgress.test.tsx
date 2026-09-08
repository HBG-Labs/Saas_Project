import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useTrainingProgress } from './useTrainingProgress';

const api = vi.hoisted(() => ({ lister: vi.fn(), enregistrer: vi.fn() }));
const auth = vi.hoisted(() => ({ utilisateur: null as { id: string } | null }));

vi.mock('../api/progress.api', () => ({
  listerProgression: api.lister,
  enregistrerProgression: api.enregistrer,
}));

vi.mock('@/features/auth', () => ({ useAuth: () => ({ user: auth.utilisateur }) }));

const CLE = 'rezo360:tutorial-progress:v1';

/*
  UN SEUL CLIENT PAR CAS, CREE HORS DU RENDU.

  Le construire dans le corps de l'enveloppe en fabriquait un NEUF a chaque
  rendu : la mise a jour optimiste du cache etait donc jetee au rendu suivant,
  et le test echouait pour une raison qui n'existait que dans le test.
*/
let client: QueryClient;

function enveloppe({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  window.localStorage.clear();
  auth.utilisateur = null;
  api.lister.mockResolvedValue([]);
  api.enregistrer.mockResolvedValue(undefined);
});

/**
 * Les cours sont PUBLICS : `/tutoriels` s'ouvre sans compte. Le hook doit donc
 * tenir deux régimes — le navigateur pour un visiteur, la base pour un membre —
 * sans que l'un abîme l'autre.
 */
describe('useTrainingProgress', () => {
  describe('visiteur non connecté', () => {
    it('lit la progression du navigateur sans appeler le serveur', () => {
      window.localStorage.setItem(CLE, JSON.stringify({ 'bien-demarrer': ['ch1', 'ch2'] }));

      const { result } = renderHook(() => useTrainingProgress('bien-demarrer'), {
        wrapper: enveloppe,
      });

      expect(result.current.completed).toEqual(['ch1', 'ch2']);
      expect(result.current.surLeServeur).toBe(false);
      expect(api.lister).not.toHaveBeenCalled();
    });

    it('écrit dans le navigateur, jamais en base', () => {
      const { result } = renderHook(() => useTrainingProgress('bien-demarrer'), {
        wrapper: enveloppe,
      });

      act(() => result.current.definir(['ch1']));

      expect(JSON.parse(window.localStorage.getItem(CLE) ?? '{}')).toEqual({
        'bien-demarrer': ['ch1'],
      });
      expect(api.enregistrer).not.toHaveBeenCalled();
    });
  });

  describe('membre connecté', () => {
    beforeEach(() => {
      auth.utilisateur = { id: 'u1' };
    });

    it('affiche la progression du serveur, pas celle du navigateur', async () => {
      window.localStorage.setItem(CLE, JSON.stringify({ 'bien-demarrer': ['perime'] }));
      api.lister.mockResolvedValue([
        { courseSlug: 'bien-demarrer', chapitresTermines: ['ch1', 'ch2', 'ch3'] },
      ]);

      const { result } = renderHook(() => useTrainingProgress('bien-demarrer'), {
        wrapper: enveloppe,
      });

      await waitFor(() => expect(result.current.completed).toEqual(['ch1', 'ch2', 'ch3']));
      expect(result.current.surLeServeur).toBe(true);
    });

    it('remonte une progression locale que la base ne connaît pas', async () => {
      window.localStorage.setItem(CLE, JSON.stringify({ 'clients-et-sites': ['ch1'] }));
      api.lister.mockResolvedValue([]);

      renderHook(() => useTrainingProgress('clients-et-sites'), { wrapper: enveloppe });

      await waitFor(() => expect(api.enregistrer).toHaveBeenCalledWith('clients-et-sites', ['ch1']));
    });

    it('n’écrase JAMAIS une progression déjà en base par le souvenir local', async () => {
      // Le cas qui compte. Sans cette garantie, ouvrir le cours sur un vieux
      // poste ramènerait sa progression périmée par-dessus celle, plus avancée,
      // faite ailleurs.
      window.localStorage.setItem(CLE, JSON.stringify({ 'bien-demarrer': ['ch1'] }));
      api.lister.mockResolvedValue([
        { courseSlug: 'bien-demarrer', chapitresTermines: ['ch1', 'ch2', 'ch3'] },
      ]);

      const { result } = renderHook(() => useTrainingProgress('bien-demarrer'), {
        wrapper: enveloppe,
      });

      await waitFor(() => expect(result.current.completed).toHaveLength(3));
      expect(api.enregistrer).not.toHaveBeenCalled();
    });

    it('ne rejoue pas la reprise à chaque rendu', async () => {
      window.localStorage.setItem(CLE, JSON.stringify({ 'clients-et-sites': ['ch1'] }));
      api.lister.mockResolvedValue([]);

      const { rerender } = renderHook(() => useTrainingProgress('clients-et-sites'), {
        wrapper: enveloppe,
      });

      await waitFor(() => expect(api.enregistrer).toHaveBeenCalledTimes(1));
      rerender();
      rerender();
      expect(api.enregistrer).toHaveBeenCalledTimes(1);
    });

    it('enregistre en base et affiche la coche sans attendre le serveur', async () => {
      api.lister.mockResolvedValue([]);
      let resoudre: (() => void) | undefined;
      api.enregistrer.mockImplementation(
        () =>
          new Promise<void>((r) => {
            resoudre = r;
          }),
      );

      const { result } = renderHook(() => useTrainingProgress('bien-demarrer'), {
        wrapper: enveloppe,
      });
      await waitFor(() => expect(result.current.chargement).toBe(false));

      act(() => result.current.definir(['ch1']));

      // La coche apparait alors que la promesse d'enregistrement n'est TOUJOURS
      // pas resolue : c'est ce qui prouve qu'on n'attend pas le serveur.
      await waitFor(() => expect(result.current.completed).toEqual(['ch1']));
      expect(api.enregistrer).toHaveBeenCalledWith('bien-demarrer', ['ch1']);
      expect(resoudre).toBeDefined();
      act(() => resoudre?.());
    });

    it('signale un enregistrement en échec', async () => {
      api.lister.mockResolvedValue([]);
      api.enregistrer.mockRejectedValue(new Error('reseau'));

      const { result } = renderHook(() => useTrainingProgress('bien-demarrer'), {
        wrapper: enveloppe,
      });
      await waitFor(() => expect(result.current.chargement).toBe(false));

      act(() => result.current.definir(['ch1']));

      // Une coche perdue en silence ferait croire à une progression enregistrée.
      await waitFor(() => expect(result.current.enEchec).toBe(true));
    });
  });
});
