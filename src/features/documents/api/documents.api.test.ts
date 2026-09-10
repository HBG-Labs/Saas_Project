import { beforeEach, describe, expect, it, vi } from 'vitest';

interface Reponse {
  data: unknown;
  error: { message: string } | null;
  count?: number;
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
  in: (...args: unknown[]) => RequeteDouble;
  or: (...args: unknown[]) => RequeteDouble;
  order: (...args: unknown[]) => RequeteDouble;
  range: (...args: unknown[]) => RequeteDouble;
  insert: (...args: unknown[]) => RequeteDouble;
  update: (...args: unknown[]) => RequeteDouble;
  delete: (...args: unknown[]) => RequeteDouble;
  single: (...args: unknown[]) => RequeteDouble;
}

/**
 * Doublure de builder PostgREST.
 *
 * Elle enregistre les appels au lieu de les jouer : ce qui est vérifié ici,
 * c'est la requête ENVOYÉE — la plage de pagination, le filtre de famille, le
 * motif de recherche échappé. Une doublure qui renverrait simplement des lignes
 * ne prouverait rien de tout cela.
 */
function requete(reponse: Reponse, journal?: string[]): RequeteDouble {
  const appels: Appel[] = [];
  const enregistrer =
    (methode: string) =>
    (...args: unknown[]): RequeteDouble => {
      appels.push({ methode, args });
      journal?.push(`table.${methode}`);
      return double;
    };

  const double: RequeteDouble = {
    appels,
    select: enregistrer('select'),
    eq: enregistrer('eq'),
    is: enregistrer('is'),
    in: enregistrer('in'),
    or: enregistrer('or'),
    order: enregistrer('order'),
    range: enregistrer('range'),
    insert: enregistrer('insert'),
    update: enregistrer('update'),
    delete: enregistrer('delete'),
    single: enregistrer('single'),
    then: (ok, ko) => Promise.resolve(reponse).then(ok, ko),
  };

  return double;
}

function argsDe(double: RequeteDouble, methode: string): unknown[] | undefined {
  return double.appels.find((a) => a.methode === methode)?.args;
}

const { fromMock, storageFromMock, upload, remove, createSignedUrl } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  storageFromMock: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  createSignedUrl: vi.fn(),
}));

vi.mock('@/services/supabase', async () => {
  // `unwrap` est la vraie : c'est elle qui décide qu'une erreur PostgREST doit
  // être levée, et le rattrapage du dépôt en dépend.
  const query = await import('@/services/supabase/query');
  return {
    unwrap: query.unwrap,
    unwrapMaybe: query.unwrapMaybe,
    supabase: {
      from: fromMock,
      storage: { from: storageFromMock },
    },
  };
});

import { buildDocumentPath, deleteDocument, listDocuments, uploadDocument } from './documents.api';

const ORG = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  vi.clearAllMocks();
  storageFromMock.mockReturnValue({ upload, remove, createSignedUrl });
  upload.mockResolvedValue({ data: { path: 'x' }, error: null });
  remove.mockResolvedValue({ data: [], error: null });
});

describe('buildDocumentPath', () => {
  it('place l’organisation en premier segment — c’est tout ce que lisent les policies Storage', () => {
    const chemin = buildDocumentPath({ organizationId: ORG, fileName: 'notice.pdf' });
    expect(chemin.split('/')[0]).toBe(ORG);
    expect(chemin.split('/')).toHaveLength(2);
  });

  it('rend une traversée de répertoire impossible', () => {
    const chemin = buildDocumentPath({
      organizationId: ORG,
      fileName: '../../22222222-2222-4222-8222-222222222222/vol.pdf',
    });

    // Aucun séparateur ne survit à l'assainissement : le nom du fichier ne peut
    // donc pas ajouter de segment, et le segment d'organisation ne peut pas
    // être quitté.
    expect(chemin.split('/')).toHaveLength(2);
    expect(chemin.split('/')[0]).toBe(ORG);
  });

  it('écarte espaces, accents et ponctuation du nom de fichier', () => {
    const chemin = buildDocumentPath({
      organizationId: ORG,
      fileName: 'Procédure fibre (v2) #final.pdf',
    });
    expect(chemin.split('/')[1]).toMatch(/^[a-zA-Z0-9._-]+$/);
  });

  it('donne deux chemins distincts à deux fichiers de même nom', () => {
    const a = buildDocumentPath({ organizationId: ORG, fileName: 'plan.pdf' });
    const b = buildDocumentPath({ organizationId: ORG, fileName: 'plan.pdf' });
    expect(a).not.toBe(b);
  });

  it('tronque un nom démesuré en gardant l’extension', () => {
    const chemin = buildDocumentPath({
      organizationId: ORG,
      fileName: `${'a'.repeat(300)}.pdf`,
    });
    expect(chemin.endsWith('.pdf')).toBe(true);
    // 80 caractères de nom, plus le préfixe « uuid- ».
    expect(chemin.split('/')[1]!.length).toBeLessThanOrEqual(80 + 37);
  });
});

