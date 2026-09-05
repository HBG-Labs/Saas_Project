import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getSuperPdpReadiness,
  startSuperPdpConnection,
  submitInvoiceToSuperPdp,
  syncInvoiceFromSuperPdp,
} from './provider.api';

const { getSession, invoke, messageDeLaFonction, refreshSession } = vi.hoisted(() => ({
  getSession: vi.fn(),
  invoke: vi.fn(),
  messageDeLaFonction: vi.fn().mockResolvedValue('Erreur précise du serveur.'),
  refreshSession: vi.fn(),
}));

vi.mock('@/services/supabase', () => ({
  supabase: { auth: { getSession, refreshSession }, functions: { invoke } },
  unwrapMaybe: vi.fn(),
  messageDeLaFonction,
}));

beforeEach(() => {
  invoke.mockReset();
  getSession.mockResolvedValue({
    data: { session: { access_token: 'fresh-token', expires_at: Date.now() / 1000 + 3600 } },
    error: null,
  });
  refreshSession.mockReset();
  refreshSession.mockResolvedValue({
    data: { session: { access_token: 'renewed-token', expires_at: Date.now() / 1000 + 3600 } },
    error: null,
  });
});

describe('API de raccordement SUPER PDP', () => {
  it('lit la disponibilité sans lancer le parcours OAuth', async () => {
    invoke.mockResolvedValue({
      data: { configured: false, environment: 'sandbox' },
      error: null,
    });
    await expect(getSuperPdpReadiness('org-1')).resolves.toEqual({
      configured: false,
      environment: 'sandbox',
    });
    expect(invoke).toHaveBeenCalledWith('superpdp-connection', {
      headers: { Authorization: 'Bearer fresh-token' },
      body: { organizationId: 'org-1', action: 'readiness' },
    });
  });

  it('accepte uniquement la page OAuth officielle et transmet une adresse de retour locale', async () => {
    invoke.mockResolvedValue({
      data: { url: 'https://api.superpdp.tech/oauth2/authorize?state=abc' },
      error: null,
    });
    await expect(startSuperPdpConnection('org-1')).resolves.toContain('api.superpdp.tech');
    expect(invoke).toHaveBeenCalledWith('superpdp-connection', {
      headers: { Authorization: 'Bearer fresh-token' },
      body: {
        organizationId: 'org-1',
        action: 'start',
        returnUrl: `${window.location.origin}/organisation/facturation-electronique`,
      },
    });

    invoke.mockResolvedValue({
      data: { url: 'https://example.org/oauth2/authorize?state=abc' },
      error: null,
    });
    await expect(startSuperPdpConnection('org-1')).rejects.toThrow('invalide');
  });

  it('sépare explicitement le dépôt de la synchronisation', async () => {
    invoke.mockResolvedValue({
      data: { status: 'submitted', providerSubmissionId: '42' },
      error: null,
    });
    await submitInvoiceToSuperPdp('invoice-1');
    await syncInvoiceFromSuperPdp('invoice-1');
    expect(invoke).toHaveBeenNthCalledWith(1, 'superpdp-invoice', {
      headers: { Authorization: 'Bearer fresh-token' },
      body: { invoiceId: 'invoice-1', action: 'submit' },
    });
    expect(invoke).toHaveBeenNthCalledWith(2, 'superpdp-invoice', {
      headers: { Authorization: 'Bearer fresh-token' },
      body: { invoiceId: 'invoice-1', action: 'sync' },
    });
  });

  it('renouvelle la session avant d’appeler la fonction', async () => {
    getSession.mockResolvedValue({
      data: { session: { access_token: 'old-token', expires_at: Date.now() / 1000 } },
      error: null,
    });
    refreshSession.mockResolvedValue({
      data: { session: { access_token: 'renewed-token', expires_at: Date.now() / 1000 + 3600 } },
      error: null,
    });
    invoke.mockResolvedValue({
      data: { status: 'submitted', providerSubmissionId: '42' },
      error: null,
    });
    await submitInvoiceToSuperPdp('invoice-1');
    expect(invoke).toHaveBeenCalledWith('superpdp-invoice', {
      headers: { Authorization: 'Bearer renewed-token' },
      body: { invoiceId: 'invoice-1', action: 'submit' },
    });
  });

  it('ne fait pas tourner inutilement un jeton encore valide', async () => {
    invoke.mockResolvedValue({
      data: { status: 'submitted', providerSubmissionId: '42' },
      error: null,
    });

    await submitInvoiceToSuperPdp('invoice-1');

    expect(refreshSession).not.toHaveBeenCalled();
    expect(invoke).toHaveBeenCalledWith('superpdp-invoice', {
      headers: { Authorization: 'Bearer fresh-token' },
      body: { invoiceId: 'invoice-1', action: 'submit' },
    });
  });

  it('restitue le message précis de la fonction Edge', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('forbidden') });
    await expect(submitInvoiceToSuperPdp('invoice-1')).rejects.toThrow('Erreur précise du serveur');
  });
});
