import { assert, assertEquals } from 'jsr:@std/assert@1';

import {
  appliquerPropositions,
  cleDe,
  distance,
  distanceToleree,
  lirePropositions,
  normaliserOrthographe,
  normaliserTranscription,
  rejouer,
} from './transcript-normalize.ts';

/*
  Ce qui est vérifié : la normalisation ne fait QUE remplacer des formes par
  des termes connus ; elle ne reformule pas, n'invente pas, ne touche ni aux
  nombres ni au reste du texte ; chaque remplacement est tracé, et la trace
  rejouée sur le brut redonne le texte — sinon la passe est jetée.
*/

const TERMES = [
  'Caraïbe Télécom',
  'PTO',
  'PBO',
  '36FO',
  'boîtier',
  'Marie-Laure Adélaïde',
  'Le Lamentin',
];

Deno.test('clé : casse, accents, tirets et « 36 fo » sont indifférents', () => {
  assertEquals(cleDe('Caraïbe-Télécom'), 'caraibe telecom');
  assertEquals(cleDe('36 fo'), '36fo');
  assertEquals(cleDe('  PTO '), 'pto');
});

Deno.test('orthographe : la graphie des termes connus, et rien d’autre', () => {
  const brut =
    'On est chez caraibe telecom, la pto est posée et le 36 fo est tiré. Le boitier est fermé.';
  const { texte, remplacements } = normaliserOrthographe(brut, TERMES);
  assertEquals(
    texte,
    'On est chez Caraïbe Télécom, la PTO est posée et le 36FO est tiré. Le boîtier est fermé.',
  );
  assertEquals(remplacements.map((r) => `${r.de}→${r.vers}`).sort(), [
    '36 fo→36FO',
    'boitier→boîtier',
    'caraibe telecom→Caraïbe Télécom',
    'pto→PTO',
  ]);
  assert(remplacements.every((r) => r.couche === 'orthographe' && r.occurrences === 1));
});

Deno.test('orthographe : une majuscule de début de phrase sur un terme en minuscules reste', () => {
  const brut = 'Boîtier fermé. Boitier vérifié.';
  const { texte, remplacements } = normaliserOrthographe(brut, ['boîtier']);
  assertEquals(texte, 'Boîtier fermé. Boîtier vérifié.');
  assertEquals(remplacements, [
    { de: 'Boitier', vers: 'Boîtier', occurrences: 1, couche: 'orthographe' },
  ]);
});

Deno.test(
  'orthographe : un terme déjà bien écrit ne produit aucune trace ; un mot qui le contient n’est pas touché',
  () => {
    const brut = 'La PTO et les PTOs, le PBO, à Le Lamentin.';
    const { texte, remplacements } = normaliserOrthographe(brut, TERMES);
    assertEquals(texte, brut);
    assertEquals(remplacements, []);
  },
);

Deno.test('orthographe : deux formes du même terme, comptées séparément', () => {
  const brut = 'pto, Pto, pto.';
  const { texte, remplacements } = normaliserOrthographe(brut, ['PTO']);
  assertEquals(texte, 'PTO, PTO, PTO.');
  assertEquals(
    remplacements.sort((a, b) => a.occurrences - b.occurrences),
    [
      { de: 'Pto', vers: 'PTO', occurrences: 1, couche: 'orthographe' },
      { de: 'pto', vers: 'PTO', occurrences: 2, couche: 'orthographe' },
    ],
  );
});

Deno.test('modèle : une proposition est appliquée dans son passage, et là seulement', () => {
  const texte = "J'ai pris une photo. La photo est posée au salon. Le client valide.";
  const { texte: apres, remplacements } = appliquerPropositions(
    texte,
    [{ contexte: 'La photo est posée au salon', de: 'photo', vers: 'PTO' }],
    TERMES,
  );
  assertEquals(apres, "J'ai pris une photo. La PTO est posée au salon. Le client valide.");
  assertEquals(remplacements, [
    {
      de: 'photo',
      vers: 'PTO',
      occurrences: 1,
      couche: 'modele',
      contexte: 'La photo est posée au salon',
    },
  ]);
});

