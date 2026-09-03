import {
  Camera,
  Download,
  Eye,
  FileText,
  Hammer,
  Image as ImageIcon,
  ImageOff,
  Sparkles,
  Trash2,
  Upload,
  Wrench,
  ZoomIn,
} from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';
import { Link } from 'react-router';

import { FormError } from '@/components/feedback/FormError';
import { Badge, type BadgeProps } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { FEATURES, getMinimumRequiredPlan } from '@/features/billing';
import { PERMISSIONS, usePermission } from '@/features/organizations';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/cn';
import { compressImage } from '@/lib/image-compression';
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
  /**
   * La formule de l'organisation inclut-elle les pièces jointes ?
   *
   * ─────────────────────────────────────────────────────────────────────────
   * POURQUOI CE N'EST PAS LA MÊME CHOSE QUE `canEdit`
   *
   * `canEdit` répond à « cette intervention accepte-t-elle encore des
   * modifications ? » (permission, statut). Ce booléen répond à une question
   * différente : « le dépôt de fichier est-il gardé, côté serveur, par
   * `app.org_has_feature(org_id, 'attachments')` ? » — réservé aux formules
   * Business et Enterprise.
   *
   * Sans cette distinction, un compte Starter ou Pro voyait les cinq boutons
   * d'ajout, cliquait, sélectionnait une photo, et recevait un rejet RLS brut
   * habillé en « Une erreur inattendue s'est produite » — exactement le
   * malentendu que `RequirePlan` existe pour éviter ailleurs dans
   * l'application, qui manquait ici parce que la galerie n'est pas une route
   * à part, seulement une section d'une page déjà accessible à ces formules.
   * ─────────────────────────────────────────────────────────────────────────
   */
  hasAttachmentsFeature: boolean;
}

export type PhotoCategory = 'all' | 'before' | 'during' | 'after' | 'proof' | 'document';

interface CategoryConfig {
  label: string;
  shortLabel: string;
  icon: typeof Camera;
  kind: AttachmentKind;
  badgeVariant: NonNullable<BadgeProps['variant']>;
  colorClass: string;
  description: string;
}

const CATEGORIES: Record<Exclude<PhotoCategory, 'all'>, CategoryConfig> = {
  before: {
    label: 'Photo « Avant »',
    shortLabel: 'Avant',
    icon: Camera,
    kind: 'before',
    badgeVariant: 'neutral',
    colorClass: 'text-muted-foreground',
    description: 'État initial du chantier à l’arrivée',
  },
  during: {
    label: 'Pendant les travaux',
    shortLabel: 'En cours',
    icon: Hammer,
    kind: 'proof',
    badgeVariant: 'primary',
    colorClass: 'text-primary',
    description: 'Étapes intermédiaires, pose, passages, raccordements',
  },
  after: {
    label: 'Photo « Après »',
    shortLabel: 'Après',
    icon: Sparkles,
    kind: 'after',
    badgeVariant: 'success',
    colorClass: 'text-success',
    description: 'Résultat finalisé et chantier nettoyé',
  },
  proof: {
    label: 'Preuve & Mesures',
    shortLabel: 'Mesures',
    icon: Wrench,
    kind: 'proof',
    badgeVariant: 'warning',
    colorClass: 'text-warning',
    description: 'Réflectométrie, tests, étiquettes, compteurs, n° de série',
  },
  document: {
    label: 'Document / Plan',
    shortLabel: 'Document',
    icon: FileText,
    kind: 'document',
    badgeVariant: 'outline',
    colorClass: 'text-primary',
    description: 'Plans de câblage, schémas, fiches techniques, bons de livraison',
  },
};

/**
 * Photos et documents d'une intervention avec support multi-catégories enrichi.
 */
