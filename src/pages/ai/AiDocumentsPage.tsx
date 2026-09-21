import {
  AlertTriangle,
  Check,
  Clock,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react';
import { useRef, useState } from 'react';

import { AtelierIllustration } from '@/components/feedback/AtelierIllustration';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { FormError } from '@/components/feedback/FormError';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, type BadgeProps } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  useAiDocuments,
  useDeleteAiDocument,
  useReindexAiDocument,
  useUploadAiDocument,
} from '@/features/ai';
import { useCurrentOrganization } from '@/features/organizations';
import { formatDate } from '@/lib/format';
import { useDocumentTitle } from '@/lib/use-document-title';
import type { AiDocumentStatus } from '@/types/database';
import type { AiDocument } from '@/types/domain';

/**
 * Bibliothèque documentaire de l'Assistant IA — dépôt et suivi des PDF que
 * `index-ai-document` transforme en fragments recherchables (RAG).
 *
 * Réservée à `ai.manage_documents` (owner/admin/manager) au niveau de la
 * route : c'est un outil d'entreprise, pas un écran de consultation
 * quotidienne pour un technicien.
 */

const STATUS_CONFIG: Record<
  AiDocumentStatus,
  { label: string; variant: NonNullable<BadgeProps['variant']>; icon: typeof Clock }
> = {
  pending: { label: 'En attente', variant: 'neutral', icon: Clock },
  processing: { label: 'Indexation…', variant: 'info', icon: Loader2 },
  ready: { label: 'Prêt', variant: 'success', icon: Check },
  error: { label: 'Erreur', variant: 'error', icon: AlertTriangle },
};

const MAX_FILE_SIZE = 25 * 1024 * 1024;

