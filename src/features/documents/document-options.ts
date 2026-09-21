import type { Json } from '@/types/database';

export type DocumentMode = 'quick' | 'complete' | 'electronic';

export interface DocumentOptions {
  mode: DocumentMode;
  language: 'fr';
  showDeliveryAddress: boolean;
  showRegistrationNumber: boolean;
  showVatNumber: boolean;
  showBankDetails: boolean;
  showTitle: boolean;
  showFreeField: boolean;
  showSignature: boolean;
  showAcceptanceTerms: boolean;
  showGlobalDiscount: boolean;
}

export const DEFAULT_DOCUMENT_OPTIONS: DocumentOptions = {
  mode: 'quick',
  language: 'fr',
  showDeliveryAddress: false,
  showRegistrationNumber: false,
  showVatNumber: false,
  showBankDetails: false,
  showTitle: false,
  showFreeField: false,
  showSignature: false,
  showAcceptanceTerms: false,
  showGlobalDiscount: false,
};

export function normalizeDocumentOptions(value: Json | undefined): DocumentOptions {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_DOCUMENT_OPTIONS };
  }
  const source = value as Record<string, Json>;
  const mode = source.mode === 'complete' || source.mode === 'electronic' ? source.mode : 'quick';
  return {
    ...DEFAULT_DOCUMENT_OPTIONS,
    mode,
    ...Object.fromEntries(
      (Object.keys(DEFAULT_DOCUMENT_OPTIONS) as Array<keyof DocumentOptions>)
        .filter((key) => key !== 'mode' && key !== 'language')
        .map((key) => [key, source[key] === true]),
    ),
  };
}

export function serializeDocumentOptions(options: DocumentOptions): Json {
  return { ...options };
}
