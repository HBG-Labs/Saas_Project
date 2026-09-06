import assert from 'node:assert/strict';
import { createWorkerHandler, secretValide } from './handler.ts';
import { encryptSecret } from '../../../src/features/einvoicing/provider/superpdp-contract.ts';

const RACINE = 'https://worker.test';
const PARTENAIRE = 'https://api.superpdp.tech';
const SECRET = 'secret-ordonnanceur';
const ORGANISATION = '00000000-0000-4000-8000-0000000000o1';
// 32 octets, comme l'exige AES-GCM. Rien de sensible : ce banc est isole.
const CLE = btoa('0123456789abcdef0123456789abcdef');

const json = (valeur: unknown, status = 200) =>
  new Response(JSON.stringify(valeur), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const requete = (entetes: Record<string, string> = {}, methode = 'POST') =>
  new Request(`${RACINE}/functions/v1/superpdp-worker`, { method: methode, headers: entetes });

async function connexion() {
  const contexte = `${ORGANISATION}:superpdp`;
  return {
    organization_id: ORGANISATION,
    provider_code: 'superpdp',
    status: 'connected',
    access_token_ciphertext: await encryptSecret('jeton-acces', CLE, contexte),
    refresh_token_ciphertext: await encryptSecret('jeton-renouvellement', CLE, contexte),
    // Loin devant : le renouvellement ne doit pas se declencher.
    access_token_expires_at: '2099-01-01T00:00:00.000Z',
    token_type: 'Bearer',
  };
}

const transmission = (extra: Record<string, unknown> = {}) => ({
  id: '00000000-0000-4000-8000-0000000000t1',
  invoice_id: '00000000-0000-4000-8000-0000000000f1',
  organization_id: ORGANISATION,
  provider_code: 'superpdp',
  status: 'submitted',
  provider_submission_id: '448618',
  attempt_count: 1,
  ...extra,
});

/**
 * Banc isole : aucune permission n'est accordee a ces tests. Le transport
 * observe TOUT ce que l'ordonnanceur emet — et surtout ce qu'il n'emet pas.
 */
function banc(options: { transmissions?: Record<string, unknown>[]; connectee?: boolean } = {}) {
  const vu: string[] = [];
  const battements: Record<string, unknown>[] = [];

  const transport: typeof fetch = async (input, init) => {
    const req = new Request(input, init);
    const url = new URL(req.url);
    const filtre = url.searchParams.get('status') ?? '';
    vu.push(`${req.method} ${url.pathname}${filtre ? `?status=${filtre}` : ''}`);

    if (url.origin === PARTENAIRE) {
      if (url.pathname.startsWith('/v1.beta/invoices/')) return json({ id: 448618, events: [] });
      if (url.pathname === '/v1.beta/invoice_events') return json({ data: [], has_after: false });
      return json({});
    }
    if (url.pathname === '/rest/v1/einvoicing_provider_connections')
      return json(options.connectee === false ? [] : [await connexion()]);
    if (url.pathname === '/rest/v1/invoice_transmissions') {
      if (req.method !== 'GET') return json(transmission());
      // La file de synchronisation interroge `in.(submitted,delivered)`,
      // celle de reprise `eq.failed`. Seules les lignes correspondantes
      // doivent revenir : c'est ce que la base ferait.
      const lignes = options.transmissions ?? [];
      const attendus = filtre.startsWith('in.')
        ? filtre.slice(4, -1).split(',')
        : [filtre.replace('eq.', '')];
      return json(lignes.filter((l) => attendus.includes(String(l['status']))));
    }
    if (url.pathname === '/rest/v1/invoice_transmission_events') {
      // `syncEvents` relit les evenements deja connus pour reprendre le
      // curseur : c'est une collection. L'ecriture ne renvoie rien d'utile.
      if (req.method === 'GET') return json([]);
      return json({}, 201);
    }
    if (url.pathname === '/rest/v1/einvoicing_worker_runs') {
      battements.push(JSON.parse(await req.text()) as Record<string, unknown>);
      return json({}, 201);
    }
    throw new Error(`Appel inattendu : ${req.method} ${url.pathname}`);
  };

  const handler = createWorkerHandler({
    url: RACINE,
    serviceRoleKey: 'service-test',
    secret: SECRET,
    fetch: transport,
    superPdp: { clientId: 'id', clientSecret: 'secret', encryptionKey: CLE, fetch: transport },
  });
  return { handler, vu, battements, transport };
}

Deno.test('la comparaison de secret ne depend ni du contenu ni de la longueur', async () => {
  assert.equal(await secretValide(SECRET, SECRET), true);
  assert.equal(await secretValide('mauvais', SECRET), false);
  assert.equal(await secretValide('', SECRET), false);
  assert.equal(await secretValide(SECRET + 'x', SECRET), false);
});

Deno.test('sans secret valide, l’ordonnanceur ne fait rien', async () => {
  const { handler, vu } = banc();
  assert.equal((await handler(requete())).status, 401);
  assert.equal((await handler(requete({ 'x-worker-secret': 'mauvais' }))).status, 401);
  assert.equal(vu.length, 0, 'Un appel refuse ne doit toucher ni la base ni le partenaire');
});

Deno.test('un secret non configure ferme la porte au lieu de l’ouvrir', async () => {
  const handler = createWorkerHandler({ url: RACINE, serviceRoleKey: 'k', secret: '' });
  assert.equal((await handler(requete({ 'x-worker-secret': '' }))).status, 401);
  assert.equal((await handler(requete({ 'x-worker-secret': 'peu importe' }))).status, 401);
});

Deno.test('seule la methode POST est acceptee', async () => {
  const { handler } = banc();
  assert.equal((await handler(requete({ 'x-worker-secret': SECRET }, 'GET'))).status, 405);
});

Deno.test('une transmission deposee est synchronisee, et le passage est trace', async () => {
  const { handler, vu, battements, transport } = banc({ transmissions: [transmission()] });
  // Les appels partenaire passent par le `fetch` global, pas par le client
  // Supabase : on le detourne le temps du test. Aucun octet ne sort pour
  // autant, et Deno le confirme en refusant toute permission reseau.
  const original = globalThis.fetch;
  globalThis.fetch = transport;
  let reponse: Response;
  try {
    reponse = await handler(requete({ 'x-worker-secret': SECRET }));
  } finally {
    globalThis.fetch = original;
  }
  assert.equal(reponse.status, 200);
  const bilan = (await reponse.json()) as Record<string, number>;
  assert.equal(bilan['organisations'], 1);
  assert.equal(bilan['synchronisees'], 1);
  assert.equal(bilan['reprises'], 0);
  assert.ok(
    vu.some((appel) => appel.startsWith('GET /v1.beta/invoices/')),
    'La synchronisation doit interroger le partenaire',
  );
  assert.equal(battements.length, 1, 'Chaque execution laisse un battement de coeur');
  assert.equal(battements[0]!['synchronized'], 1);
});

/*
  LE TEST QUI COMPTE.

  La decision produit est qu'une facture ne part JAMAIS sans geste humain. Une
  transmission `queued` n'a pas d'echeance, donc l'ordonnanceur ne doit meme pas
  la voir. Si un jour quelqu'un elargit une des deux requetes, ce test tombe.
*/
Deno.test('une transmission en attente n’est jamais deposee d’office', async () => {
  const { handler, vu } = banc({
    transmissions: [
      transmission({ status: 'queued', provider_submission_id: null, attempt_count: 0 }),
    ],
  });
  const bilan = (await (await handler(requete({ 'x-worker-secret': SECRET }))).json()) as Record<
    string,
    number
  >;
  assert.equal(bilan['reprises'], 0);
  assert.equal(bilan['synchronisees'], 0);
  assert.equal(
    vu.filter((appel) => appel === 'POST /v1.beta/invoices').length,
    0,
    'Aucun depot ne doit partir de l’initiative de l’ordonnanceur',
  );
});

Deno.test('sans organisation raccordee, rien n’est tente', async () => {
  const { handler, battements } = banc({ connectee: false });
  const bilan = (await (await handler(requete({ 'x-worker-secret': SECRET }))).json()) as Record<
    string,
    number
  >;
  assert.equal(bilan['organisations'], 0);
  assert.equal(battements.length, 1, 'Le battement de coeur doit avoir lieu meme sans travail');
});
