import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
  Même patron que `prospecting.api.test.ts` : un double de builder PostgREST
  qui enregistre les appels au lieu de les jouer. Ce qui compte ici, c'est le
  CHEMIN suivi — quelle colonne de tri, quel filtre — pas la donnée renvoyée.
*/

interface Reponse {
  data: unknown;
  error: { code?: string; message: string } | null;
  count?: number | null;
}

interface Appel {
  methode: string;
  args: unknown[];
}

interface RequeteDouble extends PromiseLike<Reponse> {
  appels: Appel[];
  select: (...args: unknown[]) => RequeteDouble;
  eq: (...args: unknown[]) => RequeteDouble;
  or: (...args: unknown[]) => RequeteDouble;
  order: (...args: unknown[]) => RequeteDouble;
  range: (...args: unknown[]) => RequeteDouble;
  returns: (...args: unknown[]) => RequeteDouble;
  maybeSingle: (...args: unknown[]) => RequeteDouble;
  single: (...args: unknown[]) => RequeteDouble;
  update: (...args: unknown[]) => RequeteDouble;
  limit: (...args: unknown[]) => RequeteDouble;
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
    or: enregistrer('or'),
    order: enregistrer('order'),
    range: enregistrer('range'),
    returns: enregistrer('returns'),
    maybeSingle: enregistrer('maybeSingle'),
    single: enregistrer('single'),
    update: enregistrer('update'),
    limit: enregistrer('limit'),
    then: (ok, ko) => Promise.resolve(reponse).then(ok, ko),
  };
  return double;
}

function argsDe(double: RequeteDouble, methode: string): unknown[] | undefined {
  return double.appels.find((a) => a.methode === methode)?.args;
}

const { fromMock, storageFromMock, createSignedUrlMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  storageFromMock: vi.fn(),
  createSignedUrlMock: vi.fn(),
}));

vi.mock('@/services/supabase', async () => {
  const query = await import('@/services/supabase/query');
  return {
    unwrap: query.unwrap,
    unwrapMaybe: query.unwrapMaybe,
    supabase: { from: fromMock, storage: { from: storageFromMock } },
  };
});

import {
  getReceivedInvoiceDetail,
  getReceivedInvoiceDocumentUrl,
  listReceivedInvoices,
  updateReceivedInvoiceStatus,
} from './received-invoices.api';

const ORG = 'org-1';

beforeEach(() => {
  vi.clearAllMocks();
  storageFromMock.mockReturnValue({ createSignedUrl: createSignedUrlMock });
});

describe('listReceivedInvoices', () => {
  it('filtre toujours par organisation, jamais globalement', async () => {
    const req = requete({ data: [], error: null, count: 0 });
    fromMock.mockReturnValueOnce(req);

    await listReceivedInvoices(ORG, {});

    expect(fromMock).toHaveBeenCalledWith('received_invoices');
    expect(argsDe(req, 'eq')).toEqual(['organization_id', ORG]);
  });

  it('sans tri explicite, les plus récemment reçues arrivent en premier', async () => {
    const req = requete({ data: [], error: null, count: 0 });
    fromMock.mockReturnValueOnce(req);

    await listReceivedInvoices(ORG, {});

    expect(req.appels.filter((a) => a.methode === 'order')).toEqual([
      { methode: 'order', args: ['received_at', { ascending: false }] },
    ]);
  });

  it('trie par montant TTC croissant quand demandé', async () => {
    const req = requete({ data: [], error: null, count: 0 });
    fromMock.mockReturnValueOnce(req);

    await listReceivedInvoices(ORG, { sortBy: 'amount_with_vat', sortDirection: 'asc' });

    expect(req.appels.filter((a) => a.methode === 'order')).toEqual([
      { methode: 'order', args: ['amount_with_vat', { ascending: true }] },
    ]);
  });

  it('une recherche neutralise les caractères spéciaux du terme saisi (syntaxe `or` de PostgREST)', async () => {
    const req = requete({ data: [], error: null, count: 0 });
    fromMock.mockReturnValueOnce(req);

    await listReceivedInvoices(ORG, { search: 'Dupont & Fils (SARL), 75%' });

    // `%`/`,`/`()` du terme saisi doivent disparaître — ceux qui encadrent le
    // motif `ilike` (les vrais séparateurs de la syntaxe `or`) restent, eux.
    const orArgs = argsDe(req, 'or');
    expect(orArgs?.[0]).toBe(
      'supplier_name.ilike.%Dupont & Fils  SARL   75%,supplier_siren.ilike.%Dupont & Fils  SARL   75%,supplier_identifier.ilike.%Dupont & Fils  SARL   75%',
    );
  });

  it('le filtre de statut interne se pose seulement quand demandé', async () => {
    const reqSansFiltre = requete({ data: [], error: null, count: 0 });
    fromMock.mockReturnValueOnce(reqSansFiltre);
    await listReceivedInvoices(ORG, {});
    expect(reqSansFiltre.appels.some((a) => a.methode === 'eq' && a.args[0] === 'internal_status')).toBe(
      false,
    );

    const reqAvecFiltre = requete({ data: [], error: null, count: 0 });
    fromMock.mockReturnValueOnce(reqAvecFiltre);
    await listReceivedInvoices(ORG, { internalStatus: 'disputed' });
    expect(argsDe(reqAvecFiltre, 'eq')).toEqual(['organization_id', ORG]);
    expect(
      reqAvecFiltre.appels.some(
        (a) => a.methode === 'eq' && a.args[0] === 'internal_status' && a.args[1] === 'disputed',
      ),
    ).toBe(true);
  });
});

