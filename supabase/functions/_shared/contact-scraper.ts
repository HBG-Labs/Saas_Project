/**
 * Extraction de coordonnées PUBLIQUES sur le site officiel d'un prospect
 * (Phase 14, sur validation explicite du 25/09/2026 — revient sur
 * l'interdiction de scraper posée en Phase 2/11, mais SEULEMENT pour cette
 * cible précise : jamais un annuaire tiers, jamais un moteur de recherche,
 * jamais un réseau social. Voir `README-PROSPECT-RADAR.md` § RGPD pour la
 * justification complète.
 *
 * PORTÉE VOLONTAIREMENT ÉTROITE (mesures CNIL, fiche « intérêt légitime et
 * moissonnage », 19/06/2025) :
 *   - une seule page (celle que l'administrateur a renseignée), jamais un
 *     crawl du site ;
 *   - robots.txt respecté avant toute lecture ;
 *   - user-agent honnête, qui identifie le robot ;
 *   - extraction MINIMALE : quelques coordonnées génériques (email/téléphone
 *     d'entreprise), jamais un nom de personne, jamais le contenu de la page ;
 *   - la source (`site_officiel`) reste toujours distincte d'une saisie
 *     manuelle — jamais confondue dans l'affichage ni dans les données.
 */

export const CONTACT_SCRAPER_USER_AGENT =
  'REZO360-ProspectBot/1.0 (+prospection B2B interne ; voir la fiche du prospect pour contexte)';

const PRIVATE_IPV4_RANGES: Array<[number, number]> = [
  [ipv4ToInt('10.0.0.0'), ipv4ToInt('10.255.255.255')],
  [ipv4ToInt('172.16.0.0'), ipv4ToInt('172.31.255.255')],
  [ipv4ToInt('192.168.0.0'), ipv4ToInt('192.168.255.255')],
  [ipv4ToInt('127.0.0.0'), ipv4ToInt('127.255.255.255')],
  [ipv4ToInt('169.254.0.0'), ipv4ToInt('169.254.255.255')],
  [ipv4ToInt('0.0.0.0'), ipv4ToInt('0.255.255.255')],
];

function ipv4ToInt(ip: string): number {
  const parts = ip.split('.').map(Number);
  return ((parts[0]! << 24) >>> 0) + (parts[1]! << 16) + (parts[2]! << 8) + parts[3]!;
}

/** Vrai si l'IPv4 appartient à une plage privée/loopback/link-local (protection SSRF). */
export function isPrivateIpv4(ip: string): boolean {
  if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) return false;
  const value = ipv4ToInt(ip);
  return PRIVATE_IPV4_RANGES.some(([min, max]) => value >= min && value <= max);
}

/** Vrai si l'IPv6 est loopback (`::1`) ou dans une plage privée/link-local (`fc00::/7`, `fe80::/10`). */
export function isPrivateIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::1') return true;
  const firstGroup = lower.split(':')[0] ?? '';
  if (firstGroup.length >= 2) {
    const firstByte = Number.parseInt(firstGroup.slice(0, 2), 16);
    if (!Number.isNaN(firstByte) && firstByte >= 0xfc && firstByte <= 0xfd) return true; // fc00::/7
  }
  return lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb'); // fe80::/10
}

/**
 * Ne garde que http(s), rejette tout ce qui n'est manifestement pas une URL
 * de site web publique — la résolution DNS (protection SSRF complète) se
 * fait séparément, côté appelant, avec `Deno.resolveDns`.
 */
export function isFetchableWebsiteUrl(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  const hostname = parsed.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) return false;
  if (isPrivateIpv4(hostname) || isPrivateIpv6(hostname)) return false;
  return true;
}

/**
 * Parseur `robots.txt` minimal : ne traite que le groupe `User-agent: *`
 * (aucun site ne connaît notre robot par son nom) et les directives
 * `Disallow`/`Allow`. Priorité au préfixe le plus long, comme la
 * convention de facto (Google, RFC 9309 §2.2.2).
 */
export function isAllowedByRobotsTxt(robotsTxt: string, path: string): boolean {
  const lines = robotsTxt.split(/\r?\n/).map((line) => line.replace(/#.*$/, '').trim());

  let inWildcardGroup = false;
  let matched = false;
  let longestMatch = -1;
  let allowed = true;

  for (const line of lines) {
    if (line === '') continue;
    const [rawKey, ...rest] = line.split(':');
    const key = rawKey?.trim().toLowerCase();
    const value = rest.join(':').trim();
    if (key === 'user-agent') {
      inWildcardGroup = value === '*';
      continue;
    }
    if (!inWildcardGroup) continue;

    if (key === 'disallow' && value !== '') {
      if (path.startsWith(value) && value.length > longestMatch) {
        longestMatch = value.length;
        allowed = false;
        matched = true;
      }
    } else if (key === 'allow' && value !== '') {
      if (path.startsWith(value) && value.length > longestMatch) {
        longestMatch = value.length;
        allowed = true;
        matched = true;
      }
    }
  }

  return !matched || allowed;
}

const MAILTO_RE = /mailto:([^"'?\s>]+)/gi;
const EMAIL_RE = /[a-zA-Z0-9][a-zA-Z0-9._%+-]*@[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}/g;
const FRENCH_PHONE_RE = /(?:\+33|0)\s?[1-9](?:[\s.-]?\d{2}){4}/g;

/** Domaines jamais retenus : traceurs/plateformes, jamais un vrai contact de l'entreprise. */
const EMAIL_DOMAIN_DENYLIST = new Set([
  'example.com',
  'sentry.io',
  'wixpress.com',
  'wix.com',
  'godaddy.com',
  'domain.com',
  'yourdomain.com',
  'schema.org',
]);

function isUsableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain || EMAIL_DOMAIN_DENYLIST.has(domain)) return false;
  if (/\.(png|jpe?g|gif|svg|webp|css|js)$/i.test(email)) return false;
  return true;
}

/**
 * Extraction MINIMALE : au plus 2 e-mails et 2 téléphones génériques,
 * jamais un nom de personne (aucun champ ne le permettrait de toute façon —
 * `prospect_contacts.contact_type` est limité à email/phone/website).
 * Les `mailto:` valent plus qu'un simple motif trouvé dans le texte : un
 * lien explicite « nous contacter » est un signal bien plus fiable qu'une
 * adresse qui traîne dans une balise `<script>` de tracking.
 */
export function extractContacts(html: string): { emails: string[]; phones: string[] } {
  const mailtoEmails = [...html.matchAll(MAILTO_RE)].map((m) => decodeURIComponent(m[1]!.split('?')[0]!));
  const looseEmails = [...html.matchAll(EMAIL_RE)].map((m) => m[0]);

  const emails = [...new Set([...mailtoEmails, ...looseEmails].map((e) => e.toLowerCase()))]
    .filter(isUsableEmail)
    .slice(0, 2);

  const phones = [...new Set([...html.matchAll(FRENCH_PHONE_RE)].map((m) => m[0].replace(/[\s.-]/g, ' ').trim()))].slice(0, 2);

  return { emails, phones };
}
