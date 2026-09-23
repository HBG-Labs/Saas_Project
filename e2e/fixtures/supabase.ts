import type { Page, Route } from '@playwright/test';

import { donneesPour, ORGANISATION_ID, PROFILS, type DonneesTest, type RoleTest } from './donnees';
import { E2E_CLE_SESSION, E2E_SUPABASE_URL } from './environnement';

/**
 * Faux Supabase pour les parcours E2E.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI UN FAUX, ET PAS UNE VRAIE BASE
 *
 * La CI pointe déjà vers une URL factice (`test-project.supabase.co`) : aucun
 * appel ne sort. Ce module remplace les réponses au lieu de les laisser
 * échouer, ce qui rend les écrans authentifiés testables SANS identifiant de
 * production dans les secrets CI, et sans qu'une exécution puisse écrire quoi
 * que ce soit quelque part.
 *
 * CE QU'IL NE PROUVE PAS : ni une policy RLS, ni un trigger, ni une contrainte.
 * Ces garanties vivent dans PostgreSQL et sont vérifiées par `npm run test:sql`
 * et par les tests Deno. Un parcours vert ici prouve que l'INTERFACE tient.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const ORIGINE = E2E_SUPABASE_URL;
const CLE_SESSION = E2E_CLE_SESSION;

function json(route: Route, corps: unknown, entetes: Record<string, string> = {}, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers: entetes,
    body: JSON.stringify(corps),
  });
}

type Ligne = Record<string, unknown>;

/**
 * Représentation textuelle d'une valeur de colonne.
 *
 * PostgREST compare des scalaires. Une relation imbriquée (objet, tableau) n'a
 * pas de comparaison textuelle sensée : la réduire à `[object Object]` ferait
 * correspondre n'importe quel filtre à n'importe quel objet — un faux vert de
 * plus. Elle rend donc une chaîne vide, qui ne correspond à rien.
 */
function texte(valeur: unknown): string {
  if (valeur === null || valeur === undefined) return '';
  if (typeof valeur === 'object') return '';
  if (typeof valeur === 'string') return valeur;
  if (typeof valeur === 'number' || typeof valeur === 'boolean') return String(valeur);
  return '';
}

/**
 * Applique les filtres PostgREST que l'application utilise réellement.
 *
 * Volontairement partiel : `eq`, `in`, `is`, `neq`, `gte`, `lte`, `ilike`, `or`
 * couvrent tout ce que les requêtes de REZO360 posent aujourd'hui. Un filtre
 * inconnu est IGNORÉ plutôt que deviné — et le test qui en dépend échouera
 * visiblement, ce qui vaut mieux qu'un filtre approximatif appliqué en silence.
 */
function filtre(lignes: Ligne[], parametres: URLSearchParams): Ligne[] {
  const reserves = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);
  let resultat = [...lignes];

  for (const [colonne, brut] of parametres.entries()) {
    if (reserves.has(colonne)) continue;

    if (colonne === 'or') {
      // `or=(a.ilike.%x%,b.ilike.%x%)` — on garde la ligne si UNE clause passe.
      const clauses = brut.replace(/^\(|\)$/g, '').split(',');
      resultat = resultat.filter((ligne) =>
        clauses.some((clause) => {
          const [col, operateur, ...reste] = clause.split('.');
          return col ? correspond(ligne[col], `${operateur}.${reste.join('.')}`) : false;
        }),
      );
      continue;
    }

    resultat = resultat.filter((ligne) => correspond(ligne[colonne], brut));
  }

  return resultat;
}

function correspond(valeur: unknown, expression: string): boolean {
  const separateur = expression.indexOf('.');
  const operateur = expression.slice(0, separateur);
  const attendu = expression.slice(separateur + 1);

  switch (operateur) {
    case 'eq':
      return texte(valeur) === attendu;
    case 'neq':
      return texte(valeur) !== attendu;
    case 'is':
      return attendu === 'null'
        ? valeur === null || valeur === undefined
        : texte(valeur) === attendu;
    case 'in':
      return attendu
        .replace(/^\(|\)$/g, '')
        .split(',')
        .map((item) => item.replace(/^"|"$/g, ''))
        .includes(texte(valeur));
    case 'gte':
      return texte(valeur) >= attendu;
    case 'lte':
      return texte(valeur) <= attendu;
    case 'gt':
      return texte(valeur) > attendu;
    case 'lt':
      return texte(valeur) < attendu;
    case 'not':
      return !correspond(valeur, attendu);
    case 'ilike':
      return texte(valeur).toLowerCase().includes(attendu.replace(/%/g, '').toLowerCase());
    default:
      return true;
  }
}

function trie(lignes: Ligne[], ordre: string | null): Ligne[] {
  if (!ordre) return lignes;
  const [colonne, sens] = ordre.split('.');
  if (!colonne) return lignes;
  const descendant = sens?.startsWith('desc') ?? false;
  return [...lignes].sort((a, b) => {
    const gauche = texte(a[colonne]);
    const droite = texte(b[colonne]);
    return descendant ? droite.localeCompare(gauche) : gauche.localeCompare(droite);
  });
}

/**
 * Fonctions serveur appelées au démarrage, que l'ossature attend pour se monter.
 *
 * `organization_plan_code` en particulier : sans elle, l'entitlement retombe
 * sur « Gratuit » et la moitié de la navigation s'affiche cadenassée — ce qui
 * ferait échouer les parcours pour une raison qui n'a rien à voir avec eux.
 */
const RPC_PAR_DEFAUT: Record<string, unknown> = {
  organization_plan_code: 'enterprise',
  can_manage_einvoicing_connection: true,
  can_transmit_invoice: false,
};