describe('getReceivedInvoiceDetail', () => {
  it('renvoie null sans jamais interroger les événements ni le document si la facture est introuvable', async () => {
    fromMock.mockReturnValueOnce(requete({ data: null, error: null }));

    const detail = await getReceivedInvoiceDetail('missing');

    expect(detail).toBeNull();
    expect(fromMock).toHaveBeenCalledTimes(1);
  });

  it('lit la facture, ses événements et son document une fois la facture trouvée', async () => {
    fromMock
      .mockReturnValueOnce(requete({ data: { id: 'inv-1' }, error: null }))
      .mockReturnValueOnce(requete({ data: [{ id: 'event-1' }], error: null }))
      .mockReturnValueOnce(requete({ data: { received_invoice_id: 'inv-1' }, error: null }));

    const detail = await getReceivedInvoiceDetail('inv-1');

    expect(detail).toEqual({
      invoice: { id: 'inv-1' },
      events: [{ id: 'event-1' }],
      document: { received_invoice_id: 'inv-1' },
    });
    expect(fromMock).toHaveBeenNthCalledWith(1, 'received_invoices');
    expect(fromMock).toHaveBeenNthCalledWith(2, 'received_invoice_events');
    expect(fromMock).toHaveBeenNthCalledWith(3, 'received_invoice_documents');
  });
});

describe('updateReceivedInvoiceStatus', () => {
  it('n’écrit que le statut interne, jamais un autre champ', async () => {
    const req = requete({ data: { id: 'inv-1', internal_status: 'archived' }, error: null });
    fromMock.mockReturnValueOnce(req);

    await updateReceivedInvoiceStatus('inv-1', 'archived');

    expect(argsDe(req, 'update')).toEqual([{ internal_status: 'archived' }]);
    expect(argsDe(req, 'eq')).toEqual(['id', 'inv-1']);
  });
});

describe('getReceivedInvoiceDocumentUrl', () => {
  it('signe le chemin dans le bucket privé dédié à la réception', async () => {
    createSignedUrlMock.mockResolvedValue({
      data: { signedUrl: 'https://example.test/signed' },
      error: null,
    });

    const url = await getReceivedInvoiceDocumentUrl('org-1/inv-1/original', 'facture.xml');

    expect(url).toBe('https://example.test/signed');
    expect(storageFromMock).toHaveBeenCalledWith('received-invoice-documents');
    expect(createSignedUrlMock).toHaveBeenCalledWith('org-1/inv-1/original', 3600, {
      download: 'facture.xml',
    });
  });
});