export function AttachmentGallery({
  interventionId,
  organizationId,
  missionId,
  uploadedBy,
  attachments,
  canEdit,
  hasAttachmentsFeature,
}: AttachmentGalleryProps) {
  const upload = useUploadAttachment(interventionId);
  const remove = useDeleteAttachment(interventionId);
  const [error, setError] = useState<unknown>(null);
  const [activeFilter, setActiveFilter] = useState<PhotoCategory>('all');
  const [previewAttachment, setPreviewAttachment] = useState<InterventionAttachment | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const { can } = usePermission();

  // Les commandes d'ajout n'apparaissent que si LES DEUX conditions tiennent.
  // Les pièces jointes déjà déposées restent visibles et supprimables dans
  // tous les cas — une formule qui perd cette fonctionnalité (rétrogradation)
  // ne doit pas faire disparaître ce qui existe déjà.
  const canUpload = canEdit && hasAttachmentsFeature;
  const requiredPlan = getMinimumRequiredPlan(FEATURES.attachments);
  const peutVoirFacturation = can(PERMISSIONS.billingView);

  // Une référence par type de pièce jointe.
  //
  // Cinq `const` plutôt qu'un objet littéral les regroupant : l'objet est
  // recréé à chaque rendu, et `react-hooks/refs` y voit — à juste titre — un
  // accès aux références pendant le rendu. La forme nommée est aussi celle que
  // le reste du dépôt emploie.
  const beforeInputRef = useRef<HTMLInputElement>(null);
  const duringInputRef = useRef<HTMLInputElement>(null);
  const afterInputRef = useRef<HTMLInputElement>(null);
  const proofInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null, kind: AttachmentKind) => {
    if (files === null || files.length === 0) return;

    setError(null);
    for (const rawFile of Array.from(files)) {
      void (async () => {
        const file = await compressImage(rawFile);
        upload.mutate(
          { organizationId, missionId, interventionId, file, kind, uploadedBy },
          {
            onError: (mutationError) => {
              setError(mutationError);
            },
          },
        );
      })();
    }
  };

  const handleDrop = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!canEdit) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files, 'proof');
    }
  };

  // Filtrage des pièces jointes
  const filteredAttachments = attachments.filter((att) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'during') return att.kind === 'proof';
    return att.kind === activeFilter;
  });

  // Compteurs
  const counts = {
    all: attachments.length,
    before: attachments.filter((a) => a.kind === 'before').length,
    during: attachments.filter((a) => a.kind === 'proof').length,
    after: attachments.filter((a) => a.kind === 'after').length,
    proof: attachments.filter((a) => a.kind === 'proof').length,
    document: attachments.filter((a) => a.kind === 'document').length,
  };

  return (
    <div className="space-y-4">
      <FormError error={error} />

      {/* Hidden inputs pour déclenchement d'upload par catégorie */}
      {canUpload && (
        <>
          <input
            ref={beforeInputRef}
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            className="sr-only"
            onChange={(e) => {
              handleFiles(e.target.files, 'before');
              e.target.value = '';
            }}
          />
          <input
            ref={duringInputRef}
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            className="sr-only"
            onChange={(e) => {
              handleFiles(e.target.files, 'proof');
              e.target.value = '';
            }}
          />
          <input
            ref={afterInputRef}
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            className="sr-only"
            onChange={(e) => {
              handleFiles(e.target.files, 'after');
              e.target.value = '';
            }}
          />
          <input
            ref={proofInputRef}
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            className="sr-only"
            onChange={(e) => {
              handleFiles(e.target.files, 'proof');
              e.target.value = '';
            }}
          />
          <input
            ref={documentInputRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="sr-only"
            onChange={(e) => {
              handleFiles(e.target.files, 'document');
              e.target.value = '';
            }}
          />
        </>
      )}

      {/*
        L'INCITATION N'APPARAÎT QUE SI LA FORMULE EST LA SEULE RAISON.

        `canEdit && !hasAttachmentsFeature` : une intervention déjà terminée
        (canEdit=false) n'a pas besoin qu'on lui vante une mise à niveau, elle
        n'accepte plus aucune modification, quelle que soit la formule.
      */}
      {canEdit && !hasAttachmentsFeature && (
        <div className="border-border bg-surface-subtle/50 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
          <div className="flex items-center gap-2.5">
            <Sparkles className="text-primary size-4 shrink-0" aria-hidden="true" />
            <p className="text-xs text-muted-foreground">
              L’ajout de photos et documents nécessite la formule{' '}
              <span className="text-foreground font-semibold">{requiredPlan.name}</span> (
              {requiredPlan.priceMonthly} €/mois).
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0 text-xs">
            {peutVoirFacturation ? (
              <Link to={ROUTES.organizationBilling}>Mettre à niveau</Link>
            ) : (
              <Link to={ROUTES.pricing}>Découvrir les offres</Link>
            )}
          </Button>
        </div>
      )}

      {/* BOUTONS D'AJOUT PAR CATÉGORIE */}
      {canUpload && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground">Ajouter des photos & justificatifs :</span>
            {upload.isPending && (
              <span className="text-xs text-primary font-medium animate-pulse flex items-center gap-1.5">
                <Upload className="size-3.5 animate-bounce" />
                Envoi en cours…
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {/* 1. Avant */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => beforeInputRef.current?.click()}
              disabled={upload.isPending}
              className="w-full justify-start text-xs h-9 gap-1.5 cursor-pointer hover:border-border-strong"
              title="Photographier l'état initial"
            >
              <Camera className="size-3.5 text-muted-foreground shrink-0" />
              <span className="truncate">1. « Avant »</span>
            </Button>

            {/* 2. Pendant */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => duringInputRef.current?.click()}
              disabled={upload.isPending}
              className="w-full justify-start text-xs h-9 gap-1.5 cursor-pointer hover:border-primary/50"
              title="Photographier les étapes de pose ou travaux en cours"
            >
              <Hammer className="size-3.5 text-primary shrink-0" />
              <span className="truncate">2. Travaux</span>
            </Button>

            {/* 3. Après */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => afterInputRef.current?.click()}
              disabled={upload.isPending}
              className="w-full justify-start text-xs h-9 gap-1.5 cursor-pointer hover:border-primary/50"
              title="Photographier le résultat finalisé"
            >
              <Sparkles className="size-3.5 text-success shrink-0" />
              <span className="truncate">3. « Après »</span>
            </Button>

            {/* 4. Preuve / Mesure */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => proofInputRef.current?.click()}
              disabled={upload.isPending}
              className="w-full justify-start text-xs h-9 gap-1.5 cursor-pointer hover:border-primary/50"
              title="Photographier un test, compteur ou numéro de série"
            >
              <Wrench className="size-3.5 text-warning shrink-0" />
              <span className="truncate">4. Mesure / Test</span>
            </Button>

            {/* 5. Document */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => documentInputRef.current?.click()}
              disabled={upload.isPending}
              className="w-full justify-start text-xs h-9 gap-1.5 cursor-pointer hover:border-primary col-span-2 sm:col-span-1"
              title="Joindre un plan ou document PDF"
            >
              <FileText className="size-3.5 text-primary shrink-0" />
              <span className="truncate">5. Doc / Plan</span>
            </Button>
          </div>

          {/* Zone Drag & Drop — un <button> : elle se clique aussi, et le
              clavier doit pouvoir l'atteindre comme la souris. */}
          <button
            type="button"
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            className={cn(
              'w-full border-2 border-dashed rounded-xl p-3 text-center transition-colors cursor-pointer',
              isDragOver
                ? 'border-primary bg-primary/10'
                : 'border-border/60 hover:border-primary/50 bg-surface-subtle/30',
            )}
            onClick={() => duringInputRef.current?.click()}
          >
            <p className="text-3xs text-muted-foreground">
              💡 Vous pouvez aussi <strong>glisser-déposer vos photos</strong> ici directement ou cliquer pour sélectionner plusieurs fichiers à la fois.
            </p>
          </button>
        </div>
      )}

      {/* FILTRES D'AFFICHAGE DE LA GALERIE */}
      {attachments.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs border-b border-border/70 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={cn(
              'px-2.5 py-1 rounded-lg font-medium transition-colors shrink-0 cursor-pointer',
              activeFilter === 'all'
                ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-surface-subtle',
            )}
          >
            Toutes ({counts.all})
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('before')}
            className={cn(
              'px-2.5 py-1 rounded-lg font-medium transition-colors shrink-0 cursor-pointer flex items-center gap-1',
              activeFilter === 'before'
                ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-surface-subtle',
            )}
          >
            Avant ({counts.before})
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('during')}
            className={cn(
              'px-2.5 py-1 rounded-lg font-medium transition-colors shrink-0 cursor-pointer flex items-center gap-1',
              activeFilter === 'during'
                ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-surface-subtle',
            )}
          >
            Travaux & Mesures ({counts.during})
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('after')}
            className={cn(
              'px-2.5 py-1 rounded-lg font-medium transition-colors shrink-0 cursor-pointer flex items-center gap-1',
              activeFilter === 'after'
                ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-surface-subtle',
            )}
          >
            Après ({counts.after})
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('document')}
            className={cn(
              'px-2.5 py-1 rounded-lg font-medium transition-colors shrink-0 cursor-pointer flex items-center gap-1',
              activeFilter === 'document'
                ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-surface-subtle',
            )}
          >
            Documents ({counts.document})
          </button>
        </div>
      )}

      {/* LISTE DES VIGNETTES */}
      {attachments.length === 0 ? (
        <div className="text-center py-6 border border-dashed border-border rounded-xl bg-surface-subtle/30 space-y-1">
          <ImageIcon className="size-7 text-muted-foreground/60 mx-auto" />
          <p className="text-xs font-medium text-foreground">Aucune photo ou document joint</p>
          <p className="text-3xs text-muted-foreground max-w-sm mx-auto">
            Prenez des photos de l'état initial, des étapes de travaux, des mesures techniques et du résultat final.
          </p>
        </div>
      ) : filteredAttachments.length === 0 ? (
        <p className="text-center py-4 text-xs text-muted-foreground">
          Aucune pièce jointe dans cette catégorie.
        </p>
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {filteredAttachments.map((attachment) => (
            <AttachmentTile
              key={attachment.id}
              attachment={attachment}
              canEdit={canEdit}
              onPreview={() => setPreviewAttachment(attachment)}
              onDelete={() => {
                remove.mutate(attachment);
              }}
            />
          ))}
        </ul>
      )}

      {/* MODALE LIGHTBOX / PRÉVISUALISATION PLEIN ÉCRAN */}
      {previewAttachment && (
        <AttachmentPreviewModal
          attachment={previewAttachment}
          open={Boolean(previewAttachment)}
          onOpenChange={(open) => {
            if (!open) setPreviewAttachment(null);
          }}
          onDelete={
            canEdit
              ? () => {
                  remove.mutate(previewAttachment);
                  setPreviewAttachment(null);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

function AttachmentTile({
  attachment,
  canEdit,
  onPreview,
  onDelete,
}: {
  attachment: InterventionAttachment;
  canEdit: boolean;
  onPreview: () => void;
  onDelete: () => void;
}) {
  const url = useAttachmentUrl(attachment.storage_path);
  const isImage = attachment.mime_type?.startsWith('image/') ?? false;

  const config =
    attachment.kind === 'before'
      ? CATEGORIES.before
      : attachment.kind === 'after'
        ? CATEGORIES.after
        : attachment.kind === 'document'
          ? CATEGORIES.document
          : CATEGORIES.during;

  return (
    <li className="border-border group relative overflow-hidden rounded-xl border bg-surface shadow-xs transition-all hover:shadow-md hover:border-primary/50">
      <button
        type="button"
        onClick={onPreview}
        aria-label="Agrandir la pièce jointe"
        className="bg-surface-sunken relative flex aspect-square w-full items-center justify-center cursor-pointer overflow-hidden"
      >
        {url.isPending ? (
          <Skeleton className="size-full" />
        ) : url.isError || url.data === null ? (
          <ImageOff className="text-subtle-foreground size-6" aria-hidden="true" />
        ) : isImage ? (
          <>
            <img
              src={url.data}
              alt={attachment.caption ?? attachment.file_name}
              className="size-full object-cover transition-transform duration-200 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
              <ZoomIn className="size-6 drop-shadow-md" />
            </div>
          </>
        ) : (
          <div className="text-muted-foreground group-hover:text-foreground flex flex-col items-center gap-1.5 p-3 text-center">
            <FileText className="size-8 text-primary" aria-hidden="true" />
            <span className="text-3xs font-medium break-all line-clamp-2">{attachment.file_name}</span>
          </div>
        )}

        {/* Badge catégorie en coin supérieur */}
        <div className="absolute top-1.5 left-1.5">
          <Badge variant={config.badgeVariant} className="px-1.5 py-0.5 shadow-sm font-bold uppercase">
            {config.shortLabel}
          </Badge>
        </div>
      </button>

      {/* Barre d'action inférieure */}
      <div className="flex items-center justify-between gap-1 p-1.5 bg-surface-subtle/50">
        <span className="text-muted-foreground truncate max-w-[100px]" title={attachment.file_name}>
          {attachment.caption || attachment.file_name}
        </span>

        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onPreview}
            className="text-muted-foreground hover:text-primary"
            title="Agrandir"
          >
            <Eye className="size-3" />
          </Button>

          {canEdit && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="text-muted-foreground hover:text-error"
              aria-label={`Supprimer ${attachment.file_name}`}
              title="Supprimer la photo"
            >
              <Trash2 className="size-3" />
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

function AttachmentPreviewModal({
  attachment,
  open,
  onOpenChange,
  onDelete,
}: {
  attachment: InterventionAttachment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete?: (() => void) | undefined;
}) {
  const url = useAttachmentUrl(attachment.storage_path);
  const isImage = attachment.mime_type?.startsWith('image/') ?? false;

  const config =
    attachment.kind === 'before'
      ? CATEGORIES.before
      : attachment.kind === 'after'
        ? CATEGORIES.after
        : attachment.kind === 'document'
          ? CATEGORIES.document
          : CATEGORIES.during;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={attachment.file_name}
      description={`Catégorie : ${config.label}`}
    >
      <div className="space-y-4">
        {/* Fond sombre délibéré, et non un oubli de jeton : une photo de chantier
            se juge sur un fond neutre foncé, quel que soit le thème de l'application. */}
        <div className="bg-surface-sunken rounded-xl overflow-hidden flex items-center justify-center max-h-[60vh] min-h-[250px] p-2">
          {url.isPending ? (
            <Skeleton className="h-64 w-full" />
          ) : isImage && url.data ? (
            <img
              src={url.data}
              alt={attachment.caption ?? attachment.file_name}
              className="max-h-[58vh] max-w-full object-contain rounded-lg shadow-lg"
            />
          ) : (
            <div className="text-center text-muted-foreground space-y-3 p-6">
              <FileText className="size-16 mx-auto text-primary" />
              <p className="text-sm font-medium">{attachment.file_name}</p>
              {url.data && (
                <Button asChild variant="primary" size="sm">
                  <a href={url.data} target="_blank" rel="noreferrer" download={attachment.file_name}>
                    <Download className="size-4 mr-1.5" />
                    Télécharger le document
                  </a>
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Détails et actions */}
        <div className="flex items-center justify-between border-t border-border pt-3">
          <div className="flex items-center gap-2">
            <Badge variant={config.badgeVariant}>{config.label}</Badge>
            {attachment.created_at && (
              <span className="text-3xs text-muted-foreground font-mono">
                {new Date(attachment.created_at).toLocaleString('fr-FR')}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {url.data && isImage && (
              <Button asChild variant="outline" size="sm" className="text-xs">
                <a href={url.data} target="_blank" rel="noreferrer" download={attachment.file_name}>
                  <Download className="size-3.5 mr-1" />
                  Télécharger
                </a>
              </Button>
            )}

            {onDelete && (
              <Button
                type="button"
                variant="danger-outline"
                size="sm"
                onClick={onDelete}
                className="text-xs"
              >
                <Trash2 className="size-3.5 mr-1" />
                Supprimer
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
