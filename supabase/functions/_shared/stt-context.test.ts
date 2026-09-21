import { assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';

import { TERMES_MAX, chargerTermesOrganisation, contexteOrganisation } from './stt-context.ts';

/*
  Ce qui est vérifié : le worker demande le dictionnaire de CETTE organisation
  (filtre explicite), range les types les plus spécifiques en premier, plafonne,
  et la phrase de contexte place le dictionnaire avant le glossaire du secteur.
*/

function fauxAdmin(rows: Array<{ term: string; type: string }>, industry = 'fiber_telecom') {
  const filtres: Array<[string, string]> = [];
  const admin = {
    from(table: string) {
      const chaine = {
        select: () => chaine,
        eq: (col: string, val: string) => {
          filtres.push([`${table}.${col}`, val]);
          return chaine;
        },
        limit: () => Promise.resolve({ data: rows, error: null }),
        maybeSingle: () => Promise.resolve({ data: { industry }, error: null }),
      };
      return chaine;
    },
  } as unknown as Parameters<typeof chargerTermesOrganisation>[0];
  return { admin, filtres };
}

Deno.test('lit le dictionnaire de l’organisation demandée, rangé par spécificité', async () => {
  const faux = fauxAdmin([
    { term: 'multimètre', type: 'technique' },
    { term: 'Caraïbe Télécom', type: 'client' },
    { term: 'Le Lorrain', type: 'lieu' },
    { term: 'Alice Martin', type: 'personne' },
    { term: 'Agence du Lorrain', type: 'site' },
    { term: 'bidule', type: 'autre' },
  ]);
  const termes = await chargerTermesOrganisation(faux.admin, 'org-1');
  assertEquals(termes, [
    'Caraïbe Télécom',
    'Agence du Lorrain',
    'Alice Martin',
    'Le Lorrain',
    'multimètre',
    'bidule',
  ]);
  assertEquals(faux.filtres, [['organization_vocabulary.organization_id', 'org-1']]);
});

Deno.test('plafonne à 150 termes', async () => {
  const faux = fauxAdmin(
    Array.from({ length: 300 }, (_, i) => ({ term: `t${String(i)}`, type: 'autre' })),
  );
  assertEquals((await chargerTermesOrganisation(faux.admin, 'org-1')).length, TERMES_MAX);
});

Deno.test('une erreur de lecture donne un dictionnaire vide, pas une panne', async () => {
  const admin = {
    from: () => ({
      select: () => ({
        eq: () => ({ limit: () => Promise.resolve({ data: null, error: { message: 'x' } }) }),
      }),
    }),
  } as unknown as Parameters<typeof chargerTermesOrganisation>[0];
  assertEquals(await chargerTermesOrganisation(admin, 'org-1'), []);
});

Deno.test(
  'la phrase de contexte : dictionnaire d’abord, puis le glossaire du secteur',
  async () => {
    const faux = fauxAdmin([{ term: 'Caraïbe Télécom', type: 'client' }], 'electrical');
    const prompt = await contexteOrganisation(faux.admin, 'org-1');
    assertStringIncludes(prompt, ': Caraïbe Télécom, ');
    assertStringIncludes(prompt, 'disjoncteur');
    assertEquals(prompt.includes('PTO'), false, 'pas le glossaire fibre pour un électricien');
  },
);
