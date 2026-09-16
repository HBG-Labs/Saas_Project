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

interface Appel {
  methode: string;
  args: unknown[];
}

interface RequeteDouble extends PromiseLike<Reponse> {
  appels: Appel[];
  select: (...args: unknown[]) => RequeteDouble;
  eq: (...args: unknown[]) => RequeteDouble;
  is: (...args: unknown[]) => RequeteDouble;
  lte: (...args: unknown[]) => RequeteDouble;
  order: (...args: unknown[]) => RequeteDouble;
  maybeSingle: (...args: unknown[]) => RequeteDouble;
  single: (...args: unknown[]) => RequeteDouble;
  insert: (...args: unknown[]) => RequeteDouble;
  update: (...args: unknown[]) => RequeteDouble;
}

function requete(reponse: Reponse): RequeteDouble {
  const appels: Appel[] = [];
  const enregistrer =
    (methode: string) =>
    (...args: unknown[]): RequeteDouble => {
      appels.push({ methode, args });
      return double;
    };

  const double: RequeteDouble = {
    appels,
    select: enregistrer('select'),
    eq: enregistrer('eq'),
    is: enregistrer('is'),
    lte: enregistrer('lte'),
    order: enregistrer('order'),
    maybeSingle: enregistrer('maybeSingle'),
    single: enregistrer('single'),
    insert: enregistrer('insert'),
    update: enregistrer('update'),
    then: (ok, ko) => Promise.resolve(reponse).then(ok, ko),
  };
  return double;
}

function argsDe(double: RequeteDouble, methode: string): unknown[] | undefined {
  return double.appels.find((a) => a.methode === methode)?.args;
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

import { checkPlatformAdminStatus, suppressProspect, updateProspectStatus } from './prospecting.api';

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

const SIREN = '123456789';

describe('updateProspectStatus', () => {
  it('met à jour uniquement le statut, sur le bon prospect', async () => {
    const double = requete({ data: { siren: SIREN }, error: null });
    fromMock.mockReturnValueOnce(double);

    await updateProspectStatus(SIREN, 'a_qualifier');

    expect(fromMock).toHaveBeenCalledWith('prospects');
    expect(argsDe(double, 'update')).toEqual([{ status: 'a_qualifier' }]);
    expect(argsDe(double, 'eq')).toEqual(['siren', SIREN]);
  });
});

describe('suppressProspect', () => {
  it('pose l’opposition PUIS force le statut — jamais l’inverse', async () => {
    const insertion = requete({ data: { siren: SIREN }, error: null });
    const maj = requete({ data: { siren: SIREN }, error: null });
    fromMock.mockReturnValueOnce(insertion).mockReturnValueOnce(maj);

    await suppressProspect(SIREN, 'demande explicite');

    expect(fromMock).toHaveBeenNthCalledWith(1, 'prospect_suppressions');
    expect(argsDe(insertion, 'insert')).toEqual([{ siren: SIREN, reason: 'demande explicite' }]);
    expect(fromMock).toHaveBeenNthCalledWith(2, 'prospects');
    expect(argsDe(maj, 'update')).toEqual([{ status: 'ne_plus_contacter' }]);
  });
});