export default function AiDocumentsPage() {
  useDocumentTitle('Documents de l’Assistant IA');

  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? null;

  const documentsQuery = useAiDocuments(organizationId);
  const documents = documentsQuery.data ?? [];

  const uploadDocument = useUploadAiDocument(organizationId ?? '');
  const reindexDocument = useReindexAiDocument(organizationId ?? '');
  const deleteDocument = useDeleteAiDocument(organizationId ?? '');

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [documentToDelete, setDocumentToDelete] = useState<AiDocument | null>(null);

  const resetUploadForm = () => {
    setTitle('');
    setCategory('');
    setFile(null);
    setValidationError(null);
    uploadDocument.reset();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = (selected: File | null) => {
    setValidationError(null);
    if (!selected) {
      setFile(null);
      return;
    }
    if (selected.type !== 'application/pdf') {
      setValidationError('Seuls les fichiers PDF sont acceptés.');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      setValidationError('Le fichier dépasse la taille maximale de 25 Mo.');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setFile(selected);
    if (!title) setTitle(selected.name.replace(/\.pdf$/i, ''));
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title.trim()) return;

    try {
      await uploadDocument.mutateAsync({
        title: title.trim(),
        ...(category.trim() ? { category: category.trim() } : {}),
        file,
      });
      setIsUploadOpen(false);
      resetUploadForm();
    } catch {
      // L'erreur reste affichée par `FormError` ci-dessous ; rien à faire ici.
    }
  };

  const handleDelete = async () => {
    if (!documentToDelete) return;

    try {
      await deleteDocument.mutateAsync(documentToDelete);
      setDocumentToDelete(null);
    } catch {
      // La mutation conserve l'erreur afin de l'afficher dans la modale.
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      <PageHeader
        title="Documents de l’Assistant IA"
        description="Les PDF déposés ici (notices, procédures, normes) sont indexés et consultés par l’assistant pour répondre à partir de votre propre documentation, avec citation de la source."
        actions={
          <Button
            variant="primary"
            className="min-h-touch w-full gap-2 sm:min-h-0 sm:w-auto"
            onClick={() => setIsUploadOpen(true)}
          >
            <Plus className="size-4" aria-hidden="true" />
            Ajouter un document
          </Button>
        }
      />

      {documentsQuery.isError ? (
        <ErrorState error={documentsQuery.error} onRetry={() => void documentsQuery.refetch()} />
      ) : documentsQuery.isPending ? (
        <div className="space-y-2.5" aria-hidden="true">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : documents.length === 0 ? (
        <EmptyState
          illustration={<AtelierIllustration subject="library" />}
          title="Aucun document indexé"
          description="Déposez un premier PDF — guide technique, procédure, norme — pour que l’assistant puisse s’appuyer dessus et citer sa source dans ses réponses."
          action={
            <Button variant="primary" className="gap-2" onClick={() => setIsUploadOpen(true)}>
              <Upload className="size-4" aria-hidden="true" />
              Déposer un document
            </Button>
          }
        />
      ) : (
        <section className="space-y-3" aria-labelledby="ai-documents-list-title">
          <div className="flex items-end justify-between gap-4 px-1">
            <div>
              <h2 id="ai-documents-list-title" className="text-foreground text-sm font-bold">
                Base documentaire
              </h2>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {documents.length} document{documents.length > 1 ? 's' : ''} disponible
                {documents.length > 1 ? 's' : ''} pour l’assistant
              </p>
            </div>
            <Badge variant="outline" className="hidden shrink-0 sm:inline-flex">
              PDF · 25 Mo max.
            </Badge>
          </div>

          <ul className="space-y-3">
            {documents.map((document) => {
              const status = STATUS_CONFIG[document.status];
              const StatusIcon = status.icon;

              return (
                <li
                  key={document.id}
                  className="border-border/80 bg-surface hover:border-primary/25 hover:shadow-raised group flex flex-col gap-3 rounded-2xl border p-4 shadow-xs transition-[border-color,box-shadow,transform] motion-reduce:hover:translate-y-0 sm:flex-row sm:items-start sm:hover:-translate-y-0.5"
                >
                  <div className="bg-primary-subtle text-primary border-primary/10 flex size-11 shrink-0 items-center justify-center rounded-xl border">
                    <FileText className="size-4.5" aria-hidden="true" />
                  </div>

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-foreground truncate text-sm font-bold">
                        {document.title}
                      </span>
                      <Badge variant={status.variant} className="gap-1">
                        <StatusIcon
                          className={`size-3 ${document.status === 'processing' ? 'animate-spin' : ''}`}
                          aria-hidden="true"
                        />
                        {status.label}
                      </Badge>
                      {document.category && <Badge variant="neutral">{document.category}</Badge>}
                    </div>
                    <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                      <span className="max-w-full truncate font-mono">{document.filename}</span>
                      <span className="text-subtle-foreground hidden sm:inline" aria-hidden="true">
                        ·
                      </span>
                      <span>Déposé le {formatDate(document.created_at)}</span>
                    </div>
                    {document.status === 'error' && document.error_message && (
                      <p className="border-error-border bg-error-subtle text-error rounded-lg border px-2.5 py-2 text-xs">
                        {document.error_message}
                      </p>
                    )}
                  </div>

                  <div className="border-border/70 flex w-full shrink-0 items-center justify-end gap-1 border-t pt-3 sm:w-auto sm:border-0 sm:pt-0">
                    {document.status === 'error' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-touch flex-1 gap-1.5 sm:min-h-0 sm:flex-none"
                        disabled={reindexDocument.isPending}
                        onClick={() => reindexDocument.mutate(document.id)}
                      >
                        <RefreshCw className="size-3.5" aria-hidden="true" />
                        Réessayer
                      </Button>
                    )}
                    <Button
                      variant="danger-outline"
                      size="icon-sm"
                      className="min-h-touch min-w-touch sm:min-h-0 sm:min-w-0"
                      onClick={() => {
                        deleteDocument.reset();
                        setDocumentToDelete(document);
                      }}
                      aria-label={`Supprimer ${document.title}`}
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Dépôt d'un document */}
      <Modal
        open={isUploadOpen}
        onOpenChange={(open) => {
          if (!open && uploadDocument.isPending) return;
          setIsUploadOpen(open);
          if (!open) resetUploadForm();
        }}
        title="Ajouter un document"
        description="PDF uniquement, 25 Mo maximum. L’indexation démarre automatiquement après le dépôt."
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={uploadDocument.isPending}
              onClick={() => setIsUploadOpen(false)}
              className="w-full sm:w-auto"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              form="ai-document-upload-form"
              variant="primary"
              disabled={!file || !title.trim() || uploadDocument.isPending}
              isLoading={uploadDocument.isPending}
              loadingLabel="Dépôt et indexation du document"
              leadingIcon={<Upload className="size-4" aria-hidden="true" />}
              className="w-full gap-2 sm:w-auto"
            >
              Déposer et indexer
            </Button>
          </div>
        }
      >
        <form id="ai-document-upload-form" onSubmit={handleUpload} className="space-y-4">
          <FormError error={uploadDocument.error} />
          {validationError && (
            <p className="text-error text-xs" role="alert">
              {validationError}
            </p>
          )}

          <div className="space-y-1.5">
            <label
              htmlFor="ai-document-file"
              className="text-muted-foreground block text-xs font-medium"
            >
              Fichier PDF *
            </label>
            <div className="border-border-strong bg-surface-sunken/35 focus-within:border-primary focus-within:ring-primary/20 rounded-2xl border border-dashed p-3 transition-[border-color,box-shadow] focus-within:ring-2">
              <div className="mb-3 flex items-center gap-3">
                <div className="bg-primary-subtle text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
                  <Upload className="size-4.5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-foreground text-xs font-semibold" aria-live="polite">
                    {file ? file.name : 'Sélectionnez un fichier PDF'}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {file
                      ? `${(file.size / 1024 / 1024).toFixed(2)} Mo · prêt à être envoyé`
                      : 'Un seul fichier, jusqu’à 25 Mo'}
                  </p>
                </div>
              </div>
              <input
                ref={fileInputRef}
                id="ai-document-file"
                type="file"
                accept="application/pdf"
                required
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                className="file:bg-primary/10 file:text-primary file:hover:bg-primary/15 file:min-h-touch w-full text-xs text-transparent file:mr-3 file:cursor-pointer file:rounded-xl file:border-0 file:px-3 file:py-2 file:text-xs file:font-semibold sm:file:min-h-0"
              />
            </div>
          </div>

          <Input
            label="Titre du document *"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="ex : Guide OTDR — Procédure de mesure"
          />

          <Input
            label="Catégorie"
            hint="Optionnel — aide à retrouver le document (ex : fibre, électricité, sécurité)."
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="ex : fibre"
          />
        </form>
      </Modal>

      {/* Confirmation de suppression */}
      <Modal
        open={documentToDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleteDocument.isPending) {
            setDocumentToDelete(null);
            deleteDocument.reset();
          }
        }}
        title="Supprimer ce document ?"
        description={
          documentToDelete
            ? `« ${documentToDelete.title} » et ses fragments indexés seront définitivement retirés.`
            : 'Confirmez la suppression de ce document.'
        }
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              disabled={deleteDocument.isPending}
              onClick={() => setDocumentToDelete(null)}
              className="w-full sm:w-auto"
            >
              Annuler
            </Button>
            <Button
              variant="danger"
              disabled={deleteDocument.isPending}
              isLoading={deleteDocument.isPending}
              loadingLabel="Suppression du document"
              leadingIcon={<Trash2 className="size-4" aria-hidden="true" />}
              onClick={() => void handleDelete()}
              className="w-full gap-2 sm:w-auto"
            >
              Supprimer définitivement
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            L’assistant ne pourra plus utiliser ce document comme source. Cette action est
            irréversible.
          </p>
          <FormError error={deleteDocument.error} />
        </div>
      </Modal>
    </div>
  );
}
