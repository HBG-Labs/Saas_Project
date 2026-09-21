import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import type { DocumentKind, DocumentNumberingFormat } from '@/types/database';
import { NUMBERING_FORMATS, previewDocumentNumber } from '../numbering';
import { useConfigureDocumentNumbering } from '../hooks/useDocumentNumbering';
import { NumberingIllustration } from './NumberingIllustration';

export function DocumentNumberingModal({
  open,
  onOpenChange,
  organizationId,
  documentKind,
  initialNumber,
  initialFormat,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  documentKind: DocumentKind;
  initialNumber: number;
  initialFormat: DocumentNumberingFormat;
}) {
  const configure = useConfigureDocumentNumbering();
  const [firstNumber, setFirstNumber] = useState(initialNumber);
  const [format, setFormat] = useState<DocumentNumberingFormat>(() =>
    NUMBERING_FORMATS.includes(initialFormat) ? initialFormat : 'sequence',
  );
  const examples = useMemo(
    () =>
      NUMBERING_FORMATS.map((value) => ({
        value,
        label: previewDocumentNumber(value, firstNumber),
      })),
    [firstNumber],
  );
  const label =
    documentKind === 'quote' ? 'devis' : documentKind === 'credit_note' ? 'avoir' : 'facture';

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Choisissez le numéro de votre premier ${label}, ainsi que le format`}
      description="Ce choix détermine les prochaines références. Il reste modifiable avant la première émission."
      size="lg"
      className="sm:max-w-xl"
      footer={
        <Button
          type="button"
          variant="primary"
          disabled={configure.isPending || firstNumber < 1}
          onClick={() => {
            configure.mutate(
              { organizationId, documentKind, firstNumber, format },
              { onSuccess: () => onOpenChange(false) },
            );
          }}
          className="min-w-36"
        >
          {configure.isPending ? 'Validation…' : 'Valider'}
        </Button>
      }
    >
      <NumberingIllustration />
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <Input
          label={`1er numéro de ${label}`}
          type="number"
          min={1}
          value={firstNumber}
          onChange={(event) => setFirstNumber(Math.max(1, Number(event.target.value) || 1))}
        />
        <Select
          label={`Format du n° de ${label}`}
          value={format}
          onValueChange={(value) => setFormat(value as DocumentNumberingFormat)}
          options={examples}
        />
      </div>
      {configure.error ? (
        <p className="text-error mt-3 text-xs">{configure.error.message}</p>
      ) : null}
    </Modal>
  );
}
