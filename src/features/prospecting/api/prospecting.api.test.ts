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

const { fromMock, rpcMock } = vi.hoisted(() => ({ fromMock: vi.fn(), rpcMock: vi.fn() }));

vi.mock('@/services/supabase', async () => {
  const query = await import('@/services/supabase/query');
  return {
    unwrap: query.unwrap,
    unwrapMaybe: query.unwrapMaybe,
    supabase: { from: fromMock, rpc: rpcMock },
  };
});

import {
  checkPlatformAdminStatus,
  convertProspectToClient,
  getProspectingAnalytics,
  listProspects,
  searchOrganizationsForConversion,
  suppressProspect,
  updateProspectStatus,
} from './prospecting.api';

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

interface RpcDouble extends PromiseLike<Reponse> {
  returns: () => RpcDouble;
}

function rpcRequete(reponse: Reponse): RpcDouble {
  const double: RpcDouble = {
    returns: () => double,
    then: (ok, ko) => Promise.resolve(reponse).then(ok, ko),
  };
  return double;
}

const ORG_ID = '22222222-2222-4222-8222-222222222222';

describe('searchOrganizationsForConversion', () => {
  it('transmet la requête telle quelle à la RPC', async () => {
    rpcMock.mockReturnValueOnce(
      rpcRequete({ data: [{ id: ORG_ID, name: 'HBG Labs', legal_name: null, registration_number: null }], error: null }),
    );

    const results = await searchOrganizationsForConversion('hbg');

    expect(rpcMock).toHaveBeenCalledWith('prospecting_search_organizations', { p_query: 'hbg' });
    expect(results).toHaveLength(1);
    expect(results[0]!.name).toBe('HBG Labs');
  });
});

describe('convertProspectToClient', () => {
  it('appelle la RPC avec le siren et l’organisation, et lève en cas d’erreur', async () => {
    rpcMock.mockReturnValueOnce(Promise.resolve({ data: null, error: null }));

    await convertProspectToClient(SIREN, ORG_ID);

    expect(rpcMock).toHaveBeenCalledWith('convert_prospect_to_client', {
      p_siren: SIREN,
      p_organization_id: ORG_ID,
    });
  });

  it('propage l’erreur de la RPC (ex. organisation déjà liée)', async () => {
    rpcMock.mockReturnValueOnce(
      Promise.resolve({ data: null, error: { message: 'Cette organisation est déjà liée à un autre prospect converti.' } }),
    );

    await expect(convertProspectToClient(SIREN, ORG_ID)).rejects.toThrow(/déjà liée/);
  });
});

interface SingleRpcDouble extends PromiseLike<Reponse> {
  single: () => SingleRpcDouble;
}

function singleRpcRequete(reponse: Reponse): SingleRpcDouble {
  const double: SingleRpcDouble = {
    single: () => double,
    then: (ok, ko) => Promise.resolve(reponse).then(ok, ko),
  };
  return double;
}

describe('getProspectingAnalytics', () => {
  it('transmet la fenêtre de dates (cohorte par date de DÉTECTION) telle quelle à la RPC', async () => {
    const funnel = { detected: 3, qualified: 2, contacted: 1, interested: 1, trial: 1, converted: 1 };
    rpcMock.mockReturnValueOnce(
      singleRpcRequete({
        data: {
          funnel,
          rates: { qualification: 0.6667, contact: 0.3333, interest: 0.3333, trial: 0.3333, conversion: 0.3333 },
          by_zone: [],
          by_sector: [],
          by_score_tier: [],
          by_company_age: [],
          by_source: [],
        },
        error: null,
      }),
    );

    const result = await getProspectingAnalytics({ from: '2026-09-01', to: '2026-09-30' });

    expect(rpcMock).toHaveBeenCalledWith('prospecting_analytics', {
      p_from: '2026-09-01',
      p_to: '2026-09-30',
    });
    expect(result.funnel).toEqual(funnel);
  });

  it('transmet null en l’absence de filtre (aucune fenêtre)', async () => {
    rpcMock.mockReturnValueOnce(
      singleRpcRequete({
        data: {
          funnel: { detected: 0, qualified: 0, contacted: 0, interested: 0, trial: 0, converted: 0 },
          rates: { qualification: 0, contact: 0, interest: 0, trial: 0, conversion: 0 },
          by_zone: [],
          by_sector: [],
          by_score_tier: [],
          by_company_age: [],
          by_source: [],
        },
        error: null,
      }),
    );

    await getProspectingAnalytics({ from: null, to: null });

    expect(rpcMock).toHaveBeenCalledWith('prospecting_analytics', { p_from: null, p_to: null });
  });
});

interface ListDouble extends PromiseLike<Reponse> {
  select: (...args: unknown[]) => ListDouble;
  order: (...args: unknown[]) => ListDouble;
  range: (...args: unknown[]) => ListDouble;
  returns: () => ListDouble;
  ordres: Array<{ column: string; options: unknown }>;
}

function listeRequete(): ListDouble {
  const ordres: Array<{ column: string; options: unknown }> = [];
  const double: ListDouble = {
    ordres,
    select: () => double,
    order: (column: unknown, options: unknown) => {
      ordres.push({ column: column as string, options });
      return double;
    },
    range: () => double,
    returns: () => double,
    then: (ok, ko) => Promise.resolve({ data: [], error: null }).then(ok, ko),
  };
  return double;
}

describe('listProspects', () => {
  it('sans tri explicite, garde l’ordre par défaut (score puis date de détection, décroissants)', async () => {
    const requete = listeRequete();
    fromMock.mockReturnValueOnce(requete);

    await listProspects({});

    expect(requete.ordres).toEqual([
      { column: 'opportunity_score', options: { ascending: false } },
      { column: 'first_detected_at', options: { ascending: false } },
    ]);
  });

  it('trie par ancienneté croissante quand demandé', async () => {
    const requete = listeRequete();
    fromMock.mockReturnValueOnce(requete);

    await listProspects({ sortBy: 'created_on', sortDirection: 'asc' });

    expect(requete.ordres).toEqual([{ column: 'created_on', options: { ascending: true } }]);
  });

  it('trie sur la table jointe pour le secteur et la zone', async () => {
    const requeteSecteur = listeRequete();
    fromMock.mockReturnValueOnce(requeteSecteur);
    await listProspects({ sortBy: 'sector', sortDirection: 'desc' });
    expect(requeteSecteur.ordres).toEqual([
      { column: 'label', options: { referencedTable: 'prospecting_sectors', ascending: false } },
    ]);

    const requeteZone = listeRequete();
    fromMock.mockReturnValueOnce(requeteZone);
    await listProspects({ sortBy: 'zone', sortDirection: 'asc' });
    expect(requeteZone.ordres).toEqual([
      { column: 'label', options: { referencedTable: 'prospecting_zones', ascending: true } },
    ]);
  });
});
