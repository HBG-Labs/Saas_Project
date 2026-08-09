import { FileText, ImageOff, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';

import { FormError } from '@/components/feedback/FormError';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import type { AttachmentKind } from '@/types/database';
import type { InterventionAttachment } from '@/types/domain';

import {
  useAttachmentUrl,
  useDeleteAttachment,
  useUploadAttachment,
} from '../hooks/useReports';

export interface AttachmentGalleryProps {
  interventionId: string;
  organizationId: string;
  missionId: string;
  uploadedBy: string;
  attachments: readonly InterventionAttachment[];
  canEdit: boolean;
}

const KIND_LABELS: Record<AttachmentKind, string> = {
  before: 'Avant',
  after: 'Après',
  document: 'Document',
  proof: 'Preuve',
  signature: 'Signature',
};

/**
 * Photos et documents d'une intervention.
 *
 * Les clichés « avant » et « après » sont séparés à la prise de vue, pas triés
 * ensuite : sur un chantier, on photographie l'état initial en arrivant et le
 * résultat en partant. Demander de classer après coup, c'est garantir que
 * personne ne le fera.
 */
export function AttachmentGallery({
  interventionId,
  organizationId,
  missionId,
  uploadedBy,
  attachments,
  canEdit,
}: AttachmentGalleryProps) {
  const upload = useUploadAttachment(interventionId);
  const remove = useDeleteAttachment(interventionId);
  const [error, setError] = useState<unknown>(null);

  const beforeInput = useRef<HTMLInputElement>(null);
  const afterInput = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null, kind: AttachmentKind) => {
    if (files === null) return;

    setError(null);
    for (const file of Array.from(files)) {
      upload.mutate(
        { organizationId, missionId, interventionId, file, kind, uploadedBy },
        {
          onError: (mutationError) => {
            setError(mutationError);
          },
        },
      );
    }
  };

  return (
    <div className="space-y-4">
      <FormError error={error} />

      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          <input
            ref={beforeInput}
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            className="sr-only"
            onChange={(event) => {
              handleFiles(event.target.files, 'before');
              event.target.value = '';
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => beforeInput.current?.click()}
            disabled={upload.isPending}
          >
            <Upload className="size-4" />
            Photo « avant »
          </Button>

          <input
            ref={afterInput}
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            className="sr-only"
            onChange={(event) => {
              handleFiles(event.target.files, 'after');
              event.target.value = '';
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => afterInput.current?.click()}
            disabled={upload.isPending}
          >
            <Upload className="size-4" />
            Photo « après »
          </Button>

          {upload.isPending ? (
            <span className="text-muted-foreground self-center text-xs">Envoi en cours…</span>
          ) : null}
        </div>
      ) : null}

      {attachments.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          Aucune pièce jointe. Les photos avant et après sont ce qui rend un compte rendu
          opposable.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {attachments.map((attachment) => (
            <AttachmentTile
              key={attachment.id}
              attachment={attachment}
              canEdit={canEdit}
              onDelete={() => {
                remove.mutate(attachment);
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function AttachmentTile({
  attachment,
  canEdit,
  onDelete,
}: {
  attachment: InterventionAttachment;
  canEdit: boolean;
  onDelete: () => void;
}) {
  const url = useAttachmentUrl(attachment.storage_path);
  const isImage = attachment.mime_type?.startsWith('image/') ?? false;

  return (
    <li className="border-border relative overflow-hidden rounded-lg border">
      <div className="bg-surface-sunken flex aspect-square items-center justify-center">
        {url.isPending ? (
          <Skeleton className="size-full" />
        ) : url.isError || url.data === null ? (
          /*
            Le bucket est privé et l'URL signée expire en une heure. Un échec ici
            n'est donc pas rare — écran resté ouvert, réseau coupé — et mérite un
            repli lisible plutôt qu'une image brisée.
          */
          <ImageOff className="text-subtle-foreground size-6" aria-hidden="true" />
        ) : isImage ? (
          <img
            src={url.data}
            alt={attachment.caption ?? attachment.file_name}
            className="size-full object-cover"
          />
        ) : (
          <a
            href={url.data}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground hover:text-foreground flex flex-col items-center gap-1 p-2 text-center"
          >
            <FileText className="size-6" aria-hidden="true" />
            <span className="text-2xs break-all">{attachment.file_name}</span>
          </a>
        )}
      </div>

      <div className="flex items-center justify-between gap-1 p-1.5">
        <Badge variant={attachment.kind === 'before' ? 'neutral' : 'primary'}>
          {KIND_LABELS[attachment.kind]}
        </Badge>

        {canEdit ? (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onDelete}
            className="text-muted-foreground hover:text-error"
            aria-label={`Supprimer ${attachment.file_name}`}
          >
            <Trash2 className="size-3.5" />
          </Button>
        ) : null}
      </div>
    </li>
  );
}
