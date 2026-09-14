import { Download, type LucideIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

import type { PortalBucket } from '../api/portal.api';
import { usePortalFileUrl } from '../hooks/usePortal';
import { invoiceStatusLabel, missionStatusLabel, quoteStatusLabel } from '../portal-format';

export function StatusBadge({
  status,
  kind,
}: {
  status: string;
  kind: 'mission' | 'quote' | 'invoice';
}) {
  const s =
    kind === 'mission'
      ? missionStatusLabel(status)
      : kind === 'quote'
        ? quoteStatusLabel(status)
        : invoiceStatusLabel(status);
  return <Badge variant={s.tone}>{s.label}</Badge>;
}

type PortalHeaderTone = 'primary' | 'accent' | 'info' | 'success' | 'warning';

const HEADER_TONES: Record<PortalHeaderTone, string> = {
  primary: 'bg-primary-subtle text-primary',
  accent: 'bg-accent-subtle text-accent',
  info: 'bg-info-subtle text-info',
  success: 'bg-success-subtle text-success',
  warning: 'bg-warning-subtle text-warning',
};

export function PortalPageHeader({
  title,
  description,
  icon: Icon,
  tone = 'primary',
  summary,
  action,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  tone?: PortalHeaderTone;
  summary?: ReactNode;
  action?: ReactNode;
}) {
  if (Icon === undefined) {
    return (
      <div className="mb-4 space-y-1">
        <h1 className="text-foreground text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
        {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
      </div>
    );
  }

  return (
    <header className="border-border bg-surface relative mb-4 overflow-hidden rounded-2xl border p-4 shadow-xs sm:p-5">
      <span
        className="from-primary via-info to-accent absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r"
        aria-hidden="true"
      />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              'flex size-11 shrink-0 items-center justify-center rounded-xl sm:size-12',
              HEADER_TONES[tone],
            )}
          >
            <Icon className="size-5 sm:size-6" aria-hidden="true" />
          </span>
          <div className="min-w-0 pt-0.5">
            <h1 className="text-foreground text-xl leading-tight font-bold tracking-tight sm:text-2xl">
              {title}
            </h1>
            {description ? (
              <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {summary || action ? (
          <div className="flex shrink-0 flex-col gap-2 min-[380px]:flex-row min-[380px]:items-center sm:justify-end">
            {summary}
            {action}
          </div>
        ) : null}
      </div>
    </header>
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
  className,
}: {
  bucket: PortalBucket;
  path: string;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const fileUrl = usePortalFileUrl();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className={cn('inline-flex flex-col items-start gap-1', className)}>
      <Button
        type="button"
        variant="outline"
        size={size}
        className="w-full min-w-0"
        disabled={fileUrl.isPending}
        isLoading={fileUrl.isPending}
        loadingLabel={`Ouverture de ${label.toLowerCase()}`}
        leadingIcon={<Download className="size-4" />}
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
        <span className="truncate">{label}</span>
      </Button>
      {error !== null ? (
        <span className="text-error text-xs" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
