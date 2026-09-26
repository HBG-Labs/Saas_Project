import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  Images,
  PauseCircle,
  Pencil,
  PlayCircle,
  Plus,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingScreen } from '@/components/feedback/LoadingScreen';
import { Badge, type BadgeProps } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { isProduction } from '@/config/env';
import { cn } from '@/lib/cn';

import {
  SOCIAL_WEEK_DAYS,
  addDays,
  browserTimeZone,
  formatShortDate,
  formatTime,
  isFinalInstagramAsset,
  postAudience,
  postObjective,
  postPlannedFor,
  selectedFinalSocialPostAsset,
  type SocialPostFormValues,
  type SocialPostSaveIntent,
  type SocialPostWithAssets,
} from '../weekly-planning';
import {
  useCreateDevelopmentSocialWeek,
  useCancelSocialPost,
  useGenerateSocialPostImages,
  useGenerateSocialStudioWeek,
  useSelectSocialPostAsset,
  useSetSocialWeekPublishingSuspended,
  useSocialStudioWeek,
  useUpdateSocialPost,
  useValidateAndScheduleSocialWeek,
} from '../hooks/useSocialStudioWeek';

import { InstagramPostPreview } from './InstagramPostPreview';
import { SocialPostEditorModal } from './SocialPostEditorModal';

const STATUS_META: Record<
  SocialPostWithAssets['status'],
  { label: string; variant: NonNullable<BadgeProps['variant']> }
> = {
  draft: { label: 'BROUILLON', variant: 'neutral' },
  ready: { label: 'READY', variant: 'success' },
  scheduled: { label: 'SCHEDULED', variant: 'info' },
  processing: { label: 'PROCESSING', variant: 'warning' },
  published: { label: 'PUBLISHED', variant: 'success' },
  failed: { label: 'FAILED', variant: 'error' },
  cancelled: { label: 'CANCELLED', variant: 'neutral' },
};

const PUBLISH_STATE_META: Partial<
  Record<
    SocialPostWithAssets['publish_state'],
    { label: string; variant: NonNullable<BadgeProps['variant']> }
  >
> = {
  scheduled: { label: 'PROGRAMMÉ', variant: 'info' },
  processing: { label: 'PROCESSING', variant: 'warning' },
  published_simulated: { label: 'PUBLIÉ SIMULÉ', variant: 'success' },
  published_live: { label: 'PUBLISHED', variant: 'success' },
  failed: { label: 'FAILED', variant: 'error' },
  skipped: { label: 'À REPROGRAMMER', variant: 'warning' },
  reconciliation_required: { label: 'RÉCONCILIATION', variant: 'error' },
};

function statusMeta(post: SocialPostWithAssets) {
  return PUBLISH_STATE_META[post.publish_state] ?? STATUS_META[post.status];
}

function weekRange(startsOn: string) {
  const end = addDays(startsOn, 6);
  return `${formatShortDate(startsOn)} - ${formatShortDate(end)}`;
}

function completionLabel(posts: SocialPostWithAssets[]) {
  const ready = posts.filter(
    (post) => post.status === 'ready' || post.status === 'scheduled',
  ).length;
  const missing = 7 - ready;
  return missing === 0 ? '7/7 prêts' : `${ready}/7 prêts · ${missing} à compléter`;
}

function scheduledOrPlannedFor(post: SocialPostWithAssets) {
  return post.status === 'scheduled' || post.publish_state === 'scheduled'
    ? (post.scheduled_at ?? postPlannedFor(post))
    : postPlannedFor(post);
}

