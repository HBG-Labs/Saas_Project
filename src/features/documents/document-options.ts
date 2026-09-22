import type { Json } from '@/types/database';

export type DocumentMode = 'quick' | 'complete' | 'electronic';

export interface DocumentOptions {
  mode: DocumentMode;
  language: 'fr';
  logoWidth: number;
  logoHeight: number;
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
  logoWidth: 176,
  logoHeight: 80,
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

export const DOCUMENT_LOGO_SIZE_LIMITS = {
  minWidth: 120,
  maxWidth: 320,
  minHeight: 64,
  maxHeight: 180,
} as const;

const BOOLEAN_OPTION_KEYS = [
  'showDeliveryAddress',
  'showRegistrationNumber',
  'showVatNumber',
  'showBankDetails',
  'showTitle',
  'showFreeField',
  'showSignature',
  'showAcceptanceTerms',
  'showGlobalDiscount',
] as const satisfies ReadonlyArray<keyof DocumentOptions>;

function boundedNumber(value: Json | undefined, fallback: number, min: number, max: number) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.round(value)))
    : fallback;
}

export function normalizeDocumentOptions(value: Json | undefined): DocumentOptions {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_DOCUMENT_OPTIONS };
  }
  const source = value as Record<string, Json>;
  const mode = source.mode === 'complete' || source.mode === 'electronic' ? source.mode : 'quick';
  return {
    ...DEFAULT_DOCUMENT_OPTIONS,
    mode,
    logoWidth: boundedNumber(
      source.logoWidth,
      DEFAULT_DOCUMENT_OPTIONS.logoWidth,
      DOCUMENT_LOGO_SIZE_LIMITS.minWidth,
      DOCUMENT_LOGO_SIZE_LIMITS.maxWidth,
    ),
    logoHeight: boundedNumber(
      source.logoHeight,
      DEFAULT_DOCUMENT_OPTIONS.logoHeight,
      DOCUMENT_LOGO_SIZE_LIMITS.minHeight,
      DOCUMENT_LOGO_SIZE_LIMITS.maxHeight,
    ),
    ...Object.fromEntries(BOOLEAN_OPTION_KEYS.map((key) => [key, source[key] === true])),
  };
}

export function serializeDocumentOptions(options: DocumentOptions): Json {
  return { ...options };
}
