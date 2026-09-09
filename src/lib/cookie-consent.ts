/**
 * Consentement aux cookies — stockage et notifications.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE MODULE CONDITIONNE DÉSORMAIS QUELQUE CHOSE DE RÉEL
 *
 * Il a longtemps existé par anticipation, sans rien gouverner. Ce n'est plus le
 * cas depuis l'ajout du pixel Meta : `hasMarketingConsent()` décide maintenant
 * si `src/lib/meta-pixel.ts` charge — ou non — un script tiers.
 *
 * Deux conséquences pour qui modifie ce fichier :
 *
 *   • `subscribeCookieConsent` n'est plus décoratif. Le pixel s'y abonne pour
 *     partir dès l'acceptation, sans attendre la navigation suivante. Cesser
 *     de notifier les abonnés ferait silencieusement perdre les visiteurs qui
 *     acceptent la bannière après leur arrivée.
 *
 *   • `hasMarketingConsent()` doit rester FERMÉ PAR DÉFAUT. Il répond `false`
 *     quand rien n'est stocké, quand le stockage est inaccessible, et quand le
 *     contenu est illisible. Un défaut ouvert déposerait un traceur sans
 *     consentement — exactement ce que l'article 82 interdit.
 *
 * La mesure d'audience, elle, reste sans outil branché : `hasAnalyticsConsent()`
 * ne gouverne encore rien. Voir `config/legal.ts` → `TRACEURS_TIERS`, qui est
 * la déclaration faisant foi, et la page /cookies qui la publie.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface CookieConsent {
  analytics: boolean;
  marketing: boolean;
  decidedAt: string;
}

const STORAGE_KEY = 'rezo360_cookie_consent';

const consentListeners = new Set<() => void>();
const preferencesRequestListeners = new Set<() => void>();

export function getCookieConsent(): CookieConsent | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CookieConsent) : null;
  } catch {
    return null;
  }
}

function persistCookieConsent(consent: CookieConsent) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
  } catch {
    // Stockage inaccessible : le choix ne sera pas mémorisé, sans bloquer l'usage du site.
  }
  consentListeners.forEach((fn) => fn());
}

export function acceptAllCookies() {
  persistCookieConsent({ analytics: true, marketing: true, decidedAt: new Date().toISOString() });
}

export function refuseAllCookies() {
  persistCookieConsent({ analytics: false, marketing: false, decidedAt: new Date().toISOString() });
}

export function setCookiePreferences(prefs: { analytics: boolean; marketing: boolean }) {
  persistCookieConsent({ ...prefs, decidedAt: new Date().toISOString() });
}

export function subscribeCookieConsent(fn: () => void): () => void {
  consentListeners.add(fn);
  return () => consentListeners.delete(fn);
}

/** Rouvre le sélecteur de préférences — depuis le pied de page ou /cookies. */
export function requestCookiePreferences() {
  preferencesRequestListeners.forEach((fn) => fn());
}

export function subscribeCookiePreferencesRequest(fn: () => void): () => void {
  preferencesRequestListeners.add(fn);
  return () => preferencesRequestListeners.delete(fn);
}

/** Prêt pour le jour où un outil de mesure d'audience est ajouté. */
export function hasAnalyticsConsent(): boolean {
  return getCookieConsent()?.analytics ?? false;
}

/**
 * Gouverne le chargement du pixel Meta. Fermé par défaut — voir l'en-tête.
 *
 * `?? false` n'est pas une commodité d'écriture : c'est la garantie qu'un
 * stockage vide, inaccessible ou corrompu se traduit par un refus, jamais par
 * une acceptation implicite.
 */
export function hasMarketingConsent(): boolean {
  return getCookieConsent()?.marketing ?? false;
}
