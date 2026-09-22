import { ImagePlus, LoaderCircle, MoveDiagonal2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/cn';

import { DOCUMENT_LOGO_SIZE_LIMITS } from '../document-options';

export interface DocumentLogoSize {
  width: number;
  height: number;
}

export function DocumentLogoEditor({
  src,
  size,
  onSizeChange,
  onUpload,
  className,
}: {
  src?: string | null | undefined;
  size: DocumentLogoSize;
  onSizeChange: (size: DocumentLogoSize) => void;
  onUpload: (file: File) => Promise<unknown>;
  className?: string;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    [],
  );

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const next = {
        width: Math.min(
          DOCUMENT_LOGO_SIZE_LIMITS.maxWidth,
          Math.max(DOCUMENT_LOGO_SIZE_LIMITS.minWidth, Math.round(entry.contentRect.width)),
        ),
        height: Math.min(
          DOCUMENT_LOGO_SIZE_LIMITS.maxHeight,
          Math.max(DOCUMENT_LOGO_SIZE_LIMITS.minHeight, Math.round(entry.contentRect.height)),
        ),
      };
      if (next.width !== size.width || next.height !== size.height) onSizeChange(next);
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, [onSizeChange, size.height, size.width]);

  const handleFile = async (file: File) => {
    setError(null);
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const nextPreviewUrl = URL.createObjectURL(file);
    previewUrlRef.current = nextPreviewUrl;
    setPreviewUrl(nextPreviewUrl);
    setIsUploading(true);
    try {
      await onUpload(file);
    } catch (reason) {
      URL.revokeObjectURL(nextPreviewUrl);
      previewUrlRef.current = null;
      setPreviewUrl(null);
      setError(reason instanceof Error ? reason.message : 'Le logo n’a pas pu être importé.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className={cn('space-y-1.5', className)}>
      <div
        ref={frameRef}
        className="document-logo-frame border-financial-accent bg-financial-soft relative resize overflow-hidden border border-dashed"
        style={{ width: size.width, height: size.height }}
      >
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-financial-accent hover:bg-financial-soft/70 flex size-full items-center justify-center transition"
          aria-label={
            src || previewUrl
              ? 'Remplacer le logo de l’entreprise'
              : 'Importer le logo de l’entreprise'
          }
        >
          {previewUrl || src ? (
            <img
              src={previewUrl ?? src ?? undefined}
              alt="Logo de l’entreprise"
              className="size-full object-contain p-2"
            />
          ) : (
            <span className="flex items-center gap-2 text-xs font-semibold">
              <ImagePlus className="size-5" aria-hidden="true" />
              Importer votre logo
            </span>
          )}
          {isUploading ? (
            <span className="bg-surface/85 text-financial-accent absolute inset-0 flex items-center justify-center gap-2 text-xs font-semibold">
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              Importation…
            </span>
          ) : null}
        </button>
        <span
          className="bg-financial-accent text-surface pointer-events-none absolute right-0 bottom-0 flex size-5 items-center justify-center"
          aria-hidden="true"
        >
          <MoveDiagonal2 className="size-3" />
        </span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
          event.target.value = '';
        }}
      />
      <p className="text-3xs text-muted-foreground">
        Glissez le coin inférieur droit pour ajuster la taille.
      </p>
      {error ? (
        <p role="alert" className="text-3xs text-error max-w-80">
          {error}
        </p>
      ) : null}
    </div>
  );
}
