import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  listNotificationStates: vi.fn(),
  upsertNotificationStates: vi.fn(),
}));

vi.mock('../api/notification-states.api', () => api);

import { useNotificationStates } from './useNotificationStates';

const USER = 'user-1';
const ORG = 'org-1';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return createElement(QueryClientProvider, { client }, children);
}

function monter() {
  return renderHook(() => useNotificationStates(USER, ORG), { wrapper });
}

describe('useNotificationStates', () => {
  beforeEach(() => {
    localStorage.clear();
    api.listNotificationStates.mockReset();
    api.upsertNotificationStates.mockReset();
    api.upsertNotificationStates.mockResolvedValue(undefined);
  });

  it('fait foi sur la base dès qu’elle a répondu', async () => {
    api.listNotificationStates.mockResolvedValue([
      {
        notification_key: 'mission_assigned_a',
        read_at: '2026-09-20T08:00:00Z',
        dismissed_at: null,
      },
      { notification_key: 'stock_low_b_3', read_at: null, dismissed_at: '2026-09-20T08:00:00Z' },
    ]);

    const { result } = monter();

    await waitFor(() => expect(result.current.synchronise).toBe(true));
    expect(result.current.readIds.has('mission_assigned_a')).toBe(true);
    expect(result.current.dismissedIds.has('stock_low_b_3')).toBe(true);
    expect(api.listNotificationStates).toHaveBeenCalledWith(ORG);
  });

  it('retombe sur le miroir local quand la base refuse', async () => {
    /*
      Le cas qui compte pour le déploiement : ce client peut tourner avant que
      la migration `notification_states` ait été appliquée. La table absente
      fait échouer la requête ; le comportement d'avant doit reprendre, sans
      erreur à l'écran et sans perdre ce que le navigateur savait.
    */
    localStorage.setItem(`rezo360_read_notifications_${USER}`, JSON.stringify(['leave_pending_1']));
    api.listNotificationStates.mockRejectedValue(new Error('relation does not exist'));

    const { result } = monter();

    await waitFor(() => expect(api.listNotificationStates).toHaveBeenCalled());
    expect(result.current.synchronise).toBe(false);
    expect(result.current.readIds.has('leave_pending_1')).toBe(true);
  });

  it('applique une lecture immédiatement, puis l’envoie à la base', async () => {
    api.listNotificationStates.mockResolvedValue([]);
    const { result } = monter();
    await waitFor(() => expect(result.current.synchronise).toBe(true));

    act(() => {
      result.current.marquerLues(['report_review_9']);
    });

    // Optimiste : visible avant tout retour du serveur.
    expect(result.current.readIds.has('report_review_9')).toBe(true);

    await waitFor(() =>
      expect(api.upsertNotificationStates).toHaveBeenCalledWith(USER, ORG, [
        expect.objectContaining({
          notification_key: 'report_review_9',
          read_at: expect.any(String),
        }),
      ]),
    );

    // Et le miroir local suit, pour le prochain repli.
    const miroir: unknown = JSON.parse(
      localStorage.getItem(`rezo360_read_notifications_${USER}`) ?? '[]',
    );
    expect(miroir).toContain('report_review_9');
  });

  it('écarte une notification sans toucher à sa lecture', async () => {
    api.listNotificationStates.mockResolvedValue([]);
    const { result } = monter();
    await waitFor(() => expect(result.current.synchronise).toBe(true));

    act(() => {
      result.current.ecarter('client_message_c');
    });

    expect(result.current.dismissedIds.has('client_message_c')).toBe(true);
    await waitFor(() =>
      expect(api.upsertNotificationStates).toHaveBeenCalledWith(USER, ORG, [
        expect.objectContaining({
          notification_key: 'client_message_c',
          dismissed_at: expect.any(String),
        }),
      ]),
    );
    // Aucun `read_at` n'a été envoyé : l'API ne doit pas écraser ce qu'elle ignore.
    const appel = api.upsertNotificationStates.mock.calls[0]?.[2] as { read_at?: string }[];
    expect(appel[0]?.read_at).toBeUndefined();
  });

  it('reprend ce que le navigateur savait et que la base ignore, une seule fois', async () => {
    /*
      Le jour de la bascule : la base est vide, le navigateur porte des mois de
      « lues ». Sans reprise, tout redevient non lu d'un coup — exactement la
      « réinitialisation inattendue » que la migration doit éviter.
    */
    localStorage.setItem(
      `rezo360_read_notifications_${USER}`,
      JSON.stringify(['leave_pending_1', 'mission_assigned_2']),
    );
    localStorage.setItem(
      `rezo360_dismissed_notifications_${USER}`,
      JSON.stringify(['stock_low_3_0']),
    );
    // La base en connaît déjà une : elle ne doit pas être renvoyée.
    api.listNotificationStates.mockResolvedValue([
      {
        notification_key: 'mission_assigned_2',
        read_at: '2026-09-01T00:00:00Z',
        dismissed_at: null,
      },
    ]);

    const { result, rerender } = monter();
    await waitFor(() => expect(result.current.synchronise).toBe(true));

    await waitFor(() => expect(api.upsertNotificationStates).toHaveBeenCalledTimes(1));
    const [, , patches] = api.upsertNotificationStates.mock.calls[0] as [
      string,
      string,
      { notification_key: string; read_at?: string; dismissed_at?: string }[],
    ];
    expect(patches.map((p) => p.notification_key).sort()).toEqual([
      'leave_pending_1',
      'stock_low_3_0',
    ]);

    // Un rendu de plus ne relance pas la reprise.
    rerender();
    await waitFor(() => expect(result.current.synchronise).toBe(true));
    expect(api.upsertNotificationStates).toHaveBeenCalledTimes(1);
  });

  it('ne rejoue jamais la reprise, même après un rechargement', async () => {
    /*
      Le cas qui rendrait la reprise NON idempotente : un état retiré côté
      base, encore présent dans le miroir. Un rechargement (nouvelle instance
      du hook) ne doit pas le réinjecter — après la reprise, la base fait foi.
    */
    localStorage.setItem(`rezo360_read_notifications_${USER}`, JSON.stringify(['leave_pending_1']));
    api.listNotificationStates.mockResolvedValue([]);

    const premier = monter();
    await waitFor(() => expect(api.upsertNotificationStates).toHaveBeenCalledTimes(1));
    premier.unmount();

    // « Rechargement » : la base a retiré la ligne, le miroir l'a encore.
    api.listNotificationStates.mockResolvedValue([]);
    const second = monter();
    await waitFor(() => expect(second.result.current.synchronise).toBe(true));

    expect(api.upsertNotificationStates).toHaveBeenCalledTimes(1);
    expect(second.result.current.readIds.has('leave_pending_1')).toBe(false);
  });

  it('garde l’état sur cet appareil quand la base refuse l’écriture', async () => {
    /*
      Supabase indisponible au moment du clic. L'écriture échoue, le cache
      optimiste est annulé, la relecture échoue à son tour — et c'est alors le
      miroir local qui fait foi : la notification reste lue ici, comme avant
      la migration. Rien ne se perd, rien ne clignote.
    */
    api.listNotificationStates.mockResolvedValueOnce([]);
    const { result } = monter();
    await waitFor(() => expect(result.current.synchronise).toBe(true));

    api.upsertNotificationStates.mockRejectedValue(new Error('fetch failed'));
    api.listNotificationStates.mockRejectedValue(new Error('fetch failed'));

    act(() => {
      result.current.marquerLues(['report_review_9']);
    });

    await waitFor(() => expect(api.upsertNotificationStates).toHaveBeenCalled());
    await waitFor(() => expect(result.current.synchronise).toBe(false));
    expect(result.current.readIds.has('report_review_9')).toBe(true);
  });

  it('ne parle pas à la base sans organisation', () => {
    const { result } = renderHook(() => useNotificationStates(USER, null), { wrapper });

    expect(api.listNotificationStates).not.toHaveBeenCalled();
    act(() => {
      result.current.marquerLues(['x']);
    });
    expect(api.upsertNotificationStates).not.toHaveBeenCalled();
    // Mais le miroir local, lui, prend — comme avant.
    expect(result.current.readIds.has('x')).toBe(true);
  });
});