export interface OptionsSupabase {
  role?: RoleTest;
  /** Remplace ou complète le jeu de référence, table par table. */
  donnees?: Partial<DonneesTest>;
  /** Réponses des `rpc(...)`, par nom de fonction. */
  rpc?: Record<string, unknown>;
  /** Tables dont toute lecture doit échouer — pour éprouver les états d'erreur. */
  enErreur?: string[];
}

/**
 * Installe le faux Supabase ET la session, puis rend l'application prête.
 *
 * La session est posée dans `localStorage` avant le premier rendu plutôt que
 * jouée via le formulaire : un parcours qui teste le planning n'a pas à
 * dépendre de l'écran de connexion. Le parcours de connexion, lui, a son
 * propre test.
 */
export async function installeSupabase(page: Page, options: OptionsSupabase = {}) {
  const role = options.role ?? 'owner';
  const profil = PROFILS[role];
  const tables: Record<string, Ligne[]> = {
    ...(donneesPour(role) as unknown as Record<string, Ligne[]>),
    ...((options.donnees ?? {}) as Record<string, Ligne[]>),
  };
  const enErreur = new Set(options.enErreur ?? []);
  const appels: string[] = [];

  const session = {
    access_token: 'jeton-de-test',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'renouvellement-de-test',
    user: {
      id: profil.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: profil.email,
      user_metadata: { display_name: profil.nom },
      app_metadata: { provider: 'email', providers: ['email'] },
      created_at: '2026-09-01T00:00:00.000Z',
      // Sans ces deux champs, l'application affiche le bandeau « confirmez
      // votre adresse » et referme une partie de l'interface : le parcours
      // échouerait pour une raison étrangère à ce qu'il teste.
      email_confirmed_at: '2026-09-01T00:00:00.000Z',
      confirmed_at: '2026-09-01T00:00:00.000Z',
    },
  };

  await page.addInitScript(
    (graine: { cle: string; session: string; organisation: string; utilisateur: string }) => {
      window.localStorage.setItem(graine.cle, graine.session);
      window.localStorage.setItem(
        `rezo360_current_organization:${graine.utilisateur}`,
        graine.organisation,
      );
      // Les parcours applicatifs ne testent pas le bandeau légal : on garde
      // un refus explicite, sans activer aucun traceur, afin qu'il n'intercepte
      // jamais les actions situées en bas d'écran.
      window.localStorage.setItem(
        'rezo360_cookie_consent',
        JSON.stringify({
          analytics: false,
          marketing: false,
          decidedAt: '2026-09-01T00:00:00.000Z',
        }),
      );
    },
    {
      cle: CLE_SESSION,
      session: JSON.stringify(session),
      organisation: ORGANISATION_ID,
      utilisateur: profil.id,
    },
  );

  await page.route(`${ORIGINE}/**`, async (route) => {
    const requete = route.request();
    const url = new URL(requete.url());
    const chemin = url.pathname;
    appels.push(`${requete.method()} ${chemin}`);

    if (chemin.startsWith('/auth/v1/')) {
      if (chemin.includes('logout')) return route.fulfill({ status: 204, body: '' });
      if (chemin.includes('/user')) return json(route, session.user);
      return json(route, session);
    }

    if (chemin.startsWith('/rest/v1/rpc/')) {
      const nom = chemin.slice('/rest/v1/rpc/'.length);
      if (options.rpc && nom in options.rpc) return json(route, options.rpc[nom]);
      return json(route, RPC_PAR_DEFAUT[nom] ?? null);
    }

    if (chemin.startsWith('/rest/v1/')) {
      const table = chemin.slice('/rest/v1/'.length);

      if (enErreur.has(table))
        return json(route, { message: `Lecture refusée sur ${table}`, code: 'PGRST301' }, {}, 403);

      if (requete.method() !== 'GET') {
        // Une écriture renvoie ce qu'elle prétend avoir écrit : les parcours
        // vérifient la réaction de l'interface, pas la persistance.
        const corps: unknown = requete.postDataJSON?.() ?? {};
        const ecrit: Ligne = Array.isArray(corps) ? ((corps[0] ?? {}) as Ligne) : (corps as Ligne);
        const existant =
          requete.method() === 'PATCH'
            ? (filtre(tables[table] ?? [], url.searchParams)[0] ?? {})
            : {};
        const enregistrement = { id: crypto.randomUUID(), ...existant, ...ecrit };
        const objetSeul = (requete.headers()['accept'] ?? '').includes('vnd.pgrst.object+json');
        return json(route, objetSeul ? enregistrement : [enregistrement], {}, 201);
      }

      const lignes = trie(
        filtre(tables[table] ?? [], url.searchParams),
        url.searchParams.get('order'),
      );
      const limite = url.searchParams.get('limit');
      const page0 = limite ? lignes.slice(0, Number(limite)) : lignes;

      const objetSeul = (requete.headers()['accept'] ?? '').includes('vnd.pgrst.object+json');
      if (objetSeul) {
        if (page0.length === 0)
          return json(
            route,
            { message: 'Aucune ligne', code: 'PGRST116', details: null, hint: null },
            {},
            406,
          );
        return json(route, page0[0]);
      }

      return json(route, page0, {
        'Content-Range': `0-${Math.max(page0.length - 1, 0)}/${lignes.length}`,
      });
    }

    if (chemin.startsWith('/storage/v1/'))
      return json(route, { signedUrl: `${ORIGINE}/faux-fichier` });
    if (chemin.startsWith('/functions/v1/')) return json(route, {});

    return json(route, {});
  });

  return {
    /** Ce que l'application a réellement demandé — utile pour prouver une absence d'appel. */
    appels,
  };
}
