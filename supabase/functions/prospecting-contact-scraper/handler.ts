import {
  CONTACT_SCRAPER_USER_AGENT,
  extractContacts,
  isAllowedByRobotsTxt,
  isFetchableWebsiteUrl,
} from '../_shared/contact-scraper.ts';

/**
 * Recherche de coordonnées sur le site officiel d'un prospect (Phase 14).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PORTÉE DÉLIBÉRÉMENT ÉTROITE — voir `_shared/contact-scraper.ts` pour le
 * détail des garanties (robots.txt, user-agent honnête, minimisation).
 *
 * QUI DÉCIDE DE QUOI (même patron que `portal-message-send`) : `caller` porte
 * le jeton de l'appelant — la lecture du site déjà renseigné exige
 * `prospecting.view`, l'écriture des coordonnées trouvées exige
 * `prospecting.manage`, TOUJOURS par la RLS. Cette fonction ne fait
 * qu'ajouter ce que le navigateur ne peut pas faire lui-même : un fetch
 * cross-origin vers un site tiers (bloqué par CORS depuis le navigateur).
 *
 * PROTECTION SSRF : l'URL vient d'une saisie humaine (fiche prospect, Phase
 * 11) — jamais générée automatiquement — mais reste une entrée non fiable
 * une fois stockée. `resolveIsPublic` doit résoudre le DNS réel et refuser
 * toute IP privée/loopback/lien-local AVANT le premier fetch, pas seulement
 * filtrer la chaîne de caractères (une attaque par « DNS rebinding » ferait
 * pointer un nom de domaine public vers une IP interne).
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface InsertedContact {
  id: string;
  contact_type: string;
  value: string;
}

export interface CallerStore {
  /** Site officiel déjà renseigné (saisie manuelle, Phase 11) — RLS `prospecting.view`. */
  getWebsite(siren: string): Promise<string | null>;
  /** RLS `prospecting.manage` : `{ error }` si l'appelant n'a pas ce droit. */
  insertContacts(
    siren: string,
    contacts: Array<{ contactType: 'email' | 'phone'; value: string }>,
  ): Promise<InsertedContact[] | { error: string }>;
}

export interface PageFetchResult {
  ok: boolean;
  status: number;
  text: string;
}

export interface ContactScraperConfig {
  caller: CallerStore;
  fetchPage: (url: string) => Promise<PageFetchResult>;
  /** Résolution DNS réelle + vérification d'IP privée (protection SSRF). */
  resolveIsPublic: (hostname: string) => Promise<boolean>;
}

const SIREN_FORMAT = /^\d{9}$/;
const MAX_HTML_LENGTH = 500_000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export function createContactScraperHandler(config: ContactScraperConfig) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);

    let body: { siren?: string };
    try {
      body = (await request.json()) as { siren?: string };
    } catch {
      return json({ error: 'Corps JSON invalide.' }, 400);
    }

    const siren = body.siren;
    if (typeof siren !== 'string' || !SIREN_FORMAT.test(siren)) {
      return json({ error: 'SIREN invalide.' }, 400);
    }

    const website = await config.caller.getWebsite(siren);
    if (website === null) {
      return json(
        { error: 'Aucun site officiel renseigné pour ce prospect — ajoutez-le dans « Coordonnées » avant de lancer la recherche.' },
        400,
      );
    }

    if (!isFetchableWebsiteUrl(website)) {
      return json({ error: 'L’adresse renseignée n’est pas un site web exploitable.' }, 400);
    }

    const url = new URL(website);
    const isPublic = await config.resolveIsPublic(url.hostname);
    if (!isPublic) {
      return json({ error: 'Cette adresse ne peut pas être interrogée.' }, 400);
    }

    // robots.txt : absent ou illisible = autorisé par défaut (convention de facto).
    const robots = await config.fetchPage(`${url.origin}/robots.txt`);
    if (robots.ok && !isAllowedByRobotsTxt(robots.text, url.pathname || '/')) {
      return json({ error: 'Le fichier robots.txt de ce site interdit la lecture de cette page.' }, 403);
    }

    const page = await config.fetchPage(url.toString());
    if (!page.ok) {
      return json({ error: 'Impossible de lire le site officiel pour l’instant.' }, 502);
    }

    const { emails, phones } = extractContacts(page.text.slice(0, MAX_HTML_LENGTH));
    if (emails.length === 0 && phones.length === 0) {
      return json({ found: [], message: 'Aucune coordonnée trouvée sur cette page.' });
    }

    const inserted = await config.caller.insertContacts(siren, [
      ...emails.map((value) => ({ contactType: 'email' as const, value })),
      ...phones.map((value) => ({ contactType: 'phone' as const, value })),
    ]);
    if ('error' in inserted) return json({ error: inserted.error }, 403);

    return json({ found: inserted });
  };
}

export { CONTACT_SCRAPER_USER_AGENT };
