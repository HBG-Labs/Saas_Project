export interface TrustedReturnUrlInput {
  configuredAppUrl: string | undefined;
  explicitUrl: string | undefined;
  requestOrigin: string | null;
  path: string;
}

function parsedHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null;
  } catch {
    return null;
  }
}

function isLocalDevelopmentHost(url: URL): boolean {
  return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
}

/**
 * Construit un retour Stripe sur l'origine de confiance configurée.
 *
 * Le chemin est toujours choisi par le serveur. Une URL fournie par le client
 * n'est acceptée que si son origine est exactement celle de `APP_URL`. Sans
 * configuration, le repli est réservé au développement local : un déploiement
 * incomplet ne devient jamais un redirecteur ouvert.
 */
export function trustedReturnUrl(input: TrustedReturnUrlInput): string | null {
  const configured = input.configuredAppUrl?.trim();

  if (configured) {
    const app = parsedHttpUrl(configured);
    if (!app || (app.protocol !== 'https:' && !isLocalDevelopmentHost(app))) return null;

    if (input.explicitUrl) {
      const explicit = parsedHttpUrl(input.explicitUrl);
      if (!explicit || explicit.origin !== app.origin) return null;
    }

    return new URL(input.path, `${app.origin}/`).toString();
  }

  const localCandidate = input.explicitUrl ?? input.requestOrigin ?? '';
  const local = parsedHttpUrl(localCandidate);
  if (!local || !isLocalDevelopmentHost(local)) return null;
  return new URL(input.path, `${local.origin}/`).toString();
}