describe('listDocuments', () => {
  function preparer(reponse: Partial<Reponse> = {}): RequeteDouble {
    const double = requete({ data: [], error: null, count: 0, ...reponse });
    fromMock.mockReturnValue(double);
    return double;
  }

  it('demande la première page et le compte exact', async () => {
    const double = preparer();
    await listDocuments({ organizationId: ORG });

    expect(fromMock).toHaveBeenCalledWith('organization_documents');
    expect(argsDe(double, 'select')).toEqual(['*', { count: 'exact' }]);
    expect(argsDe(double, 'eq')).toEqual(['organization_id', ORG]);
    expect(argsDe(double, 'range')).toEqual([0, 23]);
  });

  it('décale la plage selon la page demandée', async () => {
    const double = preparer();
    await listDocuments({ organizationId: ORG, page: 2 });
    expect(argsDe(double, 'range')).toEqual([48, 71]);
  });

  it('filtre sur les types MIME de la famille, jamais sur l’extension', async () => {
    const double = preparer();
    await listDocuments({ organizationId: ORG, famille: 'image' });
    expect(argsDe(double, 'in')).toEqual(['mime_type', ['image/jpeg', 'image/png', 'image/webp']]);
  });

  it('ne filtre pas quand la famille est « tous »', async () => {
    const double = preparer();
    await listDocuments({ organizationId: ORG, famille: 'tous' });
    expect(argsDe(double, 'in')).toBeUndefined();
  });

  it('distingue « sans dossier » de « tous les dossiers »', async () => {
    const sansDossier = preparer();
    await listDocuments({ organizationId: ORG, folderId: null });
    expect(argsDe(sansDossier, 'is')).toEqual(['folder_id', null]);

    const unDossier = preparer();
    await listDocuments({ organizationId: ORG, folderId: 'dossier-1' });
    expect(unDossier.appels.filter((a) => a.methode === 'eq')).toHaveLength(2);

    const tous = preparer();
    await listDocuments({ organizationId: ORG });
    expect(argsDe(tous, 'is')).toBeUndefined();
    expect(tous.appels.filter((a) => a.methode === 'eq')).toHaveLength(1);
  });

  it('échappe les jokers du terme de recherche', async () => {
    const double = preparer();
    await listDocuments({ organizationId: ORG, search: '100%_net' });

    const motif = String(argsDe(double, 'or')?.[0]);
    // Sans échappement, le « % » et le « _ » saisis par l'utilisateur
    // deviendraient des jokers ILIKE et la recherche ramènerait n'importe quoi.
    expect(motif).toContain('\\%');
    expect(motif).toContain('\\_');
  });

  it('ignore une recherche vide', async () => {
    const double = preparer();
    await listDocuments({ organizationId: ORG, search: '   ' });
    expect(argsDe(double, 'or')).toBeUndefined();
  });

  it('remonte le total renvoyé par la base', async () => {
    preparer({ data: [{ id: 'd1' }], count: 137 });
    const resultat = await listDocuments({ organizationId: ORG });
    expect(resultat.total).toBe(137);
    expect(resultat.documents).toHaveLength(1);
  });
});

