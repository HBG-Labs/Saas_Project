/**
 * Consentement aux cookies — stockage et notifications.
 *
 * AUCUN OUTIL DE MESURE OU PUBLICITAIRE N'EXISTE AUJOURD'HUI (voir
 * `config/legal.ts` → `DEPOTS_LOCAUX` et la page /cookies) : ce module ne
 * conditionne rien de réel pour l'instant. Il existe par anticipation, pour
 * que le consentement déjà donné par un visiteur ne soit pas reperdu le jour
 * où un outil d'analytics est ajouté — brancher son chargement sur
 * `hasAnalyticsConsent()` suffira alors.
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

/** Prêt pour le jour où un pixel publicitaire ou un partage réseau social est ajouté. */
export function hasMarketingConsent(): boolean {
  return getCookieConsent()?.marketing ?? false;
}
