/// <reference types="node" />
import { createHash, webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadFacturX, downloadTestFacturX } from './facturx.api';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/services/supabase', () => ({
  supabase: { functions: { invoke } },
  messageDeLaFonction: vi.fn().mockResolvedValue('Facture inaccessible.'),
}));
const content = '%PDF-test';
const metadata = {
  url: 'https://test-project.supabase.co/storage/v1/object/sign/invoice-electronic-documents/org/invoice/factur-x.pdf?token=test',
  sha256: createHash('sha256').update(content).digest('hex'),
  byteSize: content.length,
  generatedAt: '2026-09-04T00:00:00Z',
  generatorVersion: 'test',
};
beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto);
  invoke.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
});
describe('téléchargement privé Factur-X', () => {
  it('demande explicitement un test avec la version du brouillon, sans lien de stockage', async () => {
    const pdf = new Blob(['%PDF-test-content'], { type: 'application/pdf' });
    invoke.mockResolvedValue({ data: pdf, error: null });
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    expect(await downloadTestFacturX('invoice-1', '2026-09-04T00:00:00Z')).toBe(pdf);
    expect(invoke).toHaveBeenCalledWith('generate-facturx', {
      body: {
        invoiceId: 'invoice-1',
        mode: 'test',
        expectedUpdatedAt: '2026-09-04T00:00:00Z',
      },
    });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('ne confond pas une réponse définitive ou une erreur avec le PDF de test', async () => {
    invoke.mockResolvedValue({ data: metadata, error: null });
    await expect(downloadTestFacturX('invoice-1', 'version')).rejects.toThrow('PDF de test valide');
    invoke.mockResolvedValue({ data: null, error: new Error('forbidden') });
    await expect(downloadTestFacturX('invoice-1', 'version')).rejects.toThrow(
      'Facture inaccessible',
    );
  });
  it('transmet seulement l’identifiant et vérifie les octets du fichier reçu', async () => {
    invoke.mockResolvedValue({ data: metadata, error: null });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(content)));
    const blob = await downloadFacturX('invoice-1');
    expect(invoke).toHaveBeenCalledWith('generate-facturx', { body: { invoiceId: 'invoice-1' } });
    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBe(content.length);
  });
  it('rejette un fichier dont le contenu diffère de l’empreinte conservée', async () => {
    invoke.mockResolvedValue({ data: metadata, error: null });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('%PDF-faux')));
    await expect(downloadFacturX('invoice-1')).rejects.toThrow('intégrité');
  });
  it('ne suit pas un lien provenant d’un domaine extérieur', async () => {
    invoke.mockResolvedValue({
      data: { ...metadata, url: 'https://example.org/facture.pdf' },
      error: null,
    });
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(downloadFacturX('invoice-1')).rejects.toThrow(
      'lien de téléchargement est invalide',
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it('respecte le refus du serveur et ne tente aucun accès au fichier', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('forbidden') });
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(downloadFacturX('invoice-1')).rejects.toThrow('Facture inaccessible');
    expect(fetch).not.toHaveBeenCalled();
  });
});