describe('uploadDocument', () => {
  const fichier = new File(['%PDF-1.7\ncontenu'], 'notice.pdf', { type: 'application/pdf' });

  it('retire le fichier déposé si l’enregistrement échoue', async () => {
    fromMock.mockReturnValue(requete({ data: null, error: { message: 'refusé' } }));

    await expect(
      uploadDocument({ organizationId: ORG, file: fichier, name: 'Notice', uploadedBy: 'u1' }),
    ).rejects.toBeDefined();

    // Sans ce rattrapage, le bucket accumulerait des objets que plus rien ne
    // référence, donc introuvables.
    expect(remove).toHaveBeenCalledTimes(1);
    const chemins = remove.mock.calls[0]?.[0] as string[];
    expect(chemins[0]!.split('/')[0]).toBe(ORG);
  });

  it('n’écrit rien en base si le dépôt du fichier échoue', async () => {
    upload.mockResolvedValueOnce({ data: null, error: { message: 'trop gros' } });

    await expect(
      uploadDocument({ organizationId: ORG, file: fichier, name: 'Notice', uploadedBy: 'u1' }),
    ).rejects.toBeDefined();

    expect(fromMock).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it('enregistre le chemin, le type et la taille réels du fichier', async () => {
    const double = requete({ data: { id: 'd1' }, error: null });
    fromMock.mockReturnValue(double);

    await uploadDocument({
      organizationId: ORG,
      file: fichier,
      name: '  Notice fibre  ',
      uploadedBy: 'u1',
      folderId: 'dossier-1',
    });

    const ligne = argsDe(double, 'insert')?.[0] as Record<string, unknown>;
    expect(ligne.organization_id).toBe(ORG);
    expect(ligne.name).toBe('Notice fibre');
    expect(ligne.original_filename).toBe('notice.pdf');
    expect(ligne.mime_type).toBe('application/pdf');
    expect(ligne.folder_id).toBe('dossier-1');
    expect(String(ligne.storage_path).split('/')[0]).toBe(ORG);
    expect(remove).not.toHaveBeenCalled();
  });
});

describe('deleteDocument', () => {
  const document = {
    id: 'd1',
    organization_id: ORG,
    storage_path: `${ORG}/uuid-notice.pdf`,
  } as Parameters<typeof deleteDocument>[0];

  it('supprime la ligne AVANT le fichier', async () => {
    const journal: string[] = [];
    remove.mockImplementation(() => {
      journal.push('storage.remove');
      return Promise.resolve({ data: [], error: null });
    });
    fromMock.mockReturnValue(requete({ data: null, error: null }, journal));

    await deleteDocument(document);

    // L'ordre inverse laisserait une ligne pointant vers un fichier disparu :
    // visible dans la bibliothèque, et impossible à ouvrir.
    expect(journal.indexOf('table.delete')).toBeLessThan(journal.indexOf('storage.remove'));
  });

  it('consigne un orphelin quand le fichier résiste, sans faire échouer la suppression', async () => {
    remove.mockResolvedValueOnce({ data: null, error: { message: 'storage indisponible' } });

    const doubles: RequeteDouble[] = [];
    fromMock.mockImplementation((table: string) => {
      const double = requete({
        data: table === 'document_storage_orphans' ? {} : null,
        error: null,
      });
      doubles.push(double);
      return double;
    });

    await expect(deleteDocument(document)).resolves.toBeUndefined();

    expect(fromMock).toHaveBeenCalledWith('document_storage_orphans');
    const trace = argsDe(doubles[1]!, 'insert')?.[0] as Record<string, unknown>;
    expect(trace.document_id).toBe('d1');
    expect(trace.storage_path).toBe(`${ORG}/uuid-notice.pdf`);
    expect(trace.error_message).toContain('storage indisponible');
  });

  it('ne touche pas au fichier si la ligne n’a pas pu être supprimée', async () => {
    fromMock.mockReturnValue(requete({ data: null, error: { message: 'droits insuffisants' } }));

    await expect(deleteDocument(document)).rejects.toBeDefined();
    expect(remove).not.toHaveBeenCalled();
  });
});
