import { afterEach, describe, expect, it, vi } from 'vitest';


/**
 * Le lien qu'un dirigeant copie pour le transmettre de vive voix.
 *
 * Il doit être IDENTIQUE à celui du courriel, construit côté serveur depuis le
 * secret `APP_URL`. Deux adresses pour la même invitation, dont une en
 * `localhost`, était le défaut signalé.
 */
describe('buildInvitationUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('reprend l’origine de la page quand rien n’est configuré', async () => {
    // Retrait EXPLICITE : ce dépôt renseigne la variable dans `.env.local`, et
    // s'en remettre à son absence ferait dépendre le test d'un fichier non
    // versionné — vert ici, rouge chez le voisin.
    vi.stubEnv('VITE_PUBLIC_APP_URL', undefined);
    vi.resetModules();
    const { buildInvitationUrl: recharge } = await import('./invitation-url');

    // Comportement par défaut, et il est JUSTE en production : l'origine y est
    // déjà l'adresse publique.
    expect(recharge('jeton-1')).toBe(`${window.location.origin}/invitations/jeton-1`);
  });

  it('préfère l’adresse publique déclarée, pour un lien transmissible', async () => {
    vi.stubEnv('VITE_PUBLIC_APP_URL', 'https://rezo360.vercel.app');
    vi.resetModules();
    const { buildInvitationUrl: recharge } = await import('./invitation-url');

    expect(recharge('jeton-2')).toBe('https://rezo360.vercel.app/invitations/jeton-2');
  });

  it('ne double pas la barre oblique si l’adresse en porte une', async () => {
    vi.stubEnv('VITE_PUBLIC_APP_URL', 'https://rezo360.vercel.app/');
    vi.resetModules();
    const { buildInvitationUrl: recharge } = await import('./invitation-url');

    expect(recharge('jeton-3')).toBe('https://rezo360.vercel.app/invitations/jeton-3');
  });
});
