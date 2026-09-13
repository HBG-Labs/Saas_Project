import { Download, Loader2 } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

import type { PortalBucket } from '../api/portal.api';
import { usePortalFileUrl } from '../hooks/usePortal';
import { invoiceStatusLabel, missionStatusLabel, quoteStatusLabel } from '../portal-format';

export function StatusBadge({ status, kind }: { status: string; kind: 'mission' | 'quote' | 'invoice' }) {
  const s = kind === 'mission' ? missionStatusLabel(status) : kind === 'quote' ? quoteStatusLabel(status) : invoiceStatusLabel(status);
  return <Badge variant={s.tone}>{s.label}</Badge>;
}

export function PortalPageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4 space-y-1">
      <h1 className="text-foreground text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
      {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
    </div>
  );
}

/**
 * Ouvre un fichier du portail. L'URL n'existe pas avant le clic : elle est
 * signée à la demande, pour cinq minutes, après que la base a dit oui.
 */
export function FileOpenButton({
  bucket,
  path,
  label = 'Télécharger',
  size = 'sm',
}: {
  bucket: PortalBucket;
  path: string;
  label?: string;
  size?: 'sm' | 'md';
}) {
  const fileUrl = usePortalFileUrl();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="outline"
        size={size}
        disabled={fileUrl.isPending}
        onClick={() => {
          setError(null);
          fileUrl.mutate(
            { bucket, path },
            {
              onSuccess: (url) => {
                window.open(url, '_blank', 'noopener');
              },
              onError: (e) => {
                setError(e instanceof Error ? e.message : 'Fichier introuvable.');
              },
            },
          );
        }}
      >
        {fileUrl.isPending ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
        {label}
      </Button>
      {error !== null ? (
        <span className="text-error text-xs" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
