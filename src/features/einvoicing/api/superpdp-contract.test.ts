/// <reference types="node" />
import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildSuperPdpAuthorizationUrl,
  connectionStatus,
  decryptSecret,
  encryptSecret,
  frenchSiren,
  normalizeSuperPdpStatus,
  superPdpEventMessage,
} from '../provider/superpdp-contract';

beforeEach(() => vi.stubGlobal('crypto', webcrypto));
afterEach(() => vi.unstubAllGlobals());

describe('contrat SUPER PDP partagé avec les fonctions Edge', () => {
  it('construit le parcours OAuth multi-tenant sans secret dans l’URL', () => {
    const url = new URL(
      buildSuperPdpAuthorizationUrl({
        clientId: 'client-public',
        redirectUri: 'https://project.supabase.co/functions/v1/superpdp-oauth-callback',
        state: 'state-secret',
        loginHint: 'owner@example.test',
        siren: '123456789',
      }),
    );
    expect(url.origin).toBe('https://api.superpdp.tech');
    expect(url.searchParams.get('state')).toBe('state-secret');
    expect(url.searchParams.get('superpdp_company_number_scheme')).toBe('fr_siren');
    expect(url.searchParams.get('superpdp_send_and_receive')).toBe('send');
    expect(url.toString()).not.toContain('client_secret');
  });

  it('chiffre les jetons avec un contexte propre à l’organisation', async () => {
    const key = btoa(String.fromCharCode(...Array.from({ length: 32 }, (_, index) => index)));
    const encrypted = await encryptSecret('refresh-token', key, 'org-a:superpdp');
    expect(encrypted).not.toContain('refresh-token');
    await expect(decryptSecret(encrypted, key, 'org-a:superpdp')).resolves.toBe('refresh-token');
    await expect(decryptSecret(encrypted, key, 'org-b:superpdp')).rejects.toThrow();
  });

  it('normalise les événements officiels sans inventer une machine à états fournisseur', () => {
    expect(normalizeSuperPdpStatus('api:uploaded')).toBe('submitted');
    expect(normalizeSuperPdpStatus('fr:203')).toBe('delivered');
    expect(normalizeSuperPdpStatus('fr:205')).toBe('accepted');
    expect(normalizeSuperPdpStatus('ppf:flow-1-ack-error')).toBe('rejected');
    expect(normalizeSuperPdpStatus('fr:212')).toBeNull();
    expect(
      connectionStatus({
        client_id: 'client',
        created_at: '2026-09-04T00:00:00Z',
        company_verification_status: 'needs_review',
      }),
    ).toBe('pending_verification');
  });

  it('compare une entreprise SUPER PDP avec un SIREN ou un SIRET français', () => {
    expect(frenchSiren('109 198 440 00017')).toBe('109198440');
    expect(frenchSiren('000000002')).toBe('000000002');
    expect(frenchSiren('123')).toBeNull();
  });

  it('rend la raison détaillée d’un rejet exploitable sans conserver la réponse brute', () => {
    expect(
      superPdpEventMessage({
        id: 12,
        invoice_id: 34,
        status_code: 'api:rejected',
        status_text: 'Facture rejetée',
        created_at: '2026-09-04T19:23:00Z',
        data: { reason: 'Routage impossible' },
        details: [
          {
            reason: 'ADDR-01',
            notes: [{ subject: 'Destinataire', contents: [{ content: 'Adresse inconnue' }] }],
          },
        ],
      }),
    ).toBe('Facture rejetée · Routage impossible · ADDR-01 · Destinataire : Adresse inconnue');
  });
});