function validationIssues(posts: SocialPostWithAssets[]) {
  const issues: string[] = [];
  if (posts.length !== 7) issues.push('La semaine doit contenir 7 publications.');
  if (posts.some((post) => post.status !== 'ready')) {
    issues.push('Chaque publication doit être READY.');
  }
  if (posts.some((post) => !post.hook?.trim() || !post.caption?.trim() || !post.cta?.trim())) {
    issues.push('Chaque publication doit avoir un hook, une légende et un CTA valides.');
  }
  if (posts.some((post) => !isFinalInstagramAsset(selectedFinalSocialPostAsset(post)))) {
    issues.push('Chaque publication doit avoir un asset final sélectionné en 1080×1350.');
  }
  if (posts.some((post) => postPlannedFor(post) === null)) {
    issues.push('Chaque publication doit avoir une date et une heure valides.');
  }
  return issues;
}

function isEditablePost(post: SocialPostWithAssets, canManage: boolean, canPublish: boolean) {
  if (post.status === 'processing' || post.status === 'published' || post.status === 'cancelled') {
    return false;
  }
  if (post.status === 'scheduled' || post.publish_state === 'scheduled') return canPublish;
  return canManage;
}

function canCancelPost(post: SocialPostWithAssets, canPublish: boolean) {
  return (
    canPublish &&
    (post.status === 'scheduled' || post.publish_state === 'scheduled') &&
    post.status !== 'processing'
  );
}

