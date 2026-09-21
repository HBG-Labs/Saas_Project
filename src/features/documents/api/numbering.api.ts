import { supabase, unwrap, unwrapMaybe } from '@/services/supabase';
import type { DocumentKind, DocumentNumberingFormat, Tables } from '@/types/database';

export type DocumentNumberingSetting = Tables<'document_numbering_settings'>;

export function getDocumentNumbering(
  organizationId: string,
  documentKind: DocumentKind,
): Promise<DocumentNumberingSetting | null> {
  return unwrapMaybe(
    supabase
      .from('document_numbering_settings')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('document_kind', documentKind)
      .maybeSingle(),
  );
}

export function configureDocumentNumbering(input: {
  organizationId: string;
  documentKind: DocumentKind;
  firstNumber: number;
  format: DocumentNumberingFormat;
}): Promise<DocumentNumberingSetting> {
  return unwrap(
    supabase.rpc('configure_document_numbering', {
      p_organization_id: input.organizationId,
      p_document_kind: input.documentKind,
      p_first_number: input.firstNumber,
      p_format: input.format,
    }),
  );
}
