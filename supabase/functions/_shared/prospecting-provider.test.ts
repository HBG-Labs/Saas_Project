import { assertEquals, assertRejects } from 'jsr:@std/assert@1';

import { createRechercheEntreprisesProvider, departmentFromPostalCode } from './prospecting-provider.ts';

Deno.test('departmentFromPostalCode : DOM/TOM sur 3 chiffres, métropole sur 2', () => {
  assertEquals(departmentFromPostalCode('97200'), '972');
  assertEquals(departmentFromPostalCode('13015'), '13');
  assertEquals(departmentFromPostalCode(null), null);
  assertEquals(departmentFromPostalCode(''), null);
});

function apiResponse(results: unknown[], totalResults = results.length) {
  return new Response(JSON.stringify({ results, total_results: totalResults }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.test("le provider interroge recherche-entreprises.api.gouv.fr avec département et code NAF", async () => {
  let requestedUrl = '';
  const fakeFetch: typeof fetch = (input) => {
    requestedUrl = String(input);
    return Promise.resolve(apiResponse([]));
  };

  const provider = createRechercheEntreprisesProvider(fakeFetch);
  await provider.search({ departmentCode: '972', apeCode: '43.22A', perPage: 5 });

  assertEquals(requestedUrl.includes('departement=972'), true);
  assertEquals(requestedUrl.includes('activite_principale=43.22A'), true);
  assertEquals(requestedUrl.includes('per_page=5'), true);
});

Deno.test("une entreprise sans établissement dans le département cible retombe sur le siège", async () => {
  const fakeFetch: typeof fetch = () =>
    Promise.resolve(
      apiResponse([
        {
          siren: '330781279',
          nom_raison_sociale: 'REALISATIONS MEDICALES ET INDUSTRIELLES',
          activite_principale: '43.22A',
          nature_juridique: '5499',
          date_creation: '1984-06-18',
          etat_administratif: 'A',
          tranche_effectif_salarie: '21',
          siege: {
            siret: '33078127900022',
            est_siege: true,
            code_postal: '13015',
            libelle_commune: 'MARSEILLE',
            departement: '13',
            region: '93',
          },
          matching_etablissements: [
            {
              siret: '33078127900048',
              est_siege: false,
              code_postal: '97232',
              libelle_commune: 'LE LAMENTIN',
              departement: '972',
              region: '02',
            },
          ],
        },
      ]),
    );

  const provider = createRechercheEntreprisesProvider(fakeFetch);
  const { results } = await provider.search({ departmentCode: '972', apeCode: '43.22A', perPage: 5 });

  assertEquals(results.length, 1);
  assertEquals(results[0].siren, '330781279');
  // L'établissement retenu est celui DANS la zone ciblée, pas le siège.
  assertEquals(results[0].establishment?.siret, '33078127900048');
  assertEquals(results[0].establishment?.isHeadquarters, false);
  assertEquals(results[0].departement, '972');
});

Deno.test('etat_administratif « F » (fermé/cessé) est traduit en statut « cesse »', async () => {
  const fakeFetch: typeof fetch = () =>
    Promise.resolve(
      apiResponse([
        {
          siren: '111111111',
          nom_raison_sociale: 'ENTREPRISE FERMEE',
          activite_principale: '43.22A',
          etat_administratif: 'F',
          siege: { siret: '11111111100010', est_siege: true, code_postal: '97200', departement: '972' },
        },
      ]),
    );

  const provider = createRechercheEntreprisesProvider(fakeFetch);
  const { results } = await provider.search({ departmentCode: '972', apeCode: '43.22A', perPage: 5 });

  assertEquals(results[0].statutAdministratif, 'cesse');
});

Deno.test('une entreprise sans SIREN, sans code NAF ou sans raison sociale est ignorée plutôt que remontée incomplète', async () => {
  const fakeFetch: typeof fetch = () =>
    Promise.resolve(
      apiResponse([
        { siren: '222222222', nom_raison_sociale: null, activite_principale: '43.22A' },
        { siren: '333333333', nom_raison_sociale: 'OK', activite_principale: null },
      ]),
    );

  const provider = createRechercheEntreprisesProvider(fakeFetch);
  const { results } = await provider.search({ departmentCode: '972', apeCode: '43.22A', perPage: 5 });

  assertEquals(results.length, 0);
});

Deno.test("une entreprise en opposition à la diffusion (statut_diffusion « P ») est exclue, jamais remontée", async () => {
  const fakeFetch: typeof fetch = () =>
    Promise.resolve(
      apiResponse([
        {
          siren: '444444444',
          nom_raison_sociale: 'ENTREPRISE OPPOSEE',
          activite_principale: '43.22A',
          etat_administratif: 'A',
          statut_diffusion: 'P',
          siege: { siret: '44444444400010', est_siege: true, code_postal: '97200', departement: '972' },
        },
        {
          siren: '555555555',
          nom_raison_sociale: 'ENTREPRISE DIFFUSIBLE',
          activite_principale: '43.22A',
          etat_administratif: 'A',
          statut_diffusion: 'O',
          siege: { siret: '55555555500010', est_siege: true, code_postal: '97200', departement: '972' },
        },
      ]),
    );

  const provider = createRechercheEntreprisesProvider(fakeFetch);
  const { results } = await provider.search({ departmentCode: '972', apeCode: '43.22A', perPage: 5 });

  assertEquals(results.length, 1);
  assertEquals(results[0].siren, '555555555');
});

Deno.test("un établissement en opposition à la diffusion est exclu même si l'unité légale est diffusible", async () => {
  const fakeFetch: typeof fetch = () =>
    Promise.resolve(
      apiResponse([
        {
          siren: '666666666',
          nom_raison_sociale: 'ETABLISSEMENT OPPOSE',
          activite_principale: '43.22A',
          etat_administratif: 'A',
          statut_diffusion: 'O',
          siege: {
            siret: '66666666600010',
            est_siege: true,
            code_postal: '97200',
            departement: '972',
            statut_diffusion_etablissement: 'P',
          },
        },
      ]),
    );

  const provider = createRechercheEntreprisesProvider(fakeFetch);
  const { results } = await provider.search({ departmentCode: '972', apeCode: '43.22A', perPage: 5 });

  assertEquals(results.length, 0);
});

Deno.test('sans statut_diffusion (absent), l’entreprise est traitée comme diffusible — « O » est le défaut', async () => {
  const fakeFetch: typeof fetch = () =>
    Promise.resolve(
      apiResponse([
        {
          siren: '777777777',
          nom_raison_sociale: 'ENTREPRISE SANS CHAMP',
          activite_principale: '43.22A',
          etat_administratif: 'A',
          siege: { siret: '77777777700010', est_siege: true, code_postal: '97200', departement: '972' },
        },
      ]),
    );

  const provider = createRechercheEntreprisesProvider(fakeFetch);
  const { results } = await provider.search({ departmentCode: '972', apeCode: '43.22A', perPage: 5 });

  assertEquals(results.length, 1);
});

Deno.test('une réponse HTTP en erreur lève une exception explicite', async () => {
  const fakeFetch: typeof fetch = () => Promise.resolve(new Response('boom', { status: 500 }));
  const provider = createRechercheEntreprisesProvider(fakeFetch);

  await assertRejects(
    () => provider.search({ departmentCode: '972', apeCode: '43.22A', perPage: 5 }),
    Error,
    'HTTP 500',
  );
});
