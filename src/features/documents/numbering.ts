import type { DocumentNumberingFormat } from '@/types/database';

export const NUMBERING_FORMATS: readonly DocumentNumberingFormat[] = [
  'day_sequence',
  'month_sequence',
  'year_sequence',
  'sequence_6',
  'sequence',
];

export function previewDocumentNumber(
  format: DocumentNumberingFormat,
  value: number,
  date = new Date(),
) {
  const sequence = String(value).padStart(6, '0');
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  switch (format) {
    case 'day_sequence':
      return `${year}-${month}-${day}-${sequence}`;
    case 'month_sequence':
      return `${year}-${month}-${sequence}`;
    case 'year_sequence':
      return `${year}-${sequence}`;
    case 'sequence_6':
      return sequence;
    case 'sequence':
      return String(value);
    case 'legacy_quote':
      return `DEV-${String(value).padStart(4, '0')}`;
    case 'legacy_invoice':
      return `FAC-${year}-${String(value).padStart(5, '0')}`;
  }
}