Deno.test('modèle : tout ce qui n’est pas une correction vers un terme connu est jeté', () => {
  const texte = 'Le pébo est à 12 mètres, la photo est posée, demain on revient.';
  const { texte: apres, remplacements } = appliquerPropositions(
    texte,
    [
      { contexte: 'demain on revient', de: 'demain', vers: 'PTO' }, // trop loin : réécriture
      { contexte: 'à 12 mètres', de: '12', vers: 'PTO' }, // un nombre
      { contexte: 'la photo est posée', de: 'photo', vers: 'Prise Terminale' }, // pas un terme connu
      { contexte: 'un passage qui n’existe pas', de: 'photo', vers: 'PTO' }, // passage absent
      { contexte: 'la photo est posée', de: 'posée', vers: 'PBO' }, // distance 4 > 2 : trop loin
      { contexte: 'Le pébo est à 12 mètres', de: 'pébo', vers: 'PBO' }, // la seule bonne
    ],
    TERMES,
  );
  assertEquals(apres, 'Le PBO est à 12 mètres, la photo est posée, demain on revient.');
  assertEquals(
    remplacements.map((r) => r.de),
    ['pébo'],
  );
});

Deno.test('modèle : une réponse qui n’est pas le JSON attendu ne propose rien', () => {
  assertEquals(lirePropositions('Voici le texte corrigé : ...'), []);
  assertEquals(lirePropositions('{"remplacements": "tout"}'), []);
  assertEquals(lirePropositions('{"remplacements":[{"de":"x","vers":"PTO"}]}'), []); // sans contexte
  assertEquals(
    lirePropositions(
      'bla {"remplacements":[{"contexte":" la photo ","de":" photo","vers":"PTO "}]} bla',
    ),
    [{ contexte: 'la photo', de: 'photo', vers: 'PTO' }],
  );
});

Deno.test('distance : bornée sur clés normalisées, tolérance à la moitié du terme', () => {
  assertEquals(distance('photo', 'PTO'), 2);
  assertEquals(distance('Pébo', 'PBO'), 1);
  assertEquals(distance('posée', 'PBO'), 4);
  assertEquals(distanceToleree('PTO'), 2);
  assertEquals(distanceToleree('Caraïbe Télécom'), 8);
  assert(distance('demain', 'PTO') > distanceToleree('PTO'));
});

Deno.test('passe complète : la trace rejouée sur le brut redonne le texte', async () => {
  const brut = 'On est chez caraibe telecom. La photo est posée au salon. pto ok.';
  const proposer = (_prompt: string, texte: string) => {
    assert(texte.includes('Caraïbe Télécom')); // le modèle voit le texte déjà orthographié
    return Promise.resolve(
      '{"remplacements":[{"contexte":"La photo est posée au salon","de":"photo","vers":"PTO"}]}',
    );
  };
  const n = await normaliserTranscription({ brut, termes: TERMES, proposer });
  assert(n !== null);
  assertEquals(n.texte, 'On est chez Caraïbe Télécom. La PTO est posée au salon. PTO ok.');
  assertEquals(rejouer(brut, n.remplacements), n.texte);
  assertEquals(n.remplacements.length, 3);
});

Deno.test(
  'passe complète : sans modèle ou modèle en échec, l’orthographe seule ; sans terme, rien',
  async () => {
    const brut = 'La pto est posée.';
    const sans = await normaliserTranscription({ brut, termes: TERMES });
    assertEquals(sans, {
      texte: 'La PTO est posée.',
      remplacements: [{ de: 'pto', vers: 'PTO', occurrences: 1, couche: 'orthographe' }],
    });
    const echec = await normaliserTranscription({
      brut,
      termes: TERMES,
      proposer: () => Promise.reject(new Error('503')),
    });
    assertEquals(echec, sans);
    assertEquals(await normaliserTranscription({ brut, termes: [] }), {
      texte: brut,
      remplacements: [],
    });
  },
);

Deno.test(
  'passe complète : le modèle ne peut pas réécrire — une réponse en texte libre ne change rien',
  async () => {
    const brut = 'Le client dit que le boitier est cassé.';
    const n = await normaliserTranscription({
      brut,
      termes: TERMES,
      proposer: () => Promise.resolve('Le client indique que le boîtier est endommagé.'),
    });
    assert(n !== null);
    assertEquals(n.texte, 'Le client dit que le boîtier est cassé.');
    assertEquals(
      n.remplacements.map((r) => r.couche),
      ['orthographe'],
    );
  },
);

Deno.test('rejeu : une trace incohérente est refusée (null), le brut restera le texte', () => {
  // Une trace qui prétend un remplacement absent du brut ne redonne pas le texte attendu.
  assertEquals(
    rejouer('La pto est posée.', [
      { de: 'pbo', vers: 'PBO', occurrences: 1, couche: 'orthographe' },
    ]),
    'La pto est posée.',
  );
});
