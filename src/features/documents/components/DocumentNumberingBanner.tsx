import { AlertCircle, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { DocumentKind, DocumentNumberingFormat } from '@/types/database';
import { previewDocumentNumber } from '../numbering';

export function DocumentNumberingBanner({
  documentKind,
  nextValue,
  format,
  onModify,
}: {
  documentKind: DocumentKind;
  nextValue: number;
  format: DocumentNumberingFormat;
  onModify: () => void;
}) {
  const name =
    documentKind === 'quote' ? 'devis' : documentKind === 'credit_note' ? 'avoir' : 'facture';
  return (
    <div className="border-warning/35 bg-warning/15 text-foreground mx-auto flex w-full max-w-xl items-center gap-3 rounded-xl border px-4 py-2.5 shadow-xs">
      <AlertCircle className="text-warning-foreground size-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold">Votre prochain {name} portera le numéro</p>
        <p className="text-warning-foreground mt-0.5 text-sm font-black tabular-nums">
          {previewDocumentNumber(format, nextValue)}
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onModify}
        className="gap-1.5 bg-white/80"
      >
        <Pencil className="size-3.5" aria-hidden="true" />
        Modifier
      </Button>
    </div>
  );
}