function WeekPostCard({
  post,
  startsOn,
  canEdit,
  isGeneratingImages,
  isSelectingAsset,
  canCancel,
  isCancelling,
  onEdit,
  onGenerateImages,
  onSelectAsset,
  onCancel,
}: {
  post: SocialPostWithAssets;
  startsOn: string;
  canEdit: boolean;
  isGeneratingImages: boolean;
  isSelectingAsset: boolean;
  canCancel: boolean;
  isCancelling: boolean;
  onEdit: (post: SocialPostWithAssets) => void;
  onGenerateImages: (post: SocialPostWithAssets) => void;
  onSelectAsset: (post: SocialPostWithAssets, assetId: string) => void;
  onCancel: (post: SocialPostWithAssets) => void;
}) {
  const dayIndex = post.slot_index - 1;
  const dayDate = addDays(startsOn, dayIndex);
  const status = statusMeta(post);
  const generatedAssets = post.assets.filter(
    (asset) => asset.kind === 'generated' || asset.kind === 'selected',
  );
  const hasGeneratedAssets = generatedAssets.length > 0;
  const canGenerateImages =
    canEdit && !['scheduled', 'processing', 'published', 'cancelled'].includes(post.status);

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-foreground text-sm font-semibold">
              {SOCIAL_WEEK_DAYS[dayIndex]} {formatShortDate(dayDate)}
            </p>
            <p className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
              <Clock className="size-3.5" aria-hidden="true" />
              {post.status === 'scheduled'
                ? `Programmé ${formatTime(scheduledOrPlannedFor(post))}`
                : formatTime(postPlannedFor(post))}
            </p>
          </div>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>

        <InstagramPostPreview post={post} compact />

        <div className="space-y-3">
          <div>
            <p className="text-muted-foreground text-3xs font-medium uppercase">Hook</p>
            <h2 className="text-foreground text-base leading-snug font-semibold">
              {post.hook || 'Hook à compléter'}
            </h2>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <dt className="text-muted-foreground">Objectif</dt>
              <dd className="text-foreground mt-0.5 font-medium">{postObjective(post)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Audience</dt>
              <dd className="text-foreground mt-0.5 font-medium">{postAudience(post)}</dd>
            </div>
          </dl>
        </div>

        {hasGeneratedAssets ? (
          <div className="space-y-2">
            <p className="text-muted-foreground text-3xs font-medium uppercase">Variantes image</p>
            <div className="grid grid-cols-3 gap-2">
              {generatedAssets.map((asset, index) => {
                const selected =
                  asset.kind === 'selected' ||
                  (index === 0 && generatedAssets.every((item) => item.kind !== 'selected'));
                return (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => onSelectAsset(post, asset.id)}
                    disabled={!canGenerateImages || isSelectingAsset}
                    aria-pressed={selected}
                    className={cn(
                      'border-border bg-surface hover:bg-surface-raised focus-visible:ring-ring overflow-hidden rounded-md border text-left transition focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60',
                      selected && 'border-primary ring-primary/20 ring-2',
                    )}
                  >
                    <span className="bg-surface-sunken block aspect-square">
                      {asset.signedUrl ? (
                        <img
                          src={asset.signedUrl}
                          alt={asset.alt_text ?? `Variante ${index + 1}`}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : null}
                    </span>
                    <span className="text-muted-foreground text-3xs block px-2 py-1">
                      Variante {index + 1}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => onEdit(post)}
            disabled={!canEdit}
            leadingIcon={<Pencil />}
          >
            Modifier
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => onGenerateImages(post)}
            disabled={!canGenerateImages}
            isLoading={isGeneratingImages}
            loadingLabel="Génération"
            leadingIcon={<Images />}
          >
            {hasGeneratedAssets ? 'Régénérer le visuel' : 'Générer le visuel'}
          </Button>
        </div>

        {canCancel ? (
          <Button
            variant="danger-outline"
            size="sm"
            className="w-full"
            onClick={() => onCancel(post)}
            isLoading={isCancelling}
            loadingLabel="Annulation"
            leadingIcon={<XCircle />}
          >
            Annuler cette publication
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function SocialStudioWeekPlanner({
  organizationId,
  startsOn,
  canManage,
  canPublish,
}: {
  organizationId: string;
  startsOn: string;
  canManage: boolean;
  canPublish: boolean;
}) {
  const [selectedPost, setSelectedPost] = useState<SocialPostWithAssets | null>(null);
  const [imageGenerationPostId, setImageGenerationPostId] = useState<string | null>(null);
  const weekQuery = useSocialStudioWeek(organizationId, startsOn);
  const createMockWeek = useCreateDevelopmentSocialWeek(organizationId, startsOn);
  const generateWeek = useGenerateSocialStudioWeek(organizationId, startsOn);
  const generateImages = useGenerateSocialPostImages(organizationId, startsOn);
  const selectAsset = useSelectSocialPostAsset(organizationId, startsOn);
  const updatePost = useUpdateSocialPost(organizationId, startsOn);
  const validateWeek = useValidateAndScheduleSocialWeek(organizationId, startsOn);
  const suspendWeek = useSetSocialWeekPublishingSuspended(organizationId, startsOn);
  const cancelPost = useCancelSocialPost(organizationId, startsOn);

  if (weekQuery.isPending) return <LoadingScreen label="Chargement de Social Studio…" />;

  if (weekQuery.isError) {
    return (
      <ErrorState
        title="La semaine Social Studio n’a pas pu être chargée"
        error={weekQuery.error}
        onRetry={() => void weekQuery.refetch()}
      />
    );
  }

  const week = weekQuery.data ?? null;
  const posts = week?.posts ?? [];
  const nextPost = posts
    .filter((post) => post.status === 'scheduled' && post.publish_state === 'scheduled')
    .sort((a, b) =>
      String(scheduledOrPlannedFor(a)).localeCompare(String(scheduledOrPlannedFor(b))),
    )[0];
  const issues = validationIssues(posts);
  const isSuspended = Boolean(week?.week.publishing_suspended_at);
  const canCreateMockWeek = canManage && !isProduction;
  const canGenerateWeek = canManage;
  const canValidateWeek = canPublish && issues.length === 0;

  const savePost = (
    post: SocialPostWithAssets,
    values: SocialPostFormValues,
    intent: SocialPostSaveIntent,
  ) => {
    updatePost.mutate(
      { post, values, intent },
      {
        onSuccess: () => setSelectedPost(null),
      },
    );
  };

  const generatePostImages = (post: SocialPostWithAssets) => {
    setImageGenerationPostId(post.id);
    generateImages.mutate(
      {
        postId: post.id,
        force: post.assets.some((asset) => asset.kind === 'generated' || asset.kind === 'selected'),
      },
      {
        onSettled: () => setImageGenerationPostId(null),
      },
    );
  };

  const selectPostAsset = (post: SocialPostWithAssets, assetId: string) => {
    selectAsset.mutate({ postId: post.id, assetId });
  };

  const validateAndSchedule = () => {
    if (!week || !canValidateWeek) return;
    const confirmed = window.confirm(
      'Valider et programmer les 7 publications de cette semaine en dry-run ?',
    );
    if (!confirmed) return;

    validateWeek.mutate({ weekId: week.week.id, timezone: browserTimeZone() });
  };

  const toggleSuspension = () => {
    if (!week || !canPublish) return;
    suspendWeek.mutate({ weekId: week.week.id, suspended: !isSuspended });
  };

  const cancelScheduledPost = (post: SocialPostWithAssets) => {
    const confirmed = window.confirm('Annuler cette publication programmée ?');
    if (!confirmed) return;
    cancelPost.mutate({ postId: post.id });
  };

  return (
    <section className="space-y-6" aria-labelledby="social-week-title">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="border-border bg-surface rounded-lg border p-4">
          <p className="text-muted-foreground text-xs">Semaine actuelle</p>
          <p className="text-foreground mt-1 text-lg font-semibold">{weekRange(startsOn)}</p>
        </div>
        <div className="border-border bg-surface rounded-lg border p-4">
          <p className="text-muted-foreground text-xs">Publications</p>
          <p className="text-foreground mt-1 text-lg font-semibold">{posts.length}/7</p>
        </div>
        <div className="border-border bg-surface rounded-lg border p-4">
          <p className="text-muted-foreground text-xs">Prochaine publication</p>
          <p className="text-foreground mt-1 text-lg font-semibold">
            {nextPost ? formatTime(scheduledOrPlannedFor(nextPost)) : 'Aucune'}
          </p>
        </div>
      </div>

      {week === null ? (
        <EmptyState
          icon={CalendarDays}
          title="Aucune semaine Instagram préparée"
          description={
            'Social Studio AI prépare la stratégie, les 7 contenus et les visuels finaux automatiquement.'
          }
          action={
            <div className="flex w-full max-w-sm flex-col items-center gap-3">
              <Button
                onClick={() => generateWeek.mutate()}
                isLoading={generateWeek.isPending}
                loadingLabel="Préparation de votre semaine"
                disabled={!canGenerateWeek}
                leadingIcon={<Plus />}
                className="w-full"
              >
                Préparer ma semaine
              </Button>

              {generateWeek.isPending ? (
                <div className="border-border bg-surface rounded-lg border px-3 py-2 text-left text-xs">
                  <p className="text-foreground font-medium">Préparation de votre semaine…</p>
                  <p className="text-muted-foreground mt-1">
                    Création des contenus · Création des visuels · Finalisation
                  </p>
                </div>
              ) : null}

              {generateWeek.error ? (
                <p role="alert" className="text-error text-sm">
                  {generateWeek.error instanceof Error
                    ? generateWeek.error.message
                    : 'Social Studio AI n’a pas pu préparer la semaine.'}
                </p>
              ) : null}

              {canCreateMockWeek ? (
                <Button
                  variant="outline"
                  onClick={() => createMockWeek.mutate()}
                  isLoading={createMockWeek.isPending}
                  loadingLabel="Création des brouillons de test"
                  className="w-full"
                >
                  Créer des brouillons de test
                </Button>
              ) : null}
            </div>
          }
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="social-week-title" className="text-foreground text-xl font-bold">
                Ma semaine Instagram
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                {completionLabel(posts)} · {posts.length} publications image
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                disabled={!canPublish || suspendWeek.isPending || week.week.status !== 'scheduled'}
                isLoading={suspendWeek.isPending}
                loadingLabel={isSuspended ? 'Reprise' : 'Suspension'}
                leadingIcon={isSuspended ? <PlayCircle /> : <PauseCircle />}
                onClick={toggleSuspension}
                className="w-full sm:w-auto"
              >
                {isSuspended ? 'Reprendre les publications' : 'Suspendre les publications'}
              </Button>
              <Button
                disabled={!canValidateWeek}
                isLoading={validateWeek.isPending}
                loadingLabel="Programmation"
                onClick={validateAndSchedule}
                leadingIcon={<CheckCircle2 />}
                className="w-full sm:w-auto"
                aria-describedby="weekly-validation-reasons"
              >
                Valider et programmer la semaine
              </Button>
            </div>
          </div>

          {isSuspended ? (
            <div className="border-warning/30 bg-warning/5 text-warning rounded-lg border p-4 text-sm font-medium">
              Publications suspendues. À la reprise, les posts dont l’horaire est dépassé seront
              marqués à reprogrammer.
            </div>
          ) : null}

          <div
            id="weekly-validation-reasons"
            className={cn(
              'rounded-lg border p-4 text-sm',
              issues.length === 0 && canPublish
                ? 'border-success/30 bg-success/5 text-success'
                : 'border-warning/30 bg-warning/5 text-warning',
            )}
          >
            <div className="flex gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-medium">
                  {issues.length === 0 && canPublish
                    ? 'La semaine est prête à être programmée en dry-run.'
                    : 'Validation hebdomadaire bloquée.'}
                </p>
                <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs">
                  {issues.length > 0 ? (
                    issues.map((issue) => <li key={issue}>{issue}</li>)
                  ) : (
                    <li>Les 7 publications READY seront programmées ensemble.</li>
                  )}
                  {!canPublish ? <li>Votre rôle ne permet pas la publication.</li> : null}
                </ul>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {posts.map((post) => (
              <WeekPostCard
                key={post.id}
                post={post}
                startsOn={week.week.starts_on}
                canEdit={isEditablePost(post, canManage, canPublish)}
                isGeneratingImages={generateImages.isPending && imageGenerationPostId === post.id}
                isSelectingAsset={selectAsset.isPending}
                canCancel={canCancelPost(post, canPublish)}
                isCancelling={cancelPost.isPending}
                onEdit={setSelectedPost}
                onGenerateImages={generatePostImages}
                onSelectAsset={selectPostAsset}
                onCancel={cancelScheduledPost}
              />
            ))}
          </div>

          {generateImages.error ? (
            <p role="alert" className="text-error text-sm">
              {generateImages.error instanceof Error
                ? generateImages.error.message
                : 'Le moteur visuel Social Studio n’a pas pu générer les visuels.'}
            </p>
          ) : null}

          {selectAsset.error ? (
            <p role="alert" className="text-error text-sm">
              {selectAsset.error instanceof Error
                ? selectAsset.error.message
                : 'La variante image n’a pas pu être sélectionnée.'}
            </p>
          ) : null}

          {updatePost.error ? (
            <p role="alert" className="text-error text-sm">
              {updatePost.error instanceof Error
                ? updatePost.error.message
                : 'La publication n’a pas pu être enregistrée.'}
            </p>
          ) : null}

          {validateWeek.error ? (
            <p role="alert" className="text-error text-sm">
              {validateWeek.error instanceof Error
                ? validateWeek.error.message
                : 'La semaine n’a pas pu être programmée.'}
            </p>
          ) : null}

          {suspendWeek.error ? (
            <p role="alert" className="text-error text-sm">
              {suspendWeek.error instanceof Error
                ? suspendWeek.error.message
                : 'Le statut de suspension n’a pas pu être modifié.'}
            </p>
          ) : null}

          {cancelPost.error ? (
            <p role="alert" className="text-error text-sm">
              {cancelPost.error instanceof Error
                ? cancelPost.error.message
                : 'La publication n’a pas pu être annulée.'}
            </p>
          ) : null}

          <SocialPostEditorModal
            post={selectedPost}
            week={week.week}
            canEditSchedule={canPublish}
            isSaving={updatePost.isPending}
            onClose={() => setSelectedPost(null)}
            onSave={savePost}
          />
        </>
      )}
    </section>
  );
}
