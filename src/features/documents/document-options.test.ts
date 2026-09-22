import { describe, expect, it } from 'vitest';

import {
  DEFAULT_DOCUMENT_OPTIONS,
  DOCUMENT_LOGO_SIZE_LIMITS,
  documentSellerName,
  normalizeDocumentOptions,
  serializeDocumentOptions,
} from './document-options';

describe('document-options', () => {
  it('conserve les dimensions du logo et les options booléennes', () => {
    const result = normalizeDocumentOptions({
      mode: 'electronic',
      sellerName: 'Atelier Horizon',
      logoWidth: 248,
      logoHeight: 132,
      showBankDetails: true,
      showSignature: true,
    });

    expect(result).toMatchObject({
      mode: 'electronic',
      sellerName: 'Atelier Horizon',
      logoWidth: 248,
      logoHeight: 132,
      showBankDetails: true,
      showSignature: true,
    });
  });

  it('borne une taille de logo enregistrée hors limites', () => {
    const result = normalizeDocumentOptions({ logoWidth: 9999, logoHeight: 2 });

    expect(result.logoWidth).toBe(DOCUMENT_LOGO_SIZE_LIMITS.maxWidth);
    expect(result.logoHeight).toBe(DOCUMENT_LOGO_SIZE_LIMITS.minHeight);
  });

  it('retombe sur les valeurs sûres lorsque le stockage est invalide', () => {
    expect(normalizeDocumentOptions(null)).toEqual(DEFAULT_DOCUMENT_OPTIONS);
    expect(normalizeDocumentOptions(['invalid'])).toEqual(DEFAULT_DOCUMENT_OPTIONS);
  });

  it('sérialise toutes les options visibles du document', () => {
    expect(serializeDocumentOptions(DEFAULT_DOCUMENT_OPTIONS)).toEqual(DEFAULT_DOCUMENT_OPTIONS);
  });

  it('fige le nom saisi sur le document et reprend sinon celui de l’organisation', () => {
    expect(
      documentSellerName(
        { ...DEFAULT_DOCUMENT_OPTIONS, sellerName: '  Atelier Horizon  ' },
        'Ancien nom',
      ),
    ).toBe('Atelier Horizon');
    expect(documentSellerName(DEFAULT_DOCUMENT_OPTIONS, 'HBG Labs')).toBe('HBG Labs');
  });
});
