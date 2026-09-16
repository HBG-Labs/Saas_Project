import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
  Même patron que `documents.api.test.ts` : un double de builder PostgREST qui
  enregistre les appels au lieu de les jouer. Le point critique ici n'est pas
  la donnée renvoyée, c'est le CHEMIN suivi : `checkPlatformAdminStatus` ne
  doit interroger `platform_admin_permissions` que si `platform_admins` a
  répondu une ligne — jamais l'inverse, et jamais renvoyer `isAdmin: true`
  sans ligne réelle dans `platform_admins`.
*/

interface Reponse {
  data: unknown;
  error: { code?: string; message: string } | null;
}

interface RequeteDouble extends PromiseLike<Reponse> {
  select: (...args: unknown[]) => RequeteDouble;
  eq: (...args: unknown[]) => RequeteDouble;
  maybeSingle: (...args: unknown[]) => RequeteDouble;
}

function requete(reponse: Reponse): RequeteDouble {
  const double: RequeteDouble = {
    select: () => double,
    eq: () => double,
    maybeSingle: () => double,
    then: (ok, ko) => Promise.resolve(reponse).then(ok, ko),
  };
  return double;
}

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock('@/services/supabase', async () => {
  const query = await import('@/services/supabase/query');
  return {
    unwrap: query.unwrap,
    unwrapMaybe: query.unwrapMaybe,
    supabase: { from: fromMock },
  };
});

import { checkPlatformAdminStatus } from './prospecting.api';

const USER_ID = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('checkPlatformAdminStatus', () => {
  it('renvoie isAdmin: false, sans interroger les permissions, quand platform_admins ne renvoie aucune ligne', async () => {
    fromMock.mockReturnValueOnce(requete({ data: null, error: null }));

    const status = await checkPlatformAdminStatus(USER_ID);

    expect(status).toEqual({ isAdmin: false, permissions: [] });
    // Une seule table interrogée : jamais `platform_admin_permissions` sans
    // ligne d'administrateur d'abord.
    expect(fromMock).toHaveBeenCalledTimes(1);
    expect(fromMock).toHaveBeenCalledWith('platform_admins');
  });

  it('renvoie les permissions réelles quand une ligne platform_admins existe', async () => {
    fromMock
      .mockReturnValueOnce(requete({ data: { user_id: USER_ID }, error: null }))
      .mockReturnValueOnce(
        requete({ data: [{ permission: 'prospecting.view' }, { permission: 'prospecting.manage' }], error: null }),
      );

    const status = await checkPlatformAdminStatus(USER_ID);

    expect(status).toEqual({ isAdmin: true, permissions: ['prospecting.view', 'prospecting.manage'] });
    expect(fromMock).toHaveBeenNthCalledWith(1, 'platform_admins');
    expect(fromMock).toHaveBeenNthCalledWith(2, 'platform_admin_permissions');
  });
});
